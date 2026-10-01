import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const DEFAULT_AVATAR =
  'https://api.dicebear.com/8.x/fun-emoji/svg?eyes=plain&mouth=smileTeeth&backgroundColor=a0c4ff';

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    password: { type: String, required: true, minlength: 8, select: false },
    bio: { type: String, default: '', maxlength: 160 },
    location: { type: String, default: '', maxlength: 100 },
    website: { type: String, default: '', maxlength: 200 },
    avatarUrl: { type: String, default: DEFAULT_AVATAR, maxlength: 500 },
    joinedAt: { type: Date, default: Date.now },
    /**
     * Never settable through the public API (profile and registration only pick named fields).
     * Staff accounts are created from the command line: `npm run make-admin -- someone@example.com` (see scripts/).
     */
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    /** a suspended account cannot sign in, and its dreams and comments are hidden from everyone */
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: '', maxlength: 300 }
  },
  { timestamps: true }
);

userSchema.index({ name: 1 });
userSchema.index({ suspendedAt: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Used to equalise response time when the account does not exist.
export const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export default mongoose.model('User', userSchema);
