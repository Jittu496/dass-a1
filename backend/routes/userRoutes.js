import express from "express";
import User from "../models/User.js";
import Event from "../models/Event.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// GET /api/users/me/preferences
router.get('/me/preferences', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('interests followingOrganizers role').populate('followingOrganizers', 'name firstName lastName email category description contactEmail contactNumber followers');
    const organizers = await User.find({ role: 'organizer', disabled: { $ne: true } }).select('name firstName lastName email loginEmail category description contactEmail contactNumber followers isActive');
    return res.json({
      preferences: { interests: user.interests || [], followingOrganizers: (user.followingOrganizers || []).map(o => o._id) },
      organizers
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to load preferences' });
  }
});

// PUT /api/users/me/preferences { interests, followingOrganizers }
router.put('/me/preferences', protect, async (req, res) => {
  try {
    const { interests = [], followingOrganizers = [] } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role !== 'participant') return res.status(403).json({ msg: 'Only participants may set preferences' });

    user.interests = (Array.isArray(interests) ? interests : []).map(s => String(s).trim()).filter(Boolean);
    user.followingOrganizers = Array.isArray(followingOrganizers) ? followingOrganizers : [];
    await user.save();

    return res.json({ msg: 'Preferences saved', preferences: { interests: user.interests, followingOrganizers: user.followingOrganizers } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to save preferences' });
  }
});

// PUT /api/users/me - update basic profile fields (participant: firstName, lastName, contactNumber, college)
router.put('/me', protect, async (req, res) => {
  try {
    const { firstName, lastName, contactNumber, college } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (firstName) user.firstName = String(firstName).trim();
    if (lastName) user.lastName = String(lastName).trim();
    if (typeof contactNumber !== 'undefined') user.contactNumber = String(contactNumber).trim();
    if (typeof college !== 'undefined') user.college = String(college).trim();

    await user.save();
    const safe = user.toObject(); delete safe.password; delete safe.refreshTokens;
    return res.json({ msg: 'Profile updated', user: safe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to update profile' });
  }
});

// PUT /api/users/me/organizer-profile - update organizer profile fields
router.put('/me/organizer-profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role !== 'organizer') return res.status(403).json({ msg: 'Only organizers can update organizer profile' });

    const { name, firstName, lastName, category, description, contactEmail, contactNumber, discordWebhook } = req.body;
    const VALID_CATS = ['Club', 'Council', 'Fest Team', 'Sports', 'Technical', 'Cultural', 'Other'];
    if (name) user.name = String(name).trim();
    if (firstName) user.firstName = String(firstName).trim();
    if (lastName) user.lastName = String(lastName).trim();
    if (category && VALID_CATS.includes(category)) user.category = category;
    if (typeof description !== 'undefined') user.description = String(description).trim();
    if (typeof contactEmail !== 'undefined') user.contactEmail = String(contactEmail).trim();
    if (typeof contactNumber !== 'undefined') user.contactNumber = String(contactNumber).trim();
    if (typeof discordWebhook !== 'undefined') user.discordWebhook = String(discordWebhook).trim();

    await user.save();
    const safe = user.toObject(); delete safe.password; delete safe.refreshTokens;
    return res.json({ msg: 'Organizer profile updated', user: safe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to update organizer profile' });
  }
});

// GET /api/users/organizers - public list of all active organizers
router.get('/organizers', async (req, res) => {
  try {
    const organizers = await User.find({ role: 'organizer', disabled: { $ne: true } })
      .select('name firstName lastName category description contactEmail contactNumber email loginEmail followers isActive')
      .sort({ name: 1, firstName: 1 });
    res.json(organizers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to load organizers' });
  }
});

// GET /api/users/organizers/:id - public organizer detail + events
router.get('/organizers/:id', async (req, res) => {
  try {
    const organizer = await User.findOne({ _id: req.params.id, role: 'organizer', disabled: { $ne: true } })
      .select('name firstName lastName category description contactEmail contactNumber email loginEmail followers isActive');
    if (!organizer) return res.status(404).json({ msg: 'Organizer not found' });

    const now = new Date();
    const [upcoming, past] = await Promise.all([
      Event.find({ organizer: organizer._id, status: { $in: ['published', 'ongoing'] }, startDate: { $gte: now } }).sort({ startDate: 1 }),
      Event.find({ organizer: organizer._id, status: { $in: ['completed', 'closed'] } }).sort({ endDate: -1 }).limit(10),
    ]);

    res.json({ organizer, upcoming, past });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to load organizer detail' });
  }
});

// GET /api/users/search?q= — participant search for team invites
router.get('/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const regex = { $regex: q, $options: 'i' };
    const users = await User.find({
      role: 'participant',
      _id: { $ne: req.user.id }, // exclude self
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex }
      ]
    })
      .select('firstName lastName email')
      .limit(10);

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Search failed' });
  }
});

export default router;

