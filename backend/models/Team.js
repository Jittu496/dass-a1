import mongoose from "mongoose";

const pendingInviteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  invitedAt: { type: Date, default: Date.now }
}, { _id: true });

const teamSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    teamName: { type: String, required: true, trim: true },
    maxSize: { type: Number, required: true },
    inviteCode: { type: String, required: true, unique: true },
    inviteToken: { type: String, required: true, unique: true }, // for link-based joining

    // pending invites sent by the leader
    pendingInvites: [pendingInviteSchema],

    status: { type: String, enum: ["forming", "finalized"], default: "forming" }
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
