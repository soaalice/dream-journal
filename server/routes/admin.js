import express from 'express';
import mongoose from 'mongoose';
import Appeal from '../models/Appeal.js';
import AuditLog from '../models/AuditLog.js';
import Dream from '../models/Dream.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { authenticate, requireAdmin, requireStaff } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { objectId, validate } from '../utils/validation.js';
import { audit } from '../services/audit.js';
import { reasonsFor, setModerationState, tellAuthor } from '../services/moderation.js';

const DEFAULT_REMOVAL_MESSAGE = 'It breaks our community guidelines.';

const idOf = (value) => String(value?._id ?? value);
const toObjectId = (value) => (value ? new mongoose.Types.ObjectId(String(value)) : null);
const excerpt = (text = '', length = 240) => (text.length > length ? `${text.slice(0, length)}…` : text);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Moderation API. Everything here requires a signed-in moderator or administrator (anyone else gets a 404, so the
 * surface looks absent), and every action that changes something is written to the append-only audit log.
 *
 * Moderators handle reports: review, dismiss and remove content. Administrators can also suspend accounts, see the
 * suspended list, read the audit log, and see authors' email addresses.
 *
 * Reports are handled as *cases*: all reports about the same dream or comment are shown and resolved together.
 */
export default ({ config, schemas }) => {
  const router = express.Router();
  router.use(authenticate(config.jwtSecret), requireStaff);

  router.param('id', (req, res, next, value) =>
    objectId.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid id' })
  );

  const caseMatch = ({ dreamId, commentId }) => ({ dreamId: toObjectId(dreamId), commentId: toObjectId(commentId) });

  /** Number of distinct reported items matching `match`. */
  const countCases = async (match) => {
    const [row] = await Report.aggregate([
      { $match: match },
      { $group: { _id: { d: '$dreamId', c: '$commentId' } } },
      { $count: 'n' }
    ]);
    return row?.n ?? 0;
  };

  // ---------- overview ----------

  router.get(
    '/summary',
    asyncHandler(async (req, res) => {
      const since = new Date(Date.now() - 7 * DAY_MS);
      const [open, reviewed, dismissed, suspendedUsers, openAppeals] = await Promise.all([
        countCases({ status: 'open' }),
        countCases({ status: 'reviewed', resolvedAt: { $gte: since } }),
        countCases({ status: 'dismissed', resolvedAt: { $gte: since } }),
        User.countDocuments({ suspendedAt: { $ne: null } }),
        Appeal.countDocuments({ status: 'open' })
      ]);
      res.json({ open, reviewedLast7Days: reviewed, dismissedLast7Days: dismissed, suspendedUsers, openAppeals });
    })
  );

  // ---------- the queue ----------

  router.get(
    '/reports',
    validate(schemas.adminReportsQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit, status, type, reason } = req.valid.query;

      const match = {};
      if (status !== 'all') match.status = status;
      if (type) match.targetType = type;
      if (reason) match.reason = reason;

      // Open cases: most reported first, then newest. Resolved cases: most recently resolved first.
      const sort = status === 'open' || status === 'all' ? { reportCount: -1, lastReportedAt: -1 } : { lastResolvedAt: -1 };

      const [result] = await Report.aggregate([
        { $match: match },
        {
          $group: {
            _id: { targetType: '$targetType', dreamId: '$dreamId', commentId: '$commentId' },
            reportCount: { $sum: 1 },
            openCount: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
            firstReportedAt: { $min: '$createdAt' },
            lastReportedAt: { $max: '$createdAt' },
            lastResolvedAt: { $max: '$resolvedAt' },
            reasons: { $push: '$reason' },
            reportedUserId: { $first: '$reportedUserId' },
            snapshot: { $first: '$snapshot' }
          }
        },
        { $sort: sort },
        { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } }
      ]);

      const rows = result.items;
      const total = result.total[0]?.n ?? 0;

      const [dreams, authors] = await Promise.all([
        Dream.find({ _id: { $in: rows.map((r) => r._id.dreamId) } }).select('title content privacyLevel status moderationState userId comments'),
        User.find({ _id: { $in: rows.map((r) => r.reportedUserId) } }).select('name suspendedAt')
      ]);
      const dreamById = new Map(dreams.map((d) => [String(d._id), d]));
      const authorById = new Map(authors.map((u) => [String(u._id), u]));

      const cases = rows.map((row) => {
        const { targetType, dreamId, commentId } = row._id;
        const dream = dreamById.get(String(dreamId));
        const comment = commentId ? dream?.comments.id(commentId) : null;
        const live = commentId ? comment && !comment.deleted : Boolean(dream);
        const author = authorById.get(String(row.reportedUserId));

        const reasons = {};
        for (const r of row.reasons) reasons[r] = (reasons[r] ?? 0) + 1;

        return {
          key: `${dreamId}:${commentId ?? ''}`,
          targetType,
          dreamId: String(dreamId),
          commentId: commentId ? String(commentId) : null,
          reportCount: row.reportCount,
          openCount: row.openCount,
          reasons,
          firstReportedAt: row.firstReportedAt,
          lastReportedAt: row.lastReportedAt,
          lastResolvedAt: row.lastResolvedAt ?? null,
          contentExists: Boolean(live),
          moderationState: (comment ?? dream)?.moderationState ?? 'visible',
          title: dream?.title ?? row.snapshot?.title ?? '',
          excerpt: excerpt(live ? (comment ? comment.content : dream.content) : row.snapshot?.content),
          authorName: author?.name ?? 'Deleted user',
          authorSuspended: Boolean(author?.suspendedAt)
        };
      });

      res.json({ cases, page, limit, total, hasMore: page * limit < total });
    })
  );

  router.get(
    '/reports/case',
    validate(schemas.adminCaseQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { dreamId, commentId } = req.valid.query;

      const reports = await Report.find(caseMatch({ dreamId, commentId }))
        .sort({ createdAt: -1 })
        .populate('reporterId', 'name')
        .populate('resolvedBy', 'name');
      if (reports.length === 0) throw new HttpError(404, 'No reports for this content');

      const targetType = commentId ? 'comment' : 'dream';
      const authorId = reports[0].reportedUserId;
      const [dream, author] = await Promise.all([
        Dream.findById(dreamId),
        User.findById(authorId).select('name email joinedAt role suspendedAt suspensionReason')
      ]);
      const isAdmin = req.user.role === 'admin';
      const comment = commentId ? dream?.comments.id(commentId) : null;
      const live = commentId ? Boolean(comment && !comment.deleted) : Boolean(dream);
      const snapshot = reports[0].snapshot ?? {};

      // Anonymity is kept for everybody except moderators, and looking is recorded.
      const anonymous =
        dream?.privacyLevel === 'anonymous' && (!commentId || idOf(comment?.userId) === idOf(dream.userId));
      if (anonymous) {
        await audit(req.user.userId, { action: 'viewed_anonymous_author', targetType, dreamId, commentId: commentId ?? null, targetUserId: authorId });
      }

      const [reportedCases, removals, suspensions] = await Promise.all([
        countCases({ reportedUserId: authorId }),
        AuditLog.countDocuments({ targetUserId: authorId, action: 'content_removed' }),
        AuditLog.countDocuments({ targetUserId: authorId, action: 'user_suspended' })
      ]);

      const latestAppeal = await Appeal.findOne({ dreamId, commentId: commentId ?? null, targetType }).sort({ createdAt: -1 }).select('status createdAt');

      res.json({
        appeal: latestAppeal ? { _id: String(latestAppeal._id), status: latestAppeal.status, createdAt: latestAppeal.createdAt } : null,
        target: {
          type: targetType,
          dreamId,
          commentId: commentId ?? null,
          exists: live,
          title: dream?.title ?? snapshot.title ?? '',
          content: live ? (comment ? comment.content : dream.content) : snapshot.content ?? '',
          privacyLevel: dream?.privacyLevel ?? null,
          draft: dream?.status === 'draft',
          /** visible | hidden (automatically, awaiting review) | removed (by a moderator) */
          moderationState: (comment ?? dream)?.moderationState ?? 'visible',
          anonymous,
          // text kept when the report was made, in case it was edited afterwards
          reportedText: snapshot.content ?? '',
          createdAt: (comment ?? dream)?.createdAt ?? null
        },
        author: author
          ? {
              _id: String(author._id),
              name: author.name,
              // only administrators see contact details
              email: isAdmin ? author.email : null,
              joinedAt: author.joinedAt,
              role: author.role,
              suspended: Boolean(author.suspendedAt),
              suspensionReason: author.suspensionReason,
              reportedCases,
              removals,
              suspensions
            }
          : null,
        reports: reports.map((r) => ({
          _id: String(r._id),
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reporter: r.reporterId ? { _id: idOf(r.reporterId), name: r.reporterId.name } : null,
          resolvedAt: r.resolvedAt,
          resolvedBy: r.resolvedBy?.name ?? null,
          resolutionNote: r.resolutionNote
        }))
      });
    })
  );

  /**
   * Resolve every open report about one piece of content.
   *  - `dismissed`: nothing is wrong. Content that was hidden automatically comes back.
   *  - `reviewed`: a decision was taken. `removeContent` takes the content down (it is hidden, not deleted, so an appeal
   *    can restore it) and tells the author; without it, hidden content comes back. `suspendAuthor` is admins only.
   */
  router.post(
    '/reports/resolve',
    validate(schemas.adminResolve),
    asyncHandler(async (req, res) => {
      const adminId = req.user.userId;
      const { dreamId, commentId, resolution, removeContent, suspendAuthor, suspensionReason, authorMessage, note } = req.valid.body;
      const match = { ...caseMatch({ dreamId, commentId }), status: 'open' };

      const open = await Report.find(match);
      if (open.length === 0) throw new HttpError(404, 'There are no open reports for this content');

      const authorId = idOf(open[0].reportedUserId);
      const author = await User.findById(authorId).select('role');
      const isAdmin = req.user.role === 'admin';

      if (suspendAuthor && !isAdmin) throw new HttpError(403, 'Only administrators can suspend accounts');
      if ((removeContent || suspendAuthor) && author?.role === 'admin') {
        throw new HttpError(400, 'Administrators cannot be moderated here');
      }
      if ((removeContent || suspendAuthor) && author?.role === 'moderator' && !isAdmin) {
        throw new HttpError(403, 'Only administrators can act on a moderator');
      }

      const targetType = commentId ? 'comment' : 'dream';
      const base = { targetType, dreamId, commentId: commentId ?? null, targetUserId: authorId, reportCount: open.length, note };
      const reasons = await reasonsFor({ dreamId, commentId });
      const target = { authorId, dreamId, commentId };

      let removed = false;
      let restored = false;

      if (removeContent) {
        const message = authorMessage || DEFAULT_REMOVAL_MESSAGE;
        const result = await setModerationState({ dreamId, commentId, state: 'removed', by: adminId, message });
        removed = result.changed;
        if (removed) {
          await audit(adminId, { ...base, action: 'content_removed', snapshot: { title: result.title, content: result.content.slice(0, 2000) } });
          await tellAuthor({ event: 'removed', ...target, title: result.title, content: result.content, message, reasons });
        }
      } else {
        // Nothing to remove: content that was hidden automatically while waiting for this decision comes back.
        const result = await setModerationState({ dreamId, commentId, state: 'visible' });
        restored = result.changed;
        if (restored) {
          await audit(adminId, { ...base, action: 'content_restored' });
          await tellAuthor({ event: 'restored', ...target, title: result.title, content: result.content, message: 'Moderators found nothing wrong.' });
        }
      }

      let suspended = false;
      if (suspendAuthor && author) {
        await User.updateOne({ _id: authorId }, { suspendedAt: new Date(), suspensionReason });
        suspended = true;
        await audit(adminId, { ...base, targetType: 'user', action: 'user_suspended', note: suspensionReason });
      }

      await Report.updateMany(match, {
        status: resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolutionNote: note
      });
      await audit(adminId, { ...base, action: resolution === 'dismissed' ? 'report_dismissed' : 'report_reviewed' });

      res.json({ resolvedReports: open.length, removed, restored, suspended });
    })
  );

  // ---------- suspended users ----------

  router.get(
    '/users/suspended',
    requireAdmin,
    validate(schemas.adminPageQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit } = req.valid.query;
      const filter = { suspendedAt: { $ne: null } };
      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ suspendedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('name email suspendedAt suspensionReason'),
        User.countDocuments(filter)
      ]);
      res.json({
        users: users.map((u) => ({
          _id: String(u._id),
          name: u.name,
          email: u.email,
          suspendedAt: u.suspendedAt,
          suspensionReason: u.suspensionReason
        })),
        page,
        limit,
        total,
        hasMore: page * limit < total
      });
    })
  );

  router.post(
    '/users/:id/unsuspend',
    requireAdmin,
    asyncHandler(async (req, res) => {
      const result = await User.updateOne({ _id: req.params.id, suspendedAt: { $ne: null } }, { suspendedAt: null, suspensionReason: '' });
      if (result.modifiedCount === 0) throw new HttpError(404, 'This user is not suspended');
      await audit(req.user.userId, { action: 'user_unsuspended', targetType: 'user', targetUserId: req.params.id });
      res.json({ message: 'User unsuspended' });
    })
  );

  // ---------- audit log ----------

  router.get(
    '/audit',
    requireAdmin,
    validate(schemas.adminPageQuery, 'query'),
    asyncHandler(async (req, res) => {
      const { page, limit } = req.valid.query;
      const [entries, total] = await Promise.all([
        AuditLog.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('adminId', 'name')
          .populate('targetUserId', 'name'),
        AuditLog.countDocuments()
      ]);
      res.json({
        entries: entries.map((e) => ({
          _id: String(e._id),
          action: e.action,
          targetType: e.targetType,
          dreamId: e.dreamId ? String(e.dreamId) : null,
          commentId: e.commentId ? String(e.commentId) : null,
          admin: e.system ? 'System' : e.adminId?.name ?? 'Deleted admin',
          targetUser: e.targetUserId?.name ?? null,
          reportCount: e.reportCount,
          note: e.note,
          snapshot: e.snapshot,
          createdAt: e.createdAt
        })),
        page,
        limit,
        total,
        hasMore: page * limit < total
      });
    })
  );

  return router;
};
