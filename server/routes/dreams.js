import express from 'express';
import mongoose from 'mongoose';
import Block from '../models/Block.js';
import Dream from '../models/Dream.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { blockedIdsFor } from '../utils/blocks.js';
import { MAX_DRAFTS, MAX_REPLY_DEPTH, objectId, validate } from '../utils/validation.js';
import { canView, populateDream, serializeDream } from '../utils/serialize.js';
import {
  notifyComment,
  notifyLike,
  notifyMentions,
  removeBetween,
  removeForComments,
  removeForDream,
  removeForDreamExceptOwner
} from '../services/notifications.js';

const idOf = (value) => String(value?._id ?? value);

/** Keeps only mention ids that belong to real users the author is not blocked with. */
const resolveMentions = async (ids = [], blocked = new Set()) => {
  const wanted = ids.filter((id) => !blocked.has(String(id)));
  return wanted.length ? (await User.find({ _id: { $in: wanted } }).select('_id')).map((u) => u._id) : [];
};

/** Depth of a comment in its thread (a top-level comment is 0). Guards against cycles in corrupt data. */
const depthOf = (comments, comment) => {
  let depth = 0;
  let current = comment;
  while (current?.parentId && depth <= MAX_REPLY_DEPTH + 1) {
    current = comments.id(current.parentId);
    depth += 1;
  }
  return depth;
};

export default ({ config, schemas, reportLimiter }) => {
  const router = express.Router();
  const requireAuth = authenticate(config.jwtSecret);
  const withViewer = optionalAuth(config.jwtSecret);

  for (const name of ['id', 'commentId']) {
    router.param(name, (req, res, next, value) =>
      objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
    );
  }

  /** Loads a dream the viewer may see, or throws 404 (never reveals that a hidden dream exists). */
  const loadVisible = async (id, viewerId, blocked) => {
    const dream = await populateDream(Dream.findById(id));
    if (!dream || !canView(dream, viewerId, blocked)) throw new HttpError(404, 'Dream not found');
    return dream;
  };

  const respond = async (res, id, viewerId, blocked, status = 200) => {
    const dream = await populateDream(Dream.findById(id));
    res.status(status).json(serializeDream(dream, viewerId, blocked));
  };

  // ---------- lists ----------

  // Public feed (anonymous dreams have their author stripped by serializeDream)
  router.get(
    '/feed',
    withViewer,
    validate(schemas.feedQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit, tag, mood, q } = req.valid.query;
      const viewerId = req.user?.userId;
      const blocked = await blockedIdsFor(viewerId);

      const filter = { status: { $ne: 'draft' }, privacyLevel: { $in: ['public', 'anonymous'] } };
      if (blocked.size) filter.userId = { $nin: [...blocked] };
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

      res.json({
        dreams: dreams.map((d) => serializeDream(d, viewerId, blocked)),
        page,
        limit,
        total,
        hasMore: page * limit < total
      });
    })
  );

  // The signed-in user's own dreams (there are no public profiles, so nobody else's list is exposed).
  router.get(
    '/mine',
    requireAuth,
    validate(schemas.mineQuery, 'query'),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const { page, limit, status, privacyLevel } = req.valid.query;

      const filter = { userId: viewerId };
      if (status === 'draft') {
        filter.status = 'draft';
      } else {
        filter.status = { $ne: 'draft' };
        if (privacyLevel) filter.privacyLevel = privacyLevel;
      }

      const [dreams, total, grouped] = await Promise.all([
        populateDream(
          Dream.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
        ),
        Dream.countDocuments(filter),
        Dream.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(viewerId) } },
          { $group: { _id: { draft: { $eq: ['$status', 'draft'] }, level: '$privacyLevel' }, n: { $sum: 1 } } }
        ])
      ]);

      const counts = { all: 0, public: 0, private: 0, anonymous: 0, draft: 0 };
      for (const row of grouped) {
        if (row._id.draft) counts.draft += row.n;
        else {
          counts.all += row.n;
          counts[row._id.level] += row.n;
        }
      }

      res.json({
        dreams: dreams.map((d) => serializeDream(d, viewerId)),
        page,
        limit,
        total,
        hasMore: page * limit < total,
        counts
      });
    })
  );

  router.get(
    '/:id',
    withViewer,
    asyncHandler(async (req, res) => {
      const viewerId = req.user?.userId;
      const blocked = await blockedIdsFor(viewerId);
      const dream = await loadVisible(req.params.id, viewerId, blocked);
      res.json(serializeDream(dream, viewerId, blocked));
    })
  );

  // ---------- create / edit / delete ----------

  router.post(
    '/',
    requireAuth,
    validate(schemas.dreamCreate),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const data = req.valid.body;

      if (data.status === 'draft' && (await Dream.countDocuments({ userId: viewerId, status: 'draft' })) >= MAX_DRAFTS) {
        throw new HttpError(400, `You can keep up to ${MAX_DRAFTS} drafts. Publish or delete some first.`);
      }

      const blocked = await blockedIdsFor(viewerId);
      const dream = await Dream.create({
        ...data,
        title: data.title || 'Untitled draft',
        userId: viewerId,
        mentions: await resolveMentions(data.mentions, blocked)
      });

      if (dream.status === 'published') {
        await notifyMentions({ dream, actorId: viewerId, mentionIds: dream.mentions, blocked });
      }
      await respond(res, dream._id, viewerId, blocked, 201);
    })
  );

  router.put(
    '/:id',
    requireAuth,
    validate(schemas.dreamUpdate),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await Dream.findOne({ _id: req.params.id, userId: viewerId });
      if (!dream) throw new HttpError(404, 'Dream not found');

      const wasDraft = dream.status === 'draft';
      const wasVisible = !wasDraft && dream.privacyLevel !== 'private';
      const previousMentions = dream.mentions.map(String);
      const blocked = await blockedIdsFor(viewerId);

      const { mentions, status, ...fields } = req.valid.body;
      if (status === 'draft' && !wasDraft) {
        throw new HttpError(400, 'A published dream cannot go back to draft');
      }

      dream.set(fields);
      if (status) dream.status = status;
      if (mentions) dream.mentions = await resolveMentions(mentions, blocked);

      if (dream.status === 'published') {
        // Publishing (or editing a published dream) needs a complete dream.
        const complete = schemas.dreamPublished.safeParse({
          status: 'published',
          title: dream.title,
          content: dream.content,
          privacyLevel: dream.privacyLevel,
          tags: dream.tags,
          mood: dream.mood,
          mentions: dream.mentions.map(String)
        });
        if (!complete.success) {
          return res.status(400).json({
            message: 'Validation failed',
            errors: complete.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
          });
        }
      } else if (!dream.title) {
        dream.title = 'Untitled draft';
      }
      await dream.save();

      const nowVisible = dream.status !== 'draft' && dream.privacyLevel !== 'private';
      if (nowVisible) {
        // Notify only people not already notified, or everyone if the dream just became visible.
        const toNotify = wasVisible ? dream.mentions.filter((id) => !previousMentions.includes(String(id))) : dream.mentions;
        await notifyMentions({ dream, actorId: viewerId, mentionIds: toNotify, blocked });
      } else if (dream.status !== 'draft') {
        // Nobody but the author may keep notifications about a dream that is no longer visible.
        await removeForDreamExceptOwner({ dreamId: dream._id, ownerId: dream.userId });
      }

      await respond(res, dream._id, viewerId, blocked);
    })
  );

  router.delete(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const dream = await Dream.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
      if (!dream) throw new HttpError(404, 'Dream not found');
      await removeForDream(dream._id);
      res.json({ message: 'Dream deleted' });
    })
  );

  // ---------- likes ----------

  // Atomic like toggle
  router.post(
    '/:id/like',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const blocked = await blockedIdsFor(viewerId);
      await loadVisible(req.params.id, viewerId, blocked);

      const uid = new mongoose.Types.ObjectId(viewerId);
      const updated = await Dream.findOneAndUpdate(
        { _id: req.params.id },
        [
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
        ],
        { new: true }
      );

      if (updated) {
        const liked = updated.likes.some((id) => String(id) === viewerId);
        await notifyLike({ dream: updated, actorId: viewerId, liked, blocked });
      }
      await respond(res, req.params.id, viewerId, blocked);
    })
  );

  // ---------- comments and threads ----------

  router.post(
    '/:id/comments',
    requireAuth,
    validate(schemas.comment),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const blocked = await blockedIdsFor(viewerId);
      const dream = await Dream.findById(req.params.id);
      if (!dream || !canView(dream, viewerId, blocked)) throw new HttpError(404, 'Dream not found');
      if (dream.status === 'draft') throw new HttpError(400, 'Publish this dream before it can receive comments');

      const { content, mentions, parentId } = req.valid.body;

      let parentAuthorId = null;
      if (parentId) {
        const parent = dream.comments.id(parentId);
        if (!parent) throw new HttpError(404, 'The comment you are replying to was not found');
        if (parent.deleted) throw new HttpError(400, 'You cannot reply to a deleted comment');
        if (blocked.has(idOf(parent.userId))) throw new HttpError(404, 'The comment you are replying to was not found');
        if (depthOf(dream.comments, parent) + 1 > MAX_REPLY_DEPTH) {
          throw new HttpError(400, 'This thread is too deep to reply to');
        }
        parentAuthorId = parent.userId;
      }

      const mentionIds = await resolveMentions(mentions, blocked);
      const commentId = new mongoose.Types.ObjectId();
      await Dream.updateOne(
        { _id: req.params.id },
        { $push: { comments: { _id: commentId, content, userId: viewerId, parentId: parentId ?? null, mentions: mentionIds } } }
      );

      await notifyComment({ dream, actorId: viewerId, commentId, mentionIds, parentAuthorId, blocked });
      await respond(res, req.params.id, viewerId, blocked, 201);
    })
  );

  // The comment author or the dream owner may delete a comment. A comment that still has replies becomes a
  // "deleted" placeholder; one without replies is removed (and so are deleted ancestors left with no replies).
  router.delete(
    '/:id/comments/:commentId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const { commentId } = req.params;
      const blocked = await blockedIdsFor(viewerId);
      await loadVisible(req.params.id, viewerId, blocked);

      const dream = await Dream.findById(req.params.id);
      const comment = dream.comments.id(commentId);
      if (!comment || comment.deleted) throw new HttpError(404, 'Comment not found');
      if (viewerId !== idOf(comment.userId) && viewerId !== idOf(dream.userId)) {
        throw new HttpError(403, 'Not allowed to delete this comment');
      }

      const hasReplies = (c) => dream.comments.some((other) => String(other.parentId) === String(c._id));
      const affected = [commentId];

      if (hasReplies(comment)) {
        comment.deleted = true;
        comment.content = '[deleted]';
        comment.mentions = [];
      } else {
        let current = comment;
        while (current) {
          const parent = current.parentId ? dream.comments.id(current.parentId) : null;
          dream.comments.pull(current._id);
          current = parent && parent.deleted && !hasReplies(parent) ? parent : null;
          if (current) affected.push(String(current._id));
        }
      }
      await dream.save();
      await removeForComments(affected);

      await respond(res, req.params.id, viewerId, blocked);
    })
  );

  // ---------- reports ----------

  const createReport = async ({ reporterId, targetType, dream, comment, body }) => {
    try {
      await Report.create({
        reporterId,
        targetType,
        dreamId: dream._id,
        commentId: comment?._id ?? null,
        reportedUserId: idOf(comment ? comment.userId : dream.userId),
        reason: body.reason,
        details: body.details
      });
    } catch (error) {
      if (error.code === 11000) throw new HttpError(409, `You already reported this ${targetType}`);
      throw error;
    }
  };

  router.post(
    '/:id/report',
    requireAuth,
    reportLimiter,
    validate(schemas.report),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await loadVisible(req.params.id, viewerId, await blockedIdsFor(viewerId));
      if (idOf(dream.userId) === viewerId) throw new HttpError(400, 'You cannot report your own dream');

      await createReport({ reporterId: viewerId, targetType: 'dream', dream, body: req.valid.body });
      res.status(201).json({ message: 'Report received. Thank you.' });
    })
  );

  router.post(
    '/:id/comments/:commentId/report',
    requireAuth,
    reportLimiter,
    validate(schemas.report),
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await loadVisible(req.params.id, viewerId, await blockedIdsFor(viewerId));
      const comment = dream.comments.id(req.params.commentId);
      if (!comment || comment.deleted) throw new HttpError(404, 'Comment not found');
      if (idOf(comment.userId) === viewerId) throw new HttpError(400, 'You cannot report your own comment');

      await createReport({ reporterId: viewerId, targetType: 'comment', dream, comment, body: req.valid.body });
      res.status(201).json({ message: 'Report received. Thank you.' });
    })
  );

  // ---------- blocking ----------

  /**
   * Blocks are made from a piece of content and resolved here, so the client never needs (or receives) the id of
   * an anonymous author. `anonymous` remembers that the blocker did not know who this was.
   */
  const blockUser = async ({ blockerId, targetId, anonymous }) => {
    if (targetId === blockerId) throw new HttpError(400, 'You cannot block yourself');
    await Block.updateOne({ blockerId, blockedId: targetId }, { $setOnInsert: { anonymous } }, { upsert: true });
    await removeBetween({ a: blockerId, b: targetId });
  };

  router.post(
    '/:id/block-author',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await loadVisible(req.params.id, viewerId, await blockedIdsFor(viewerId));
      await blockUser({
        blockerId: viewerId,
        targetId: idOf(dream.userId),
        anonymous: dream.privacyLevel === 'anonymous'
      });
      res.json({ message: 'User blocked' });
    })
  );

  router.post(
    '/:id/comments/:commentId/block-author',
    requireAuth,
    asyncHandler(async (req, res) => {
      const viewerId = req.user.userId;
      const dream = await loadVisible(req.params.id, viewerId, await blockedIdsFor(viewerId));
      const comment = dream.comments.id(req.params.commentId);
      if (!comment || comment.deleted) throw new HttpError(404, 'Comment not found');

      const authorId = idOf(comment.userId);
      // The dream's author commenting on their own anonymous dream is hidden from everybody else.
      const hidden = dream.privacyLevel === 'anonymous' && authorId === idOf(dream.userId);
      await blockUser({ blockerId: viewerId, targetId: authorId, anonymous: hidden });
      res.json({ message: 'User blocked' });
    })
  );

  return router;
};
