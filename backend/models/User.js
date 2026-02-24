import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // ── Auth fields (all roles) ──────────────────────────────────
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["participant", "organizer", "admin"], required: true },

    // ── Participant fields ───────────────────────────────────────
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    participantType: { type: String, enum: ["IIIT", "Non-IIIT"], default: "Non-IIIT" },
    college: { type: String, default: "" },
    interests: [{ type: String }],
    followingOrganizers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Organizer fields (match target document format) ──────────
    name: { type: String, default: "" },          // club/org display name
    category: { type: String, enum: ["Club", "Council", "Fest Team", "Sports", "Technical", "Cultural", "Other"], default: "Club" },
    description: { type: String, default: "" },
    contactEmail: { type: String, default: "" },          // club's public contact email
    contactNumber: { type: String, default: "" },          // club's contact number
    loginEmail: { type: String, default: "" },          // mirror of email, stored for document clarity
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    discordWebhook: { type: String, default: "" },

    // ── Admin control ────────────────────────────────────────────
    disabled: { type: Boolean, default: false },

    // ── Session management ───────────────────────────────────────
    refreshTokens: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
