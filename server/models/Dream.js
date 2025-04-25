import mongoose from 'mongoose';

const dreamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    minlength: 10
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  privacyLevel: {
    type: String,
    enum: ['public', 'private', 'anonymous'],
    default: 'private'
  },
  tags: [{
    type: String,
    trim: true
  }],
  mood: {
    type: String,
    enum: ['happy', 'sad', 'scary', 'confusing', 'exciting', 'peaceful', 'anxious', 'mysterious'],
    required: true
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    content: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Index for searching
dreamSchema.index({ title: 'text', content: 'text', tags: 'text' });

const Dream = mongoose.model('Dream', dreamSchema);

export default Dream;