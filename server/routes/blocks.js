import express from 'express';
import Block from '../models/Block.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { objectId, validate } from '../utils/validation.js';

/**
 * The signed-in user's block list. Blocks are created from a dream or a comment (see routes/dreams.js), never by
 * user id. Entries made from anonymous content stay anonymous here: no id, no name, no avatar.
 */
const serializeBlock = (block) => ({
  _id: String(block._id),
  createdAt: block.createdAt,
  anonymous: block.anonymous || !block.blockedId?.name,
  user:
    block.anonymous || !block.blockedId?.name
      ? null
      : { name: block.blockedId.name, avatarUrl: block.blockedId.avatarUrl }
});

export default ({ config, schemas }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret));

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  // Most recently blocked first, keyset-paginated like notifications
  router.get(
    '/',
    validate(schemas.blocksQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { limit, before } = req.valid.query;
      const mine = { blockerId: req.user.userId };
      const filter = before ? { ...mine, createdAt: { $lt: before } } : mine;

      const [rows, total] = await Promise.all([
        Block.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit + 1)
          .populate('blockedId', 'name avatarUrl'),
        Block.countDocuments(mine)
      ]);

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      res.json({
        blocks: page.map(serializeBlock),
        total,
        hasMore,
        nextCursor: hasMore ? page[page.length - 1].createdAt : null
      });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const result = await Block.deleteOne({ _id: req.params.id, blockerId: req.user.userId });
      if (result.deletedCount === 0) throw new HttpError(404, 'Block not found');
      res.json({ total: await Block.countDocuments({ blockerId: req.user.userId }) });
    })
  );

  return router;
};
