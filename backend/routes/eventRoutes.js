import express from "express";
import Event from "../models/Event.js";
import Ticket from "../models/Ticket.js";
import Order from "../models/Order.js";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { toCSV } from "../utils/csv.js";

const router = express.Router();

/**
 * PUBLIC: Top 5 trending events in last 24h by registration count
 * GET /api/events/trending
 */
router.get("/trending", async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agg = await Ticket.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const ids = agg.map((a) => a._id);
    const countMap = {};
    agg.forEach((a) => { countMap[String(a._id)] = a.count; });

    const events = await Event.find({ _id: { $in: ids } }).populate("organizer", "name firstName lastName").lean();
    const result = events
      .map((e) => ({ ...e, _regCount: countMap[String(e._id)] || 0 }))
      .sort((a, b) => b._regCount - a._regCount);

    res.json(result);
  } catch (e) {
    res.status(500).json({ msg: "Failed to load trending" });
  }
});

/**
 * PUBLIC/PARTICIPANT: Browse published events with filters
 * GET /api/events?search=&type=&tag=&eligibility=&dateFrom=&dateTo=&followedOnly=
 */
router.get("/", async (req, res) => {
  try {
    const { search = "", type = "", tag = "", eligibility = "", dateFrom = "", dateTo = "", followedOrganizers = "" } = req.query;

    const q = { status: { $in: ["published", "ongoing", "completed", "closed"] } };

    if (type) q.type = type;
    if (tag) q.tags = tag;
    if (eligibility) q.eligibility = eligibility;
    if (search) q.name = { $regex: search, $options: "i" };

    // Date range filter on startDate
    if (dateFrom || dateTo) {
      q.startDate = {};
      if (dateFrom) q.startDate.$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        q.startDate.$lte = to;
      }
    }

    // followedOnly / followedOrganizers
    if (followedOrganizers) {
      const ids = followedOrganizers.split(",").filter(Boolean);
      if (ids.length) q.organizer = { $in: ids };
    }

    const events = await Event.find(q)
      .sort({ startDate: 1 })
      .populate("organizer", "name firstName lastName")
      .lean();

    res.json(events);
  } catch (e) {
    res.status(500).json({ msg: "Failed to load events" });
  }
});

/**
 * ORGANIZER: list my events (must be ABOVE "/:id")
 * GET /api/events/org/mine/list
 */
router.get("/org/mine/list", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }).sort({ createdAt: -1 });
    res.json(events);
  } catch (e) {
    res.status(500).json({ msg: "Failed to load organizer events" });
  }
});

/**
 * ORGANIZER: create draft
 * POST /api/events
 */
router.post("/", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const {
      name, description, type, eligibility = "All",
      tags = [], registrationDeadline, startDate, endDate,
      registrationLimit = 0, fee = 0, stock = 0
    } = req.body;

    if (!name || !type || !registrationDeadline || !startDate || !endDate) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    if (type === "merch") {
      if (req.body.distributionVenueConfirmed) {
        if (!req.body.distributionVenue) {
          return res.status(400).json({ msg: "When venue is confirmed, distributionVenue is required" });
        }
      }
    }

    const ev = await Event.create({
      name,
      description,
      type,
      eligibility,
      tags,
      registrationDeadline,
      startDate,
      endDate,
      registrationLimit,
      fee,
      stock,
      status: "draft",
      distributionVenue: req.body.distributionVenue || "",
      distributionVenueConfirmed: Boolean(req.body.distributionVenueConfirmed),
      organizer: req.user.id,
    });

    res.status(201).json(ev);
  } catch (e) {
    res.status(500).json({ msg: "Failed to create event" });
  }
});

/**
 * ORGANIZER: publish event
 * POST /api/events/:id/publish
 */
router.post("/:id/publish", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.id, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found" });
    ev.status = "published";
    await ev.save();
    res.json(ev);
  } catch (e) {
    res.status(500).json({ msg: "Failed to publish" });
  }
});

/**
 * ORGANIZER: update event
 * PUT /api/events/:id
 */
router.put("/:id", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.id, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found" });

    const immutable = ["completed", "closed"];
    if (immutable.includes(ev.status)) {
      if (req.body.status && ["completed", "closed"].includes(req.body.status)) {
        ev.status = req.body.status;
        await ev.save();
        return res.json(ev);
      }
      return res.status(400).json({ msg: "Event locked (completed/closed)" });
    }

    Object.assign(ev, req.body);
    await ev.save();
    res.json(ev);
  } catch (e) {
    res.status(500).json({ msg: "Failed to update event" });
  }
});

/**
 * ORGANIZER: analytics
 * GET /api/events/:id/analytics
 */
router.get("/:id/analytics", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.id, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found" });

    const registrations = await Ticket.countDocuments({ event: ev._id });
    const attendance = await Ticket.countDocuments({ event: ev._id, status: "used" });

    let revenue = 0;
    if (ev.type === "merch") {
      const approvedOrders = await Order.find({ event: ev._id, status: "approved" });
      revenue = approvedOrders.reduce((sum, o) => sum + o.amount, 0);
    } else {
      revenue = registrations * (ev.fee || 0);
    }

    // Team completion stats for hackathon events
    let teamStats = null;
    if (ev.type === "hackathon" && ev.participationMode === "team") {
      const Team = (await import("../models/Team.js")).default;
      const allTeams = await Team.countDocuments({ event: ev._id });
      const finalizedTeams = await Team.countDocuments({ event: ev._id, status: "finalized" });
      teamStats = { total: allTeams, finalized: finalizedTeams };
    }

    res.json({ registrations, attendance, revenue, teamStats });
  } catch (e) {
    res.status(500).json({ msg: "Failed to load analytics" });
  }
});


/**
 * ORGANIZER: export participants as CSV
 * GET /api/events/:id/export/participants
 */
router.get("/:id/export/participants", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.id, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found" });

    const tickets = await Ticket.find({ event: ev._id }).populate("participant", "firstName lastName email");

    const rows = tickets.map((t) => ({
      ticketId: t.ticketId,
      status: t.status,
      checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : "",
      firstName: t.participant?.firstName || "",
      lastName: t.participant?.lastName || "",
      email: t.participant?.email || "",
    }));

    const csv = toCSV(rows, ["ticketId", "status", "checkedInAt", "firstName", "lastName", "email"]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="participants_${ev._id}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ msg: "Failed to export" });
  }
});

/**
 * PUBLIC: single event detail
 * GET /api/events/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const e = await Event.findById(req.params.id).populate("organizer", "name firstName lastName email contactEmail").lean();
    if (!e) return res.status(404).json({ msg: "Event not found" });
    res.json(e);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load event" });
  }
});

export default router;
