import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/**
 * An author's request for a second look at a moderation decision: a removed dream or comment, or a suspended
 * account. Nothing is deleted when content is removed, so overturning an appeal can simply restore it.
 */
const appealSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['dream', 'comment', 'account'], required: true },
    dreamId: { type: ObjectId, default: null },
    commentId: { type: ObjectId, default: null },
    /** what the person says (≤1000 characters) */
    message: { type: String, trim: true, required: true, maxlength: 1000 },
    /** what was moderated and why, kept so the appeal still reads well if the content changes */
    snapshot: {
      title: { type: String, default: '' },
      content: { type: String, default: '', maxlength: 2000 },
      moderationMessage: { type: String, default: '' }
    },
    /** the moderator whose decision is being appealed (they cannot decide their own appeal) */
    decidedBy: { type: ObjectId, ref: 'User', default: null },
    notificationId: { type: ObjectId, ref: 'Notification', default: null },
    status: { type: String, enum: ['open', 'upheld', 'overturned'], default: 'open' },
    resolvedBy: { type: ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '', maxlength: 500 }
  },
  { timestamps: true }
);

appealSchema.index({ status: 1, createdAt: 1 });
appealSchema.index({ userId: 1, createdAt: -1 });
// One appeal per piece of moderated content (and one per account until it is decided).
appealSchema.index({ userId: 1, targetType: 1, dreamId: 1, commentId: 1 }, { unique: true, partialFilterExpression: { targetType: { $in: ['dream', 'comment'] } } });
appealSchema.index({ userId: 1, targetType: 1 }, { unique: true, partialFilterExpression: { targetType: 'account', status: 'open' } });

export default mongoose.model('Appeal', appealSchema);
