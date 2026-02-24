import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

/**
 * ADMIN: create organizer
 * POST /api/admin/organizers
 */
router.post("/organizers", protect, allowRoles("admin"), async (req, res) => {
  try {
    let {
      name = "",
      category = "Club",
      description = "",
      contactEmail = "",
      contactNumber = "",
    } = req.body;

    name = name.trim();
    if (!name) return res.status(400).json({ msg: "Club/Organizer name is required" });

    const VALID_CATEGORIES = ["Club", "Council", "Fest Team", "Sports", "Technical", "Cultural", "Other"];
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ msg: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` });

    // Auto-generate a login email from the club name
    const makeSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24);
    const base = makeSlug(name);
    let attempt = 0, candidate;
    do {
      candidate = `${base}@felicity.com`;
      // append a counter suffix if collision
      if (attempt > 0) candidate = `${base}_${attempt}@felicity.com`;
      attempt++;
    } while ((await User.findOne({ email: candidate })) && attempt < 20);

    if (await User.findOne({ email: candidate }))
      return res.status(500).json({ msg: "Failed to generate unique login email, try again" });

    const loginEmail = candidate;
    const tempPassword = "Org@" + Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPassword, 10);

    const organizer = await User.create({
      // auth
      email: loginEmail,
      password: hashed,
      role: "organizer",
      // organizer document fields (target format)
      name,
      category,
      description,
      contactEmail,
      contactNumber,
      loginEmail,                        // mirror for document readability
      createdBy: req.user.id,            // admin who created it
      followers: [],
      isActive: true,
      isArchived: false,
      // participant fields left at defaults (empty strings)
      firstName: name.split(" ")[0] || name,  // fallback so populated refs show something
      lastName: "",
    });

    res.status(201).json({
      msg: "Organizer created",
      organizerId: organizer._id,
      loginEmail,
      tempPassword,
      // legacy key for any frontend that reads 'email'
      email: loginEmail,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message || "Server error" });
  }
});


/**
 * ADMIN: list organizers
 */
router.get("/organizers", protect, allowRoles("admin"), async (req, res) => {
  const organizers = await User.find({ role: "organizer" }).select("-password").sort({ createdAt: -1 });
  res.json(organizers);
});

/**
 * ADMIN: delete organizer permanently
 */
router.delete("/organizers/:id", protect, allowRoles("admin"), async (req, res) => {
  const u = await User.findOneAndDelete({ _id: req.params.id, role: "organizer" });
  if (!u) return res.status(404).json({ msg: "Organizer not found" });
  res.json({ msg: "Deleted" });
});

/**
 * ADMIN: disable or enable organizer account (toggle)
 * PATCH /api/admin/organizers/:id/disable  { disabled: true/false }
 */
router.patch("/organizers/:id/disable", protect, allowRoles("admin"), async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, role: "organizer" });
  if (!u) return res.status(404).json({ msg: "Organizer not found" });

  // support explicit value or toggle
  const setDisabled = typeof req.body.disabled === 'boolean' ? req.body.disabled : !u.disabled;
  u.disabled = setDisabled;

  // If disabling, revoke all refresh tokens so existing sessions die immediately
  if (setDisabled) u.refreshTokens = [];

  await u.save();
  res.json({ msg: setDisabled ? "Account disabled" : "Account enabled", disabled: u.disabled });
});

/**
 * ORGANIZER: request password reset
 * POST /api/admin/password-reset/request
 */
router.post("/password-reset/request", protect, allowRoles("organizer"), async (req, res) => {
  const existing = await PasswordResetRequest.findOne({ organizer: req.user.id, status: "pending" });
  if (existing) return res.status(409).json({ msg: "Already pending", request: existing });

  const r = await PasswordResetRequest.create({ organizer: req.user.id, status: "pending", reason: req.body.reason || "" });
  res.status(201).json(r);
});

/**
 * ADMIN: view reset requests
 */
router.get("/password-reset", protect, allowRoles("admin"), async (req, res) => {
  const reqs = await PasswordResetRequest.find().populate("organizer", "firstName lastName email").sort({ createdAt: -1 });
  res.json(reqs);
});

/**
 * ADMIN: decide reset request
 * POST /api/admin/password-reset/:id/decide { status, note }
 */
router.post("/password-reset/:id/decide", protect, allowRoles("admin"), async (req, res) => {
  const { status, note = "" } = req.body;
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ msg: "Invalid status" });

  const r = await PasswordResetRequest.findById(req.params.id).populate("organizer");
  if (!r) return res.status(404).json({ msg: "Request not found" });
  if (r.status !== "pending") return res.status(409).json({ msg: "Already decided" });

  r.status = status;
  r.decisionNote = note;
  r.decidedBy = req.user.id;

  if (status === "approved") {
    const tempPassword = "Reset@" + Math.random().toString(36).slice(2, 10);
    const hashed = await bcrypt.hash(tempPassword, 10);
    await User.updateOne({ _id: r.organizer._id }, { password: hashed, refreshTokens: [] });
    r.newPasswordTemp = tempPassword;
  }

  await r.save();
  res.json({ msg: "Decision saved", request: r });
});

export default router;
