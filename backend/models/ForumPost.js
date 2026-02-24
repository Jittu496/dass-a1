import mongoose from "mongoose";

const forumPostSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    message: { type: String, required: true },

    // "message" (default) or "announcement" (organizer only)
    type: { type: String, enum: ["message", "announcement"], default: "message" },

    // thread support — replies point to their parent
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "ForumPost", default: null },

    // organizer can pin important messages
    pinned: { type: Boolean, default: false },

    // soft-delete — deleted posts are hidden from clients
    deleted: { type: Boolean, default: false },

    // reactions: emoji → [userId strings]
    reactions: {
      type: Map,
      of: [String],
      default: {}
    }
  },
  { timestamps: true }
);

// Index for fast per-event queries
forumPostSchema.index({ event: 1, createdAt: 1 });

export default mongoose.model("ForumPost", forumPostSchema);
