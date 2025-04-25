import express from 'express';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    
    const user = new User({ name, email, password });
    await user.save();
    
    const token = generateToken(user._id);
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        website: user.website,
        dreamCount: user.dreamCount,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        joinedAt: user.joinedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(user._id);
    
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        website: user.website,
        dreamCount: user.dreamCount,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        joinedAt: user.joinedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

export default router;