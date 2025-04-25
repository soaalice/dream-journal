import express from 'express';
import Dream from '../models/Dream.js';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get public dreams feed
router.get('/feed', async (req, res) => {
  try {
    const { page = 1, limit = 10, tag, mood } = req.query;
    
    const query = { privacyLevel: { $in: ['public', 'anonymous'] } };
    
    if (tag) query.tags = tag;
    if (mood) query.mood = mood;
    
    const dreams = await Dream.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name avatarUrl');
      
    res.json(dreams);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dreams' });
  }
});

router.use(authenticateToken);

// Get user's dreams
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { privacyLevel } = req.query;
    
    const query = { userId };
    if (privacyLevel) query.privacyLevel = privacyLevel;
    
    const dreams = await Dream.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'name avatarUrl');
      
    res.json(dreams);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dreams' });
  }
});

// Create dream
router.post('/', async (req, res) => {
  try {
    const { title, content, privacyLevel, tags, mood, mentions } = req.body;
    const userId = req.user.userId;
    
    const dream = new Dream({
      title,
      content,
      userId,
      privacyLevel,
      tags,
      mood,
      mentions
    });
    
    await dream.save();
    
    // Update user's dream count
    await User.findByIdAndUpdate(userId, { $inc: { dreamCount: 1 } });
    
    res.status(201).json(dream);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create dream' });
  }
});

// Update dream
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, privacyLevel, tags, mood, mentions } = req.body;
    const userId = req.user.userId;
    
    const dream = await Dream.findOne({ _id: id, userId });
    if (!dream) {
      return res.status(404).json({ message: 'Dream not found' });
    }
    
    dream.title = title;
    dream.content = content;
    dream.privacyLevel = privacyLevel;
    dream.tags = tags;
    dream.mood = mood;
    dream.mentions = mentions;
    
    await dream.save();
    
    res.json(dream);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update dream' });
  }
});

// Delete dream
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const dream = await Dream.findOneAndDelete({ _id: id, userId });
    if (!dream) {
      return res.status(404).json({ message: 'Dream not found' });
    }
    
    // Update user's dream count
    await User.findByIdAndUpdate(userId, { $inc: { dreamCount: -1 } });
    
    res.json({ message: 'Dream deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete dream' });
  }
});

// Like/unlike dream
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    const dream = await Dream.findById(id);
    if (!dream) {
      return res.status(404).json({ message: 'Dream not found' });
    }
    
    const likeIndex = dream.likes.indexOf(userId);
    if (likeIndex === -1) {
      dream.likes.push(userId);
    } else {
      dream.likes.splice(likeIndex, 1);
    }
    
    await dream.save();
    
    res.json(dream);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update like' });
  }
});

// Add comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, mentions } = req.body;
    const userId = req.user.userId;
    
    const dream = await Dream.findById(id);
    if (!dream) {
      return res.status(404).json({ message: 'Dream not found' });
    }
    
    dream.comments.push({
      content,
      userId,
      mentions
    });
    
    await dream.save();
    
    res.status(201).json(dream);
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

export default router;