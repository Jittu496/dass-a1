import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Order from "../models/Order.js";
import Event from "../models/Event.js";
import Ticket from "../models/Ticket.js";
import User from "../models/User.js";
import QRCode from "qrcode";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { sendMail, ticketEmailHtml } from "../utils/email.js";

const router = express.Router();

// ensure uploads dir
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `proof_${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

/**
 * PARTICIPANT: create merch order
 * POST /api/orders/create/:eventId  { quantity }
 */
router.post("/create/:eventId", protect, allowRoles("participant"), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event || event.type !== "merch") return res.status(404).json({ msg: "Merch event not found" });
    const quantity = Number(req.body.quantity || 1);
    if (quantity <= 0) return res.status(400).json({ msg: "Invalid quantity" });

    const variantId = req.body.variantId;
    let variant = null;
    if (variantId) {
      variant = (event.variants || []).find(v => String(v.id) === String(variantId));
      if (!variant) return res.status(400).json({ msg: "Invalid variant" });
      if (variant.stock <= 0) return res.status(400).json({ msg: "Variant out of stock" });
      if (variant.stock < quantity) return res.status(400).json({ msg: "Not enough stock for selected variant" });
      const existingQty = await Order.aggregate([
        { $match: { event: event._id, participant: req.user.id, variantId: String(variantId) } },
        { $group: { _id: null, total: { $sum: "$quantity" } } }
      ]);
      const already = (existingQty[0] && existingQty[0].total) ? existingQty[0].total : 0;
      if (variant.perParticipantLimit && (already + quantity) > variant.perParticipantLimit) {
        return res.status(400).json({ msg: `Per-participant limit exceeded for this variant (limit ${variant.perParticipantLimit})` });
      }
    } else {
      if (event.stock <= 0) return res.status(400).json({ msg: "Out of stock" });
      if (event.stock < quantity) return res.status(400).json({ msg: "Not enough stock" });
    }

    const unitPrice = (variant && variant.price) ? variant.price : (event.fee || 0);
    const amount = quantity * unitPrice;

    const order = await Order.create({
      event: event._id,
      participant: req.user.id,
      quantity,
      amount,
      variantId: variant ? String(variant.id) : undefined,
      variantSnapshot: variant ? { name: variant.name, size: variant.size, color: variant.color, price: variant.price } : {},
      status: "pending",
      batchId: req.body.batchId || "",
    });
    res.status(201).json(order);
  } catch (err) {
    console.error("create order error:", err);
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * PARTICIPANT: upload payment proof
 * POST /api/orders/:orderId/proof (form-data: proof=<file>)
 */
router.post("/:orderId/proof", protect, allowRoles("participant"), upload.single("proof"), async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, participant: req.user.id });
    if (!order) return res.status(404).json({ msg: "Order not found" });
    if (!req.file) return res.status(400).json({ msg: "Proof file required" });
    order.paymentProofPath = `/uploads/${req.file.filename}`;
    order.status = "pending";   // mark as pending approval after upload
    await order.save();
    res.json({ msg: "Proof uploaded", order });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

router.get("/mine", protect, allowRoles("participant"), async (req, res) => {
  try {
    const orders = await Order.find({ participant: req.user.id }).populate("event");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * ORGANIZER: list orders for my merch event
 */
router.get("/event/:eventId", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.eventId, organizer: req.user.id });
    if (!event) return res.status(404).json({ msg: "Event not found" });
    const orders = await Order.find({ event: event._id }).populate("participant", "firstName lastName email");
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * ORGANIZER: approve/reject payment
 * POST /api/orders/:orderId/decide { status: "approved"/"rejected", note }
 */
router.post("/:orderId/decide", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const { status, note = "" } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ msg: "Invalid status" });

    const order = await Order.findById(req.params.orderId).populate("event");
    if (!order) return res.status(404).json({ msg: "Order not found" });

    // ensure organizer owns the event
    const event = await Event.findOne({ _id: order.event._id, organizer: req.user.id });
    if (!event) return res.status(403).json({ msg: "Not your event" });

    if (order.status !== "pending") return res.status(409).json({ msg: "Already decided" });

    order.status = status;
    order.decisionNote = note;
    order.decidedBy = req.user.id;

    if (status === "approved") {
      // ── Variant-aware stock decrement ──────────────────────────────
      if (order.variantId) {
        const vIndex = (event.variants || []).findIndex(
          (v) => String(v.id) === String(order.variantId)
        );
        if (vIndex === -1)
          return res.status(400).json({ msg: "Variant not found on event" });
        const variant = event.variants[vIndex];
        if (variant.stock < order.quantity)
          return res.status(400).json({ msg: "Variant stock insufficient at approval time" });
        event.variants[vIndex].stock = variant.stock - order.quantity;
      } else {
        // No variant – use base event stock
        if (event.stock < order.quantity)
          return res.status(400).json({ msg: "Stock insufficient at approval time" });
        event.stock -= order.quantity;
      }
      await event.save();

      // ── Generate merch QR-pickup ticket ───────────────────────────
      // Use upsert so a duplicate (same event+participant) never crashes the server.
      const ticketId = "MER-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      const qrText = `${ticketId}|${event._id}|${order.participant}`;
      const qrDataUrl = await QRCode.toDataURL(qrText);

      await Ticket.findOneAndUpdate(
        { event: event._id, participant: order.participant },
        { $setOnInsert: { ticketId, qrText, qrDataUrl } },
        { upsert: true, new: true }
      );
    }

    await order.save();
    res.json({ msg: "Decision saved", order });

    // ── Send confirmation email to participant (non-blocking) ──────
    if (status === "approved") {
      try {
        const ticket = await Ticket.findOne({ event: event._id, participant: order.participant }).lean();
        const participant = await User.findById(order.participant).select("firstName email").lean();
        const orgUser = await User.findById(event.organizer).select("name firstName lastName").lean();
        const organizerDisplay = orgUser?.name ||
          `${orgUser?.firstName || ""} ${orgUser?.lastName || ""}`.trim() || undefined;
        const eventDate = event.startDate
          ? new Date(event.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
          : undefined;

        // Collect all approved batch orders for variant list
        const batchOrders = order.batchId
          ? await Order.find({ batchId: order.batchId, status: "approved" }).lean()
          : [order];
        const variants = batchOrders
          .filter(o => o.variantSnapshot?.name)
          .map(o => ({ name: o.variantSnapshot.name, qty: o.quantity, price: o.variantSnapshot.price || 0 }));
        const totalAmount = batchOrders.reduce((s, o) => s + (o.amount || 0), 0);

        if (participant?.email && ticket) {
          await sendMail({
            to: participant.email,
            subject: `🛍️ Order Approved — ${event.name}`,
            html: ticketEmailHtml({
              firstName: participant.firstName,
              eventName: event.name,
              ticketId: ticket.ticketId,
              qrDataUrl: ticket.qrDataUrl,
              eventDate,
              organizer: organizerDisplay,
              isMerch: true,
              variants,
              totalAmount,
            }),
          });
        }
      } catch (emailErr) {
        console.warn("Merch approval email failed (non-fatal):", emailErr.message);
      }
    }

  } catch (err) {
    console.error("decide error:", err);
    res.status(500).json({ msg: err.message || "Server error during decision" });
  }
});

export default router;
