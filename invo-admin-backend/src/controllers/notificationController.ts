import { Request, Response } from 'express';
import Notification from '../models/Notification';
import { checkAndCreateNoteNotifications } from '../services/noteNotificationService';

// Get all notifications
export const getAllNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, isRead, limit = 50 } = req.query;
    const filter: any = {};
    
    if (projectId) filter.projectId = projectId;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    
    const notifications = await Notification.find(filter)
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string));
    
    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Mark all as read
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.query;
    const filter: any = { isRead: false };
    
    if (projectId) filter.projectId = projectId;
    
    await Notification.updateMany(filter, { isRead: true });
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    
    if (!notification) {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
      return;
    }
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};

// Trigger note notification check manually (for testing/debugging)
export const triggerNoteNotificationCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    await checkAndCreateNoteNotifications();
    
    res.json({
      success: true,
      message: 'Note notification check completed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: (error as Error).message
    });
  }
};
