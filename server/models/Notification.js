import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const NOTIFICATION_TYPES = ['comment', 'reply', 'mention', 'like'];

const NINETY_DAYS = 90 * 24 * 60 * 60;

const notificationSchema = new mongoose.Schema(
  {
    /** recipient */
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    /**
     * Who did it. `null` means "hidden": it is set when the actor is the author of an anonymous dream,
     * so the identity is never stored anywhere a bug could leak it.
     */
    actorId: { type: ObjectId, ref: 'User', default: null },
    dreamId: { type: ObjectId, ref: 'Dream' },
    commentId: { type: ObjectId },
    /** `like` notifications are grouped per dream: this is the number of likes behind one row */
    count: { type: Number, default: 1 },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, updatedAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
// Old notifications disappear on their own.
notificationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: NINETY_DAYS });
// One grouped row per dream for likes (makes the upsert race-safe).
notificationSchema.index({ userId: 1, dreamId: 1 }, { unique: true, partialFilterExpression: { type: 'like' } });

export default mongoose.model('Notification', notificationSchema);
