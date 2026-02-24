import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true }, // merch event
    participant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    quantity: { type: Number, default: 1 },
    amount: { type: Number, required: true },
    // selected variant for merch (if any)
    variantId: { type: String },
    variantSnapshot: { type: Object, default: {} },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    paymentProofPath: { type: String, default: "" },
    decisionNote: { type: String, default: "" },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    batchId: { type: String, default: "" },   // shared ID for multi-variant orders placed together

  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
