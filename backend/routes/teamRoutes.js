import express from "express";
import QRCode from "qrcode";
import Team from "../models/Team.js";
import Ticket from "../models/Ticket.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInviteCode() {
  return "TEAM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeInviteToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function makeTicketId() {
  return "TKT-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

/**
 * Generate QR tickets for all team members (called on finalize)
 */
async function generateTeamTickets(team, eventId) {
  const results = [];
  for (const memberId of team.members) {
    // avoid duplicate tickets
    const existing = await Ticket.findOne({ event: eventId, participant: memberId });
    if (existing) { results.push(existing); continue; }

    const ticketId = makeTicketId();
    const qrText = `${ticketId}|${eventId}|${memberId}`;
    const qrDataUrl = await QRCode.toDataURL(qrText);

    const ticket = await Ticket.create({
      event: eventId,
      participant: memberId,
      ticketId,
      qrText,
      qrDataUrl,
      team: team._id
    });
    results.push(ticket);
  }
  return results;
}

// ─── Participant: Create Team ────────────────────────────────────────────────

/**
 * POST /api/teams/create/:eventId
 * Body: { teamName, maxSize }
 */
router.post("/create/:eventId", protect, allowRoles("participant"), async (req, res) => {
  try {
    const ev = await Event.findById(req.params.eventId);
    if (!ev || ev.type !== "hackathon")
      return res.status(404).json({ msg: "Hackathon event not found" });

    if (ev.participationMode !== "team")
      return res.status(400).json({ msg: "This event does not require teams" });

    const { teamName, maxSize: rawSize } = req.body;
    if (!teamName || !teamName.trim())
      return res.status(400).json({ msg: "teamName is required" });

    const maxSize = Number(rawSize || ev.teamSize || 3);
    if (maxSize < 2 || maxSize > 20)
      return res.status(400).json({ msg: "maxSize must be between 2 and 20" });

    // one team per leader per event
    const existing = await Team.findOne({ event: ev._id, leader: req.user.id });
    if (existing)
      return res.status(409).json({ msg: "You already created a team for this event", team: existing });

    // also check if already a member of another team for this event
    const memberOf = await Team.findOne({ event: ev._id, members: req.user.id });
    if (memberOf)
      return res.status(409).json({ msg: "You are already in a team for this event" });

    const inviteCode = makeInviteCode();
    const inviteToken = makeInviteToken();

    const team = await Team.create({
      event: ev._id,
      leader: req.user.id,
      members: [req.user.id],  // leader auto-joins
      teamName: teamName.trim(),
      maxSize,
      inviteCode,
      inviteToken,
      pendingInvites: [],
      status: "forming"
    });

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.status(201).json(populated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to create team" });
  }
});

// ─── Participant: Invite a User ──────────────────────────────────────────────

/**
 * POST /api/teams/:teamId/invite
 * Body: { userId }   — leader invites a specific user
 */
router.post("/:teamId/invite", protect, allowRoles("participant"), async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ msg: "Team not found" });

    if (String(team.leader) !== req.user.id)
      return res.status(403).json({ msg: "Only the leader can invite members" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Team is already finalized" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ msg: "userId is required" });

    if (String(userId) === req.user.id)
      return res.status(400).json({ msg: "Cannot invite yourself" });

    // check user exists
    const invitee = await User.findById(userId);
    if (!invitee || invitee.role !== "participant")
      return res.status(404).json({ msg: "Participant not found" });

    // already a member?
    if (team.members.map(String).includes(String(userId)))
      return res.status(409).json({ msg: "User is already a team member" });

    // already invited (pending)?
    const alreadyInvited = team.pendingInvites.find(
      (inv) => String(inv.user) === String(userId) && inv.status === "pending"
    );
    if (alreadyInvited)
      return res.status(409).json({ msg: "User already has a pending invite" });

    // check if user is in another team for the same event
    const otherTeam = await Team.findOne({ event: team.event, members: userId });
    if (otherTeam)
      return res.status(409).json({ msg: "User is already in another team for this event" });

    if (team.members.length >= team.maxSize)
      return res.status(400).json({ msg: "Team is already full" });

    team.pendingInvites.push({ user: userId, status: "pending" });
    await team.save();

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({ msg: "Invite sent", team: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to send invite" });
  }
});

// ─── Participant: Respond to Invite ─────────────────────────────────────────

/**
 * POST /api/teams/invite/respond
 * Body: { teamId, accept: true|false }
 */
router.post("/invite/respond", protect, allowRoles("participant"), async (req, res) => {
  try {
    const { teamId, accept } = req.body;
    if (!teamId) return res.status(400).json({ msg: "teamId is required" });

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ msg: "Team not found" });

    const invite = team.pendingInvites.find(
      (inv) => String(inv.user) === req.user.id && inv.status === "pending"
    );
    if (!invite) return res.status(404).json({ msg: "No pending invite found" });

    if (!accept) {
      invite.status = "declined";
      await team.save();
      return res.json({ msg: "Invite declined" });
    }

    // Accepting
    if (team.status === "finalized")
      return res.status(400).json({ msg: "Team is already finalized" });

    if (team.members.length >= team.maxSize)
      return res.status(400).json({ msg: "Team is full" });

    // check not in another team for same event
    const otherTeam = await Team.findOne({ event: team.event, members: req.user.id });
    if (otherTeam)
      return res.status(409).json({ msg: "You are already in another team for this event" });

    invite.status = "accepted";
    team.members.push(req.user.id);
    await team.save();

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({ msg: "Joined team!", team: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to respond to invite" });
  }
});

// ─── Participant: Join via Invite Code ──────────────────────────────────────

/**
 * POST /api/teams/join
 * Body: { inviteCode }
 */
router.post("/join", protect, allowRoles("participant"), async (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ msg: "inviteCode is required" });

    const team = await Team.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
    if (!team) return res.status(404).json({ msg: "Invalid invite code" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Team is already finalized" });

    if (team.members.map(String).includes(req.user.id))
      return res.status(409).json({ msg: "You are already in this team" });

    if (team.members.length >= team.maxSize)
      return res.status(400).json({ msg: "Team is full" });

    const otherTeam = await Team.findOne({ event: team.event, members: req.user.id });
    if (otherTeam)
      return res.status(409).json({ msg: "You are already in another team for this event" });

    team.members.push(req.user.id);
    // if there was a pending invite for this user, mark it as accepted
    const pendingInv = team.pendingInvites.find(
      (inv) => String(inv.user) === req.user.id && inv.status === "pending"
    );
    if (pendingInv) pendingInv.status = "accepted";

    await team.save();

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({ msg: "Joined team!", team: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to join team" });
  }
});

// ─── Participant: Join via Invite Link Token ─────────────────────────────────

/**
 * POST /api/teams/join-link
 * Body: { inviteToken }
 */
router.post("/join-link", protect, allowRoles("participant"), async (req, res) => {
  try {
    const { inviteToken } = req.body;
    if (!inviteToken) return res.status(400).json({ msg: "inviteToken is required" });

    const team = await Team.findOne({ inviteToken });
    if (!team) return res.status(404).json({ msg: "Invalid invite link" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Team is already finalized" });

    if (team.members.map(String).includes(req.user.id))
      return res.status(409).json({ msg: "You are already in this team" });

    if (team.members.length >= team.maxSize)
      return res.status(400).json({ msg: "Team is full" });

    const otherTeam = await Team.findOne({ event: team.event, members: req.user.id });
    if (otherTeam)
      return res.status(409).json({ msg: "You are already in another team for this event" });

    team.members.push(req.user.id);
    const pendingInv = team.pendingInvites.find(
      (inv) => String(inv.user) === req.user.id && inv.status === "pending"
    );
    if (pendingInv) pendingInv.status = "accepted";

    await team.save();

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({ msg: "Joined team via invite link!", team: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to join via link" });
  }
});

// ─── Participant: Finalize Team ──────────────────────────────────────────────

/**
 * POST /api/teams/:teamId/finalize
 * Leader finalizes the team — auto-generates tickets for all members
 */
router.post("/:teamId/finalize", protect, allowRoles("participant"), async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ msg: "Team not found" });

    if (String(team.leader) !== req.user.id)
      return res.status(403).json({ msg: "Only the leader can finalize the team" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Team is already finalized" });

    if (team.members.length < 2)
      return res.status(400).json({ msg: "At least 2 members are required to finalize" });

    team.status = "finalized";
    await team.save();

    // Auto-generate tickets for all members
    const tickets = await generateTeamTickets(team, team.event);

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({
      msg: `Team finalized! ${tickets.length} ticket(s) generated.`,
      team: populated,
      ticketsGenerated: tickets.length
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to finalize team" });
  }
});

// ─── Participant: Leave Team ─────────────────────────────────────────────────

/**
 * DELETE /api/teams/:teamId/leave
 * Non-leader members only
 */
router.delete("/:teamId/leave", protect, allowRoles("participant"), async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ msg: "Team not found" });

    if (String(team.leader) === req.user.id)
      return res.status(400).json({ msg: "Leader cannot leave — disband the team instead" });

    if (!team.members.map(String).includes(req.user.id))
      return res.status(400).json({ msg: "You are not in this team" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Cannot leave a finalized team" });

    team.members = team.members.filter((m) => String(m) !== req.user.id);
    // mark any pending invite as declined
    const inv = team.pendingInvites.find((i) => String(i.user) === req.user.id);
    if (inv) inv.status = "declined";

    await team.save();
    res.json({ msg: "Left team successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to leave team" });
  }
});

// ─── Participant (Leader): Remove Member ─────────────────────────────────────

/**
 * DELETE /api/teams/:teamId/members/:userId
 */
router.delete("/:teamId/members/:userId", protect, allowRoles("participant"), async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ msg: "Team not found" });

    if (String(team.leader) !== req.user.id)
      return res.status(403).json({ msg: "Only the leader can remove members" });

    if (String(req.params.userId) === req.user.id)
      return res.status(400).json({ msg: "Leader cannot remove themselves" });

    if (team.status === "finalized")
      return res.status(400).json({ msg: "Cannot modify a finalized team" });

    team.members = team.members.filter((m) => String(m) !== req.params.userId);
    await team.save();

    const populated = await Team.findById(team._id)
      .populate("event", "name type")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json({ msg: "Member removed", team: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to remove member" });
  }
});

// ─── Participant: My Team ────────────────────────────────────────────────────

/**
 * GET /api/teams/mine
 * Returns all teams the user is in (leader or member), for all events
 */
router.get("/mine", protect, allowRoles("participant"), async (req, res) => {
  try {
    const teams = await Team.find({ members: req.user.id })
      .populate("event", "name type startDate")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");
    res.json(teams);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to load your teams" });
  }
});

// ─── Participant: Pending Invites ────────────────────────────────────────────

/**
 * GET /api/teams/invites/pending
 * Returns all teams where the user has a pending invite
 */
router.get("/invites/pending", protect, allowRoles("participant"), async (req, res) => {
  try {
    const teams = await Team.find({
      "pendingInvites": {
        $elemMatch: { user: req.user.id, status: "pending" }
      }
    })
      .populate("event", "name type startDate")
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email");

    // Return simplified invite objects
    const invites = teams.map((t) => {
      const inv = t.pendingInvites.find(
        (i) => String(i.user) === req.user.id && i.status === "pending"
      );
      return {
        _id: inv._id,
        teamId: t._id,
        teamName: t.teamName,
        inviteCode: t.inviteCode,
        event: t.event,
        leader: t.leader,
        memberCount: t.members.length,
        maxSize: t.maxSize,
        invitedAt: inv.invitedAt
      };
    });

    res.json(invites);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to load pending invites" });
  }
});

// ─── Organizer: Teams for an Event ───────────────────────────────────────────

/**
 * GET /api/teams/event/:eventId
 * Lists all teams for a hackathon event (organizer must own the event)
 */
router.get("/event/:eventId", protect, allowRoles("organizer"), async (req, res) => {
  try {
    const ev = await Event.findOne({ _id: req.params.eventId, organizer: req.user.id });
    if (!ev) return res.status(403).json({ msg: "Event not found or access denied" });

    const teams = await Team.find({ event: ev._id })
      .populate("leader", "firstName lastName email")
      .populate("members", "firstName lastName email")
      .populate("pendingInvites.user", "firstName lastName email");

    res.json(teams);
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to load event teams" });
  }
});

// ─── Participant: Get Team by Invite Token (for link join page) ───────────────

/**
 * GET /api/teams/invite-link/:token
 * Public (but auth required) — preview team info before joining via link
 */
router.get("/invite-link/:token", protect, allowRoles("participant"), async (req, res) => {
  try {
    const team = await Team.findOne({ inviteToken: req.params.token })
      .populate("event", "name type startDate")
      .populate("leader", "firstName lastName email");

    if (!team) return res.status(404).json({ msg: "Invalid invite link" });

    res.json({
      teamId: team._id,
      teamName: team.teamName,
      event: team.event,
      leader: team.leader,
      memberCount: team.members.length,
      maxSize: team.maxSize,
      status: team.status,
      inviteToken: team.inviteToken
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ msg: "Failed to load invite info" });
  }
});

export default router;
