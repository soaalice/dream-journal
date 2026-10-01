import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const NOTIFICATION_TYPES = ['comment', 'reply', 'mention', 'like', 'moderation', 'appeal'];

/** What happened, for `moderation` notifications. */
export const MODERATION_EVENTS = ['removed', 'hidden', 'restored', 'appeal_upheld', 'appeal_overturned'];

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
    /**
     * `moderation` notifications tell an author what moderators did to their content. They carry their own copy of
     * the text, so they still make sense if the content is later deleted.
     */
    moderation: {
      event: { type: String, enum: MODERATION_EVENTS },
      kind: { type: String, enum: ['dream', 'comment'] },
      title: { type: String, default: '' },
      excerpt: { type: String, default: '', maxlength: 300 },
      message: { type: String, default: '', maxlength: 300 },
      reasons: [{ type: String }]
    },
    /**
     * `appeal` notifications tell staff that an author appealed a decision (`appealId` points at the appeal). They carry
     * their own copy of what is needed to recognise it in the inbox.
     */
    staff: {
      targetType: { type: String, enum: ['dream', 'comment', 'account'] },
      title: { type: String, default: '' },
      excerpt: { type: String, default: '', maxlength: 300 },
      authorName: { type: String, default: '' }
    },
    /** set once the author appealed the decision this notification is about */
    appealId: { type: ObjectId, ref: 'Appeal', default: null },
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
