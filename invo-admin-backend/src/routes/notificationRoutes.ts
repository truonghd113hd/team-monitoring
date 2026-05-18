import { Router } from 'express';
import {
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  triggerNoteNotificationCheck
} from '../controllers/notificationController';

const router = Router();

router.get('/', getAllNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.post('/check-note-reminders', triggerNoteNotificationCheck);

export default router;
