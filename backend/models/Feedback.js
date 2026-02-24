import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
    // dedupKey prevents duplicate submissions without storing the userId in the feedback doc.
    // It is NEVER returned in API responses — the feedback itself remains fully anonymous.
    dedupKey: { type: String, select: false, index: true, sparse: true },
  },
  { timestamps: true }
);

feedbackSchema.index({ event: 1, createdAt: -1 });
feedbackSchema.index({ event: 1, rating: 1 });

export default mongoose.model("Feedback", feedbackSchema);
