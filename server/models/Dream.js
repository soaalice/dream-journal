import mongoose from 'mongoose';
import { MOODS, PRIVACY_LEVELS } from '../utils/validation.js';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true, trim: true, maxlength: 1000 },
  userId: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  mentions: [{ type: ObjectId, ref: 'User' }]
});

const dreamSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, minlength: 10, maxlength: 10000 },
    userId: { type: ObjectId, ref: 'User', required: true },
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
dreamSchema.index({ userId: 1, createdAt: -1 });
dreamSchema.index({ tags: 1 });

export default mongoose.model('Dream', dreamSchema);
