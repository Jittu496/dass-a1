import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dns from "dns/promises";
import crypto from "crypto";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/ping", (req, res) => res.json({ ok: true }));

router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, participantType, college, contactNumber } = req.body;

    if (!firstName || !lastName || !email || !password || !role)
      return res.status(400).json({ msg: "All fields are required" });

    if (role !== "participant")
      return res.status(400).json({ msg: "Only participants may self-register. Organizer accounts are provisioned by the Admin." });

    if (role === "participant") {
      if (!participantType || !["IIIT", "Non-IIIT"].includes(participantType))
        return res.status(400).json({ msg: "participantType must be IIIT or Non-IIIT" });

      const lower = String(email).toLowerCase();
      const IIIT_DOMAINS = ["@iiit.ac.in", "@students.iiit.ac.in", "@research.iiit.ac.in"];
      if (participantType === "IIIT") {
        if (!IIIT_DOMAINS.some(d => lower.endsWith(d)))
          return res.status(400).json({ msg: "IIIT participants must use a valid IIIT email (@iiit.ac.in / @students.iiit.ac.in / @research.iiit.ac.in)" });
      } else {
        const parts = lower.split("@");
        if (parts.length !== 2) return res.status(400).json({ msg: "Invalid email" });
        const domain = parts[1];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(lower)) return res.status(400).json({ msg: "Invalid email format" });
        try {
          const mx = await dns.resolveMx(domain).catch(() => []);
          if (!mx || mx.length === 0) await dns.resolve(domain);
        } catch (err) {
          return res.status(400).json({ msg: "Email domain does not exist or cannot receive mails" });
        }
      }
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ msg: "Email already registered. Please login." });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ firstName, lastName, email, password: hashed, role, participantType, college: college || '', contactNumber: contactNumber || '' });
    return res.status(201).json({ msg: "Registered successfully", userId: user._id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error during register", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "No user" });

    // Block disabled organizer accounts
    if (user.disabled) return res.status(403).json({ msg: "Account disabled. Contact admin." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Wrong password" });

    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ token: accessToken, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error during login", error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ msg: 'No refresh token' });
    const user = await User.findOne({ refreshTokens: token });
    if (!user) return res.status(401).json({ msg: 'Invalid refresh token' });
    const accessToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token: accessToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Refresh failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const user = await User.findOne({ refreshTokens: token });
      if (user) {
        user.refreshTokens = (user.refreshTokens || []).filter(t => t !== token);
        await user.save();
      }
    }
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.json({ msg: 'Logged out' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Logout failed' });
  }
});

router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  res.json(user);
});

// PUT /api/auth/change-password  { oldPassword, newPassword }
router.put('/change-password', protect, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ msg: 'oldPassword and newPassword are required' });
    if (newPassword.length < 6) return res.status(400).json({ msg: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ msg: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.refreshTokens = []; // invalidate all sessions
    await user.save();

    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.json({ msg: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Change password failed' });
  }
});

export default router;
