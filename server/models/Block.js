import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/**
 * "blockerId blocked blockedId". A block hides each side's dreams and comments from the other and stops
 * notifications and mentions between them.
 *
 * `anonymous` records whether the blocker knew who they were blocking. It is true when the block was made
 * from an anonymous dream (or from the hidden author's comment on one), so the blocked-users list can show
 * "Anonymous user" instead of revealing the identity the app promised to hide.
 */
const blockSchema = new mongoose.Schema(
  {
    blockerId: { type: ObjectId, ref: 'User', required: true },
    blockedId: { type: ObjectId, ref: 'User', required: true },
    anonymous: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockerId: 1, createdAt: -1 });
blockSchema.index({ blockedId: 1 });

export default mongoose.model('Block', blockSchema);
