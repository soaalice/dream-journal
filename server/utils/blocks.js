import Block from '../models/Block.js';

/**
 * Ids of every user who is blocked in either direction relative to `userId`
 * (people they blocked, and people who blocked them). The two cases are treated the same on purpose:
 * neither side can see the other's dreams or comments, and nothing here tells them which side blocked.
 */
export const blockedIdsFor = async (userId) => {
  if (!userId) return new Set();
  const rows = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] }).select('blockerId blockedId');
  const me = String(userId);
  return new Set(rows.map((b) => (String(b.blockerId) === me ? String(b.blockedId) : String(b.blockerId))));
};

export const isBlockedPair = async (a, b) => (await blockedIdsFor(a)).has(String(b));
