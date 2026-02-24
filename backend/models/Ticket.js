import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    ticketId: { type: String, required: true, unique: true },
    qrText: { type: String, required: true },
    qrDataUrl: { type: String, required: true },

    status: { type: String, enum: ["active", "cancelled", "used"], default: "active" },
    checkedInAt: { type: Date },

    // store registration form responses (fieldKey: value)
    registrationResponses: { type: Object, default: {} },

    // optional: reference to the team (for hackathon team registrations)
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null }
  },
  { timestamps: true }
);

ticketSchema.index({ event: 1, participant: 1 }, { unique: true });

export default mongoose.model("Ticket", ticketSchema);
