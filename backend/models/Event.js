import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["normal", "merch", "hackathon"], required: true },

    eligibility: { type: String, default: "All" },
    tags: [{ type: String }],

    registrationDeadline: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    registrationLimit: { type: Number, default: 0 }, // 0 = unlimited
    fee: { type: Number, default: 0 },

    // merch
    stock: { type: Number, default: 0 },

    // merch distribution details
    distributionVenue: { type: String, default: "" },
    // whether the distribution venue is confirmed (organizers can mark true when venue is locked)
    distributionVenueConfirmed: { type: Boolean, default: false },
    // dynamic registration form for Normal events (array of fields)
    registrationForm: { type: Array, default: [] },
    // once first registration received, form becomes locked and cannot be edited
    registrationFormLocked: { type: Boolean, default: false },

    // merch variants (for merchandise events): array of variant objects
    variants: [
      {
        id: { type: String },
        name: { type: String, default: "" },
        size: { type: String, default: "" },
        color: { type: String, default: "" },
        stock: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
        perParticipantLimit: { type: Number, default: 1 }
      }
    ],

    // ✅ hackathon
    participationMode: {
      type: String,
      enum: ["individual", "team"],
      default: "individual",
    },
    teamSize: {
      type: Number,
      default: 1,
      min: 1,
    },

    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "completed", "closed"],
      default: "draft",
    },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// ✅ Extra safety: if it's not a hackathon, force hackathon fields to default
eventSchema.pre("save", function (next) {
  if (this.type !== "hackathon") {
    this.participationMode = "individual";
    this.teamSize = 1;
  } else {
    // hackathon rules
    if (this.participationMode === "team" && (!this.teamSize || this.teamSize < 2)) {
      this.teamSize = 2; // minimum 2 for teams
    }
    if (this.participationMode === "individual") {
      this.teamSize = 1;
    }
  }
  next();
});

// ── Indexes for fast queries ─────────────────────────────────────
eventSchema.index({ status: 1, startDate: 1 });               // browse events sort
eventSchema.index({ organizer: 1, status: 1 });               // organizer's events
eventSchema.index({ status: 1, organizer: 1, startDate: 1 }); // clubs detail page
eventSchema.index({ name: "text", description: "text" });      // full-text search

export default mongoose.model("Event", eventSchema);

