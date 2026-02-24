import mongoose from "mongoose";

const passwordResetRequestSchema = new mongoose.Schema(
  {
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decisionNote: { type: String, default: "" },
    newPasswordTemp: { type: String, default: "" } // store temp (demo); in real do email
  },
  { timestamps: true }
);

export default mongoose.model("PasswordResetRequest", passwordResetRequestSchema);
