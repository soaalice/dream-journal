import mongoose from 'mongoose';
import { MOODS, PRIVACY_LEVELS } from '../utils/validation.js';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  userId: { type: ObjectId, ref: 'User', required: true },
  /** the comment this one replies to; null for a top-level comment */
  parentId: { type: ObjectId, default: null },
  /**
   * A comment that still has replies is kept as an empty "deleted" placeholder so the thread stays readable.
   * Comments without replies are removed outright.
   */
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  mentions: [{ type: ObjectId, ref: 'User' }]
});

const dreamSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    // Length rules for published dreams are enforced by the zod schemas; drafts may be short.
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    userId: { type: ObjectId, ref: 'User', required: true },
    /** drafts are visible to their author only. Dreams saved before this field existed count as published. */
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    privacyLevel: { type: String, enum: PRIVACY_LEVELS, default: 'private' },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
    mood: { type: String, enum: MOODS, required: true },
    likes: [{ type: ObjectId, ref: 'User' }],
    comments: [commentSchema],
    mentions: [{ type: ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

dreamSchema.index({ title: 'text', content: 'text', tags: 'text' });
dreamSchema.index({ privacyLevel: 1, createdAt: -1 });
dreamSchema.index({ userId: 1, status: 1, createdAt: -1 });
dreamSchema.index({ tags: 1 });

export default mongoose.model('Dream', dreamSchema);
