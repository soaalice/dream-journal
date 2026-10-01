import express from 'express';
import mongoose from 'mongoose';
import Dream from '../models/Dream.js';
import User from '../models/User.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { objectId, validate } from '../utils/validation.js';
import { canView, populateDream, serializeDream } from '../utils/serialize.js';

/** Keeps only mention ids that belong to real users. */
const resolveMentions = async (ids = []) =>
  ids.length ? (await User.find({ _id: { $in: ids } }).select('_id')).map((u) => u._id) : [];

export default ({ config, schemas }) => {
  const router = express.Router();
  const requireAuth = authenticate(config.jwtSecret);
  const withViewer = optionalAuth(config.jwtSecret);

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );
  router.param('userId', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );
  router.param('commentId', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  /** Loads a dream the viewer may see, or throws 404 (never reveals that a private dream exists). */
  const loadVisible = async (id, viewerId) => {
    const dream = await populateDream(Dream.findById(id));
    if (!dream || !canView(dream, viewerId)) throw new HttpError(404, 'Dream not found');
    return dream;
  };

  const respond = async (res, id, viewerId, status = 200) => {
    const dream = await populateDream(Dream.findById(id));
    res.status(status).json(serializeDream(dream, viewerId));
  };

  // Public feed (anonymous dreams have their author stripped by serializeDream)
  router.get(
    '/feed',
    withViewer,
    validate(schemas.feedQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit, tag, mood, q } = req.valid.query;
      const filter = { privacyLevel: { $in: ['public', 'anonymous'] } };
      if (tag?.length) filter.tags = { $in: tag };
      if (mood?.length) filter.mood = { $in: mood };
      if (q) filter.$text = { $search: q };

      const [dreams, total] = await Promise.all([
        populateDream(
          Dream.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
        ),
        Dream.countDocuments(filter)
      ]);

      const viewerId = req.user?.userId;
      res.json({
        dreams: dreams.map((d) => serializeDream(d, viewerId)),
        page,
        limit,
        total,
        hasMore: page * limit < total
      });
    })
  );

  // Dreams of a user: owners see everything, everybody else only `public` ones
  // (listing `anonymous` dreams on a profile would de-anonymise them).
  router.get(
    '/user/:userId',
    requireAuth,
    validate(schemas.userDreamsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const { userId } = req.params;
      const { privacyLevel } = req.valid.query;
      const isOwner = viewerId === userId;

      const filter = { userId };
      if (isOwner) {
        if (privacyLevel) filter.privacyLevel = privacyLevel;
      } else {
        filter.privacyLevel = 'public';
      }

      const dreams = await populateDream(Dream.find(filter).sort({ createdAt: -1 }).limit(200));
      res.json(dreams.map((d) => serializeDream(d, viewerId)));
    })
  );

  router.get(
    '/:id',
    withViewer,
    asyncHandler(async (req, res) => {
      const dream = await loadVisible(req.params.id, req.user?.userId);
      res.json(serializeDream(dream, req.user?.userId));
    })
  );

  router.post(
    '/',
    requireAuth,
    validate(schemas.dreamCreate),
    asyncHandler(async (req, res) => {
      const data = req.valid.body;
      const dream = await Dream.create({
        ...data,
        userId: req.user.userId,
        mentions: await resolveMentions(data.mentions)
      });
      await respond(res, dream._id, req.user.userId, 201);
    })
  );

  router.put(
    '/:id',
    requireAuth,
    validate(schemas.dreamUpdate),
    asyncHandler(async (req, res) => {
      const dream = await Dream.findOne({ _id: req.params.id, userId: req.user.userId });
      if (!dream) throw new HttpError(404, 'Dream not found');

      const { mentions, ...fields } = req.valid.body;
      dream.set(fields);
      if (mentions) dream.mentions = await resolveMentions(mentions);
      await dream.save();

      await respond(res, dream._id, req.user.userId);
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const dream = await Dream.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
      if (!dream) throw new HttpError(404, 'Dream not found');
      res.json({ message: 'Dream deleted' });
    })
  );

  // Atomic like toggle
  router.post(
    '/:id/like',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      await loadVisible(req.params.id, viewerId);

      const uid = new mongoose.Types.ObjectId(viewerId);
      await Dream.updateOne({ _id: req.params.id }, [
        {
          $set: {
            likes: {
              $cond: [
                { $in: [uid, '$likes'] },
                { $setDifference: ['$likes', [uid]] },
                { $concatArrays: ['$likes', [uid]] }
              ]
            }
          }
        }
      ]);

      await respond(res, req.params.id, viewerId);
    })
  );

  router.post(
    '/:id/comments',
    requireAuth,
    validate(schemas.comment),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      await loadVisible(req.params.id, viewerId);

      const { content, mentions } = req.valid.body;
      await Dream.updateOne(
        { _id: req.params.id },
        { $push: { comments: { content, userId: viewerId, mentions: await resolveMentions(mentions) } } }
      );

      await respond(res, req.params.id, viewerId, 201);
    })
  );

  // The comment author or the dream owner may delete a comment
  router.delete(
    '/:id/comments/:commentId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await loadVisible(req.params.id, viewerId);

      const comment = dream.comments.id(req.params.commentId);
      if (!comment) throw new HttpError(404, 'Comment not found');

      const authorId = String(comment.userId?._id ?? comment.userId);
      const ownerId = String(dream.userId?._id ?? dream.userId);
      if (viewerId !== authorId && viewerId !== ownerId) {
        throw new HttpError(403, 'Not allowed to delete this comment');
      }

      await Dream.updateOne({ _id: req.params.id }, { $pull: { comments: { _id: req.params.commentId } } });
      await respond(res, req.params.id, viewerId);
    })
  );

  return router;
};
