import express from "express";
import ForumPost from "../models/ForumPost.js";
import Event from "../models/Event.js";
import Ticket from "../models/Ticket.js";
import Order from "../models/Order.js";
import { protect } from "../middleware/auth.js";
import { getIO } from "../utils/socket.js";

const router = express.Router();

/* ─────────────────────────────────────────────────────────────────
   ACCESS GUARD
   Participants: must have a ticket (or approved order for merch)
   Organizers:  must own the event
   ───────────────────────────────────────────────────────────────── */
async function checkAccess(req, eventId) {
  const event = await Event.findById(eventId);
  if (!event) return { ok: false, status: 404, msg: "Event not found" };

  if (req.user.role === "organizer") {
    if (String(event.organizer) !== String(req.user.id))
      return { ok: false, status: 403, msg: "Not your event" };
    return { ok: true, event, isOrganizer: true };
  }

  if (req.user.role === "participant") {
    // has a ticket (normal / hackathon registration)
    const ticket = await Ticket.exists({ event: event._id, participant: req.user.id });
    if (ticket) return { ok: true, event, isOrganizer: false };

    // OR has an approved merch order for this event
    const order = await Order.exists({ event: event._id, participant: req.user.id, status: "approved" });
    if (order) return { ok: true, event, isOrganizer: false };

    return { ok: false, status: 403, msg: "Register for this event to join the discussion" };
  }

  return { ok: false, status: 403, msg: "Access denied" };
}

function emit(event, name, payload) {
  try {
    const io = getIO();
    if (io) io.to(`event:${event._id}`).emit(name, payload);
  } catch (e) {
    console.warn("Forum emit error:", e.message);
  }
}

/* ─────────────────────────────────────────────────────────────────
   GET  /:eventId  — list all posts (pinned first, then chron.)
   ───────────────────────────────────────────────────────────────── */
router.get("/:eventId", protect, async (req, res) => {
  try {
    const access = await checkAccess(req, req.params.eventId);
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });

    const posts = await ForumPost.find({
      event: req.params.eventId,
      deleted: false,
    })
      .sort({ pinned: -1, createdAt: 1 })
      .populate("author", "firstName lastName role")
      .lean();

    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────
   POST  /:eventId  — create message or announcement
   Body: { message, type?, parentId? }
   ───────────────────────────────────────────────────────────────── */
router.post("/:eventId", protect, async (req, res) => {
  try {
    const access = await checkAccess(req, req.params.eventId);
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });

    const { message, type = "message", parentId } = req.body;
    if (!message?.trim()) return res.status(400).json({ msg: "message required" });

    // only organizer can post announcements
    const postType = (type === "announcement" && access.isOrganizer) ? "announcement" : "message";

    const post = await ForumPost.create({
      event: access.event._id,
      author: req.user.id,
      message: message.trim(),
      type: postType,
      parentId: parentId || null,
    });

    const populated = await ForumPost.findById(post._id)
      .populate("author", "firstName lastName role")
      .lean();

    emit(access.event, "newPost", populated);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────
   DELETE  /:eventId/:postId  — soft-delete (organizer only)
   ───────────────────────────────────────────────────────────────── */
router.delete("/:eventId/:postId", protect, async (req, res) => {
  try {
    const access = await checkAccess(req, req.params.eventId);
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });
    if (!access.isOrganizer) return res.status(403).json({ msg: "Organizers only" });

    const post = await ForumPost.findOneAndUpdate(
      { _id: req.params.postId, event: req.params.eventId },
      { deleted: true },
      { new: true }
    );
    if (!post) return res.status(404).json({ msg: "Post not found" });

    emit(access.event, "deletedPost", { postId: post._id });
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────
   PATCH  /:eventId/:postId/pin  — toggle pin (organizer only)
   ───────────────────────────────────────────────────────────────── */
router.patch("/:eventId/:postId/pin", protect, async (req, res) => {
  try {
    const access = await checkAccess(req, req.params.eventId);
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });
    if (!access.isOrganizer) return res.status(403).json({ msg: "Organizers only" });

    const post = await ForumPost.findOne({ _id: req.params.postId, event: req.params.eventId });
    if (!post) return res.status(404).json({ msg: "Post not found" });

    post.pinned = !post.pinned;
    await post.save();

    emit(access.event, "pinnedPost", { postId: post._id, pinned: post.pinned });
    res.json({ pinned: post.pinned });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────────────
   POST  /:eventId/:postId/react  — toggle emoji reaction
   Body: { emoji }  (one of 👍 ❤️ 😂 🙌)
   ───────────────────────────────────────────────────────────────── */
const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🙌"];

router.post("/:eventId/:postId/react", protect, async (req, res) => {
  try {
    const access = await checkAccess(req, req.params.eventId);
    if (!access.ok) return res.status(access.status).json({ msg: access.msg });

    const { emoji } = req.body;
    if (!ALLOWED_REACTIONS.includes(emoji))
      return res.status(400).json({ msg: "Invalid emoji" });

    const post = await ForumPost.findOne({ _id: req.params.postId, event: req.params.eventId });
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const userId = String(req.user.id);
    const current = post.reactions.get(emoji) || [];
    if (current.includes(userId)) {
      // toggle off
      post.reactions.set(emoji, current.filter((u) => u !== userId));
    } else {
      post.reactions.set(emoji, [...current, userId]);
    }
    await post.save();

    // send plain object for socket
    const reactionsObj = {};
    post.reactions.forEach((v, k) => { reactionsObj[k] = v; });
    emit(access.event, "reactedPost", { postId: post._id, reactions: reactionsObj });
    res.json({ reactions: reactionsObj });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

export default router;
