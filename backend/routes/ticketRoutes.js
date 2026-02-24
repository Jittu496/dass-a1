import express from "express";
import QRCode from "qrcode";
import Ticket from "../models/Ticket.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { sendMail, ticketEmailHtml } from "../utils/email.js";

const router = express.Router();

function makeTicketId() {
  return "TKT-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

router.post("/register/:eventId", protect, allowRoles("participant"), async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ msg: "Event not found" });

  if (event.type === "merch") return res.status(400).json({ msg: "Merch uses orders (not tickets register)" });

  if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline))
    return res.status(400).json({ msg: "Registration closed" });

  const existing = await Ticket.findOne({ event: event._id, participant: req.user.id });
  if (existing) return res.status(409).json({ msg: "Already registered" });

  if (event.registrationLimit > 0) {
    const count = await Ticket.countDocuments({ event: event._id });
    if (count >= event.registrationLimit) return res.status(400).json({ msg: "Registration limit reached" });
  }

  const ticketId = makeTicketId();
  const qrText = `${ticketId}|${event._id}|${req.user.id}`;
  const qrDataUrl = await QRCode.toDataURL(qrText);

  // accept optional registration form responses for Normal events
  const registrationResponses = req.body.registrationResponses || {};

  const ticket = await Ticket.create({
    event: event._id,
    participant: req.user.id,
    ticketId,
    qrText,
    qrDataUrl,
    registrationResponses
  });

  // lock the event's registration form after first registration
  try {
    if (Array.isArray(event.registrationForm) && event.registrationForm.length > 0 && !event.registrationFormLocked) {
      event.registrationFormLocked = true;
      await event.save();
    }
  } catch (e) {
    console.warn('Failed to lock registration form:', e.message || e);
  }

  res.status(201).json(ticket);

  // ── Send ticket confirmation email (non-blocking) ──────────────
  try {
    const participant = await User.findById(req.user.id).select("firstName email").lean();
    if (participant?.email) {
      const orgName = event.organizer
        ? (await User.findById(event.organizer).select("name firstName lastName").lean())
        : null;
      const organizerDisplay = orgName?.name ||
        `${orgName?.firstName || ""} ${orgName?.lastName || ""}`.trim() || undefined;

      const eventDate = event.startDate
        ? new Date(event.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
        : undefined;

      await sendMail({
        to: participant.email,
        subject: `🎫 Ticket Confirmed — ${event.name}`,
        html: ticketEmailHtml({
          firstName: participant.firstName,
          eventName: event.name,
          ticketId: ticket.ticketId,
          qrDataUrl: ticket.qrDataUrl,
          eventDate,
          organizer: organizerDisplay,
        }),
      });
    }
  } catch (emailErr) {
    console.warn("Ticket email failed (non-fatal):", emailErr.message);
  }
});

router.get("/mine", protect, allowRoles("participant"), async (req, res) => {
  try {
    const tickets = await Ticket.find({ participant: req.user.id }).populate("event");
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * PARTICIPANT: get the QR ticket generated for a specific merch order
 * GET /api/tickets/for-order/:orderId
 */
router.get("/for-order/:orderId", protect, allowRoles("participant"), async (req, res) => {
  try {
    const Order = (await import("../models/Order.js")).default;
    const order = await Order.findOne({ _id: req.params.orderId, participant: req.user.id });
    if (!order) return res.status(404).json({ msg: "Order not found" });
    if (order.status !== "approved") return res.status(404).json({ msg: "Order not yet approved" });

    const ticket = await Ticket.findOne({
      event: order.event,
      participant: req.user.id,
    });
    if (!ticket) return res.status(404).json({ msg: "Ticket not generated yet" });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * ORGANIZER: scan ticket QR text
 * POST /api/tickets/scan  { qrText: "TKT-...|eventId|userId" }
 */
router.post("/scan", protect, allowRoles("organizer"), async (req, res) => {
  // Accept either full qrText like "TKT-...|eventId|userId" OR just a ticketId string.
  const { qrText, eventId: eventIdBody } = req.body;
  if (!qrText) return res.status(400).json({ msg: "qrText required" });

  const raw = String(qrText).trim();
  let ticketId = raw;
  let eventIdFromQr = null;
  if (raw.includes("|")) {
    const parts = raw.split("|");
    // tolerate either 3 parts (ticket|event|user) or 1 part
    if (parts.length >= 1) {
      ticketId = parts[0];
      if (parts.length >= 2) eventIdFromQr = parts[1];
    }
  }

  // Prefer explicit eventId provided by client (UI selection). Otherwise use QR event id if present.
  let targetEventId = eventIdBody || eventIdFromQr;

  // If we have an explicit event id, ensure organizer owns it
  if (targetEventId) {
    const ev = await Event.findOne({ _id: targetEventId, organizer: req.user.id });
    if (!ev) return res.status(403).json({ msg: "Not your event" });
  }

  // Find ticket; if targetEventId is known, prefer that for lookup to avoid cross-event collisions
  let ticket = null;
  if (targetEventId) {
    ticket = await Ticket.findOne({ ticketId, event: targetEventId }).populate("participant", "firstName lastName email");
  } else {
    ticket = await Ticket.findOne({ ticketId }).populate("participant", "firstName lastName email").populate("event");
    if (ticket && String(ticket.event?.organizer) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Ticket does not belong to any of your events" });
    }
  }

  if (!ticket) return res.status(404).json({ msg: "Ticket not found" });

  if (ticket.status === "used") {
    return res.status(409).json({ msg: "Already checked-in", ticket });
  }

  ticket.status = "used";
  ticket.checkedInAt = new Date();
  await ticket.save();

  res.json({ msg: "Checked-in success", ticket });
});

export default router;
