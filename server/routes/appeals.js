import express from 'express';
import Appeal from '../models/Appeal.js';
import Dream from '../models/Dream.js';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { validate } from '../utils/validation.js';
import User from '../models/User.js';
import { notifyStaffOfAppeal } from '../services/notifications.js';

/**
 * An author appeals a moderator's removal of their dream or comment. The appeal starts from the notification they
 * received, so only the person concerned can open it, once. (Suspended accounts appeal from the login screen:
 * see POST /auth/appeal-suspension.)
 */
export default ({ config, schemas, reportLimiter }) => {
  const router = express.Router();

  router.post(
    '/',
    authenticate(config.jwtSecret),
    reportLimiter,
    validate(schemas.appeal),
    asyncHandler(async (req, res) => {
      const { notificationId, message } = req.valid.body;
      const userId = req.user.userId;

      const notification = await Notification.findOne({ _id: notificationId, userId, type: 'moderation' });
      if (!notification || notification.moderation?.event !== 'removed') throw new HttpError(404, 'Notification not found');
      if (notification.appealId) throw new HttpError(409, 'You already appealed this decision');

      const dream = await Dream.findById(notification.dreamId);
      const comment = notification.commentId ? dream?.comments.id(notification.commentId) : null;
      const target = comment ?? dream;
      // The content must still exist and still be removed: otherwise there is nothing left to decide.
      if (!target || target.moderationState !== 'removed') {
        throw new HttpError(400, 'This decision can no longer be appealed');
      }

      let appeal;
      try {
        appeal = await Appeal.create({
          userId,
          targetType: comment ? 'comment' : 'dream',
          dreamId: dream._id,
          commentId: comment?._id ?? null,
          message,
          snapshot: {
            title: dream.title,
            content: (comment ? comment.content : dream.content).slice(0, 2000),
            moderationMessage: target.moderationMessage
          },
          decidedBy: target.moderatedBy ?? null,
          notificationId: notification._id
        });
        notification.appealId = appeal._id;
        await notification.save();
      } catch (error) {
        if (error.code === 11000) throw new HttpError(409, 'You already appealed this decision');
        throw error;
      }

      const author = await User.findById(userId).select('name');
      await notifyStaffOfAppeal({ appeal, authorName: author?.name ?? 'Unknown', excludeUserId: appeal.decidedBy });

      res.status(201).json({ message: 'Your appeal was sent. A moderator who was not involved will review it.' });
    })
  );

  return router;
};
