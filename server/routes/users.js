import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const { name, bio, location, website, avatarUrl } = req.body;
    const userId = req.user.userId;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { name, bio, location, website, avatarUrl },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Search users
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('name avatarUrl');
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to search users' });
  }
});

export default router;