import express from "express";
import Feedback from "../models/Feedback.js";
import Event from "../models/Event.js";
import Ticket from "../models/Ticket.js";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * PARTICIPANT: Submit anonymous feedback for an attended event.
 * POST /api/feedback/:eventId  { rating, comment }
 *
 * Rules:
 *  - Participant must have a ticket for the event (attended check).
 *  - Only one feedback submission per participant per event.
 *  - Feedback is stored WITHOUT any participant identifier (anonymous).
 */
router.post("/:eventId", protect, allowRoles("participant"), async (req, res) => {
  try {
    const ev = await Event.findById(req.params.eventId);
    if (!ev) return res.status(404).json({ msg: "Event not found" });

    // Must have attended (have a ticket for this event)
    const ticket = await Ticket.findOne({ event: ev._id, participant: req.user.id });
    if (!ticket) return res.status(403).json({ msg: "You must be registered for this event to submit feedback" });

    // Feedback only allowed after the event has ended
    if (ev.endDate && new Date() < new Date(ev.endDate))
      return res.status(403).json({ msg: "Feedback opens after the event ends" });

    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim().slice(0, 1000);
    if (!(rating >= 1 && rating <= 5))
      return res.status(400).json({ msg: "Rating must be between 1 and 5" });

    // One-submission guard: use a hash of (event + participant) stored separately
    // We use a dedupKey that is NOT stored with the feedback itself — just for dedup.
    const dedupKey = `${ev._id}:${req.user.id}`;
    const already = await Feedback.findOne({ dedupKey });
    if (already) return res.status(409).json({ msg: "You have already submitted feedback for this event" });

    const f = await Feedback.create({ event: ev._id, rating, comment, dedupKey });

    // Return feedback without dedupKey to keep it anonymous in the response
    res.status(201).json({ msg: "Feedback submitted anonymously", feedback: { rating: f.rating, comment: f.comment, createdAt: f.createdAt } });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * ORGANIZER: Aggregated feedback stats + filtered list.
 * GET /api/feedback/:eventId/aggregate?rating=&page=&limit=
 */
router.get("/:eventId/aggregate", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.eventId, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found or not yours" });

    // ── All feedback for stats ──────────────────────────────────
    const all = await Feedback.find({ event: ev._id }).lean();
    const count = all.length;
    const avg = count ? all.reduce((s, x) => s + x.rating, 0) / count : 0;

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const f of all) dist[f.rating] = (dist[f.rating] || 0) + 1;

    // % breakdown
    const pct = {};
    for (let r = 1; r <= 5; r++) pct[r] = count ? Math.round((dist[r] / count) * 100) : 0;

    // ── Filtered + paginated list ───────────────────────────────
    const ratingFilter = Number(req.query.rating) || 0;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 20);

    const q = { event: ev._id };
    if (ratingFilter >= 1 && ratingFilter <= 5) q.rating = ratingFilter;

    const total = await Feedback.countDocuments(q);
    const recent = await Feedback.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-dedupKey")   // never expose dedup key
      .lean();

    res.json({
      count,
      avg: Number(avg.toFixed(2)),
      dist,
      pct,
      filtered: { total, page, limit, items: recent },
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/**
 * ORGANIZER: Export feedback as CSV.
 * GET /api/feedback/:eventId/export
 */
router.get("/:eventId/export", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.eventId, organizer: req.user.id });
    if (!ev) return res.status(404).json({ msg: "Event not found or not yours" });

    const all = await Feedback.find({ event: ev._id })
      .sort({ createdAt: -1 })
      .select("-dedupKey")
      .lean();

    // Build CSV
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["#", "Rating", "Comment", "Submitted At"];
    const rows = all.map((f, i) => [
      i + 1,
      f.rating,
      escape(f.comment || ""),
      new Date(f.createdAt).toISOString(),
    ].join(","));

    const csv = [header.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="feedback_${ev._id}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

export default router;
