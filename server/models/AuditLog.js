import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const AUDIT_ACTIONS = [
  'report_dismissed',
  'report_reviewed',
  'content_removed',
  'user_suspended',
  'user_unsuspended',
  'viewed_anonymous_author',
  'auto_hidden',
  'content_restored',
  'appeal_upheld',
  'appeal_overturned',
  'role_changed'
];

/**
 * Append-only record of what administrators did. Entries are never updated or deleted through the API.
 * `snapshot` keeps what was removed, so the evidence survives the deletion.
 */
const auditSchema = new mongoose.Schema(
  {
    /** the person who acted; null for automatic actions (`system: true`) */
    adminId: { type: ObjectId, ref: 'User', default: null },
    system: { type: Boolean, default: false },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, enum: ['dream', 'comment', 'user'], required: true },
    dreamId: { type: ObjectId, default: null },
    commentId: { type: ObjectId, default: null },
    targetUserId: { type: ObjectId, ref: 'User', default: null },
    reportCount: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    snapshot: {
      title: { type: String, default: '' },
      content: { type: String, default: '' }
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ adminId: 1, createdAt: -1 });
auditSchema.index({ targetUserId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditSchema);
