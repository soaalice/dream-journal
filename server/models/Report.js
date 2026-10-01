import mongoose from 'mongoose';

import { REPORT_REASONS } from '../utils/validation.js';

const { ObjectId } = mongoose.Schema.Types;


/**
 * A user's report of a dream or a comment. Stored for moderators only: reports are never returned by the API,
 * and `reportedUserId` is a server-side snapshot (so anonymous authors can be actioned without being exposed).
 */
const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['dream', 'comment'], required: true },
    dreamId: { type: ObjectId, ref: 'Dream', required: true },
    commentId: { type: ObjectId, default: null },
    reportedUserId: { type: ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500, default: '' },
    /** what was reported, kept so moderators still have the evidence if the author deletes it */
    snapshot: {
      title: { type: String, default: '' },
      content: { type: String, default: '', maxlength: 2000 }
    },
    status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
    resolvedBy: { type: ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '', maxlength: 500 }
  },
  { timestamps: true }
);

// One report per person per target stops repeated reporting.
reportSchema.index({ reporterId: 1, targetType: 1, dreamId: 1, commentId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ dreamId: 1, commentId: 1, status: 1 });
reportSchema.index({ reportedUserId: 1 });

export default mongoose.model('Report', reportSchema);
