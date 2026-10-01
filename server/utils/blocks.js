import Block from '../models/Block.js';
import User from '../models/User.js';

/**
 * Ids of every user whose dreams and comments must be hidden from `userId`:
 *  - people they blocked and people who blocked them (treated the same on purpose, so nobody learns which
 *    side blocked);
 *  - every suspended account, for everybody (including signed-out visitors).
 */
export const blockedIdsFor = async (userId) => {
  const [rows, suspended] = await Promise.all([
    userId ? Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).select('blockerId blockedId') : [],
    User.find({ suspendedAt: { $ne: null } }).select('_id')
  ]);
  const me = String(userId);
  const ids = rows.map((b) => (String(b.blockerId) === me ? String(b.blockedId) : String(b.blockerId)));
  return new Set([...ids, ...suspended.map((u) => String(u._id))]);
};

export const isBlockedPair = async (a, b) => (await blockedIdsFor(a)).has(String(b));
