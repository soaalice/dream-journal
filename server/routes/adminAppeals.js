import express from 'express';
import Appeal from '../models/Appeal.js';
import Dream from '../models/Dream.js';
import User from '../models/User.js';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { objectId, validate } from '../utils/validation.js';
import { audit } from '../services/audit.js';
import { reasonsFor, setModerationState, tellAuthor } from '../services/moderation.js';

const idOf = (value) => String(value?._id ?? value);
const excerpt = (text = '', n = 200) => (text.length > n ? `${text.slice(0, n)}…` : text);

/**
 * Review of appeals by staff. Two safeguards keep a decision honest:
 *  - a moderator cannot decide an appeal against their own decision (an administrator can);
 *  - appeals against a suspension are for administrators.
 */
export default ({ config, schemas }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret), requireStaff);

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  router.get(
    '/appeals',
    validate(schemas.adminAppealsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit, status } = req.valid.query;
      const filter = status === 'all' ? {} : { status };
      const [appeals, total] = await Promise.all([
        Appeal.find(filter)
          .sort(status === 'open' ? { createdAt: 1 } : { resolvedAt: -1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'name')
          .populate('resolvedBy', 'name'),
        Appeal.countDocuments(filter)
      ]);

      res.json({
        appeals: appeals.map((a) => ({
          _id: String(a._id),
          targetType: a.targetType,
          status: a.status,
          createdAt: a.createdAt,
          resolvedAt: a.resolvedAt,
          resolvedBy: a.resolvedBy?.name ?? null,
          authorName: a.userId?.name ?? 'Deleted user',
          title: a.snapshot?.title ?? '',
          excerpt: excerpt(a.targetType === 'account' ? a.message : a.snapshot?.content),
          message: excerpt(a.message, 160)
        })),
        page,
        limit,
        total,
        hasMore: page * limit < total
      });
    })
  );

  router.get(
    '/appeals/:id',
    asyncHandler(async (req, res) => {
      const appeal = await Appeal.findById(req.params.id).populate('resolvedBy', 'name').populate('decidedBy', 'name');
      if (!appeal) throw new HttpError(404, 'Appeal not found');

      const isAdmin = req.user.role === 'admin';
      const [author, dream] = await Promise.all([
        User.findById(appeal.userId).select('name email joinedAt role suspendedAt suspensionReason'),
        appeal.dreamId ? Dream.findById(appeal.dreamId) : null
      ]);
      const comment = appeal.commentId ? dream?.comments.id(appeal.commentId) : null;
      const live = appeal.targetType === 'comment' ? comment : dream;

      res.json({
        appeal: {
          _id: String(appeal._id),
          targetType: appeal.targetType,
          status: appeal.status,
          message: appeal.message,
          createdAt: appeal.createdAt,
          resolvedAt: appeal.resolvedAt,
          resolvedBy: appeal.resolvedBy?.name ?? null,
          resolutionNote: appeal.resolutionNote,
          /** the moderator whose decision is appealed; they cannot decide it (unless they are an administrator) */
          decidedBy: appeal.decidedBy?.name ?? null,
          decidedByMe: appeal.decidedBy ? idOf(appeal.decidedBy) === req.user.userId : false
        },
        author: author
          ? {
              name: author.name,
              email: isAdmin ? author.email : null,
              joinedAt: author.joinedAt,
              suspended: Boolean(author.suspendedAt),
              suspensionReason: author.suspensionReason
            }
          : null,
        content: {
          exists: Boolean(live),
          title: dream?.title ?? appeal.snapshot?.title ?? '',
          text: live ? (comment ? comment.content : dream.content) : appeal.snapshot?.content ?? '',
          moderationState: live?.moderationState ?? null,
          moderationMessage: live?.moderationMessage || appeal.snapshot?.moderationMessage || ''
        },
        reasons:
          appeal.targetType === 'account'
            ? []
            : await reasonsFor({ dreamId: appeal.dreamId, commentId: appeal.commentId ?? null, status: 'reviewed' })
      });
    })
  );

  router.post(
    '/appeals/:id/decide',
    validate(schemas.adminAppealDecision),
    asyncHandler(async (req, res) => {
      const { decision, note, message } = req.valid.body;
      const adminId = req.user.userId;
      const isAdmin = req.user.role === 'admin';

      const appeal = await Appeal.findOne({ _id: req.params.id, status: 'open' });
      if (!appeal) throw new HttpError(404, 'This appeal was not found or is already decided');

      if (appeal.targetType === 'account' && !isAdmin) {
        throw new HttpError(403, 'Only administrators can decide an appeal against a suspension');
      }
      if (!isAdmin && appeal.decidedBy && idOf(appeal.decidedBy) === adminId) {
        throw new HttpError(403, 'You made the original decision. Another moderator must review this appeal.');
      }

      const authorId = idOf(appeal.userId);
      const base = {
        targetType: appeal.targetType === 'account' ? 'user' : appeal.targetType,
        dreamId: appeal.dreamId,
        commentId: appeal.commentId,
        targetUserId: authorId,
        note
      };

      let restored = false;
      let unsuspended = false;

      if (decision === 'overturned') {
        if (appeal.targetType === 'account') {
          const result = await User.updateOne({ _id: authorId, suspendedAt: { $ne: null } }, { suspendedAt: null, suspensionReason: '' });
          unsuspended = result.modifiedCount > 0;
        } else {
          restored = (await setModerationState({ dreamId: appeal.dreamId, commentId: appeal.commentId, state: 'visible' })).changed;
        }
      }

      appeal.status = decision;
      appeal.resolvedBy = adminId;
      appeal.resolvedAt = new Date();
      appeal.resolutionNote = note;
      await appeal.save();

      await audit(adminId, { ...base, action: decision === 'overturned' ? 'appeal_overturned' : 'appeal_upheld' });

      // Account appeals cannot be answered with a notification (the person cannot sign in); they see the result at login.
      if (appeal.targetType !== 'account') {
        await tellAuthor({
          event: decision === 'overturned' ? 'appeal_overturned' : 'appeal_upheld',
          authorId,
          dreamId: appeal.dreamId,
          commentId: appeal.commentId,
          title: appeal.snapshot?.title,
          content: appeal.snapshot?.content,
          message:
            message || (decision === 'overturned' ? 'Your content is visible again.' : 'The original decision stands.')
        });
      }

      res.json({ status: decision, restored, unsuspended });
    })
  );

  return router;
};
