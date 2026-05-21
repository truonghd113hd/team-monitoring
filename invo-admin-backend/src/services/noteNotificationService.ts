import Note from '../models/Note';
import Notification from '../models/Notification';
import NotificationCache from '../models/NotificationCache';
import { sendTelegramMessage } from './telegramService';
import { emit } from './wsService';

/**
 * Check notes and create notifications for next 3 days (today, tomorrow, day after tomorrow)
 * Ensures only one notification per day per note using cache
 */
export const checkAndCreateNoteNotifications = async (): Promise<void> => {
  try {
    // Get current date in GMT+7 (Vietnam timezone)
    const now = new Date();
    const gmt7Offset = 7 * 60; // GMT+7 in minutes
    const localOffset = now.getTimezoneOffset(); // Current timezone offset from UTC
    const gmt7Time = new Date(now.getTime() + (gmt7Offset + localOffset) * 60 * 1000);
    
    const today = new Date(gmt7Time.getFullYear(), gmt7Time.getMonth(), gmt7Time.getDate());
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`[NOTE_NOTIFICATION] Starting notification check for next 3 days (GMT+7: ${todayStr})`);
    
    // Check for notes in the next 3 days: today (0), tomorrow (1), day after tomorrow (2)
    const daysToCheck = [0, 1, 2];
    let totalNotificationsCreated = 0;
    
    for (const daysAhead of daysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`[NOTE_NOTIFICATION] Checking notes for date: ${targetDateStr} (${daysAhead} days ahead)`);
      
      // Find all notes scheduled for the target date
      const notes = await Note.find({ date: targetDateStr });
      
      if (notes.length === 0) {
        console.log(`[NOTE_NOTIFICATION] No notes found for ${targetDateStr}`);
        continue;
      }
      
      console.log(`[NOTE_NOTIFICATION] Found ${notes.length} notes for ${targetDateStr}`);
      
      for (const note of notes) {
        try {
          // Check if notification already sent today for this note
          const existingCache = await NotificationCache.findOne({
            noteId: note._id,
            notificationDate: todayStr
          });
          
          if (existingCache) {
            console.log(`[NOTE_NOTIFICATION] Notification already sent today for note ${note._id}`);
            continue;
          }
          
          // Create notification with appropriate message based on days remaining
          let title: string;
          let message: string;
          
          if (daysAhead === 0) {
            title = 'Nhắc nhở: Ghi chú hôm nay';
            message = `Ghi chú cho hôm nay (${note.date}): ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`;
          } else if (daysAhead === 1) {
            title = 'Nhắc nhở: Ghi chú ngày mai';
            message = `Ghi chú cho ngày mai (${note.date}): ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`;
          } else {
            title = 'Nhắc nhở: Ghi chú sắp đến hạn';
            message = `Ghi chú cho ngày ${note.date} sẽ đến trong ${daysAhead} ngày nữa: ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`;
          }
          
          const notification = await Notification.create({
            projectId: note.projectId,
            type: daysAhead === 0 ? 'error' : 'warning',
            title,
            message,
            metadata: {
              noteId: note._id,
              noteDate: note.date,
              notificationDate: todayStr,
              daysRemaining: daysAhead
            }
          });
          emit('notification:new', notification.toObject());

          // Send Telegram notification
          const telegramMessage = `
🔔 <b>${title}</b>

📅 <b>Thời gian:</b> ${note.date}
📝 <b>Nội dung:</b>
${note.content}

⏰ <i>Thông báo lúc ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>
          `.trim();
          
          await sendTelegramMessage(telegramMessage);
          
          // Cache the notification to prevent duplicates
          await NotificationCache.create({
            noteId: note._id,
            notificationDate: todayStr
          });
          
          totalNotificationsCreated++;
          console.log(`[NOTE_NOTIFICATION] Created notification for note ${note._id} (date: ${note.date}, days ahead: ${daysAhead})`);
        } catch (error) {
          // If duplicate key error (notification already sent), skip silently
          if ((error as any).code === 11000) {
            console.log(`[NOTE_NOTIFICATION] Duplicate notification prevented for note ${note._id}`);
            continue;
          }
          console.error(`[NOTE_NOTIFICATION] Error processing note ${note._id}:`, error);
        }
      }
    }
    
    console.log(`[NOTE_NOTIFICATION] Completed checking notes. Created ${totalNotificationsCreated} notifications.`);
  } catch (error) {
    console.error('[NOTE_NOTIFICATION] Error in checkAndCreateNoteNotifications:', error);
    throw error;
  }
};

/**
 * Check notes and create End of Day notifications (only for today)
 * Runs at 14:00 GMT+7
 * Only sends Telegram message, no database notification. Uses separate cache with '-EOD' suffix.
 */
export const checkAndCreateEndOfDayNotifications = async (): Promise<void> => {
  try {
    // Get current date in GMT+7 (Vietnam timezone)
    const now = new Date();
    const gmt7Offset = 7 * 60; // GMT+7 in minutes
    const localOffset = now.getTimezoneOffset();
    const gmt7Time = new Date(now.getTime() + (gmt7Offset + localOffset) * 60 * 1000);
    
    const today = new Date(gmt7Time.getFullYear(), gmt7Time.getMonth(), gmt7Time.getDate());
    const todayStr = today.toISOString().split('T')[0];
    
    console.log(`[EOD_NOTIFICATION] Starting EOD check for next 3 days (GMT+7: ${todayStr})`);
    
    // Check for notes in the next 3 days: today (0), tomorrow (1), day after tomorrow (2)
    const daysToCheck = [0, 1, 2];
    let totalMessagesSent = 0;
    
    for (const daysAhead of daysToCheck) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`[EOD_NOTIFICATION] Checking notes for date: ${targetDateStr} (${daysAhead} days ahead)`);
      
      // Find all notes scheduled for the target date
      const notes = await Note.find({ date: targetDateStr });
      
      if (notes.length === 0) {
        console.log(`[EOD_NOTIFICATION] No notes found for ${targetDateStr}`);
        continue;
      }
      
      console.log(`[EOD_NOTIFICATION] Found ${notes.length} notes for ${targetDateStr}`);

      for (const note of notes) {
        try {
          // Check if EOD notification already sent today for this note
          // We append '-EOD' to the date to distinguish from morning notifications
          const cacheKey = `${todayStr}-EOD`;
          
          const existingCache = await NotificationCache.findOne({
            noteId: note._id,
            notificationDate: cacheKey
          });
          
          if (existingCache) {
            console.log(`[EOD_NOTIFICATION] EOD Telegram already sent today for note ${note._id}`);
            continue;
          }
          
          // Create title and message based on days remaining
          let title: string;
          
          if (daysAhead === 0) {
            title = 'Nhắc nhở cuối ngày: Ghi chú hôm nay';
          } else if (daysAhead === 1) {
            title = 'Nhắc nhở cuối ngày: Ghi chú ngày mai';
          } else {
            title = 'Nhắc nhở cuối ngày: Ghi chú sắp đến hạn';
          }
          
          // Send Telegram notification
          const telegramMessage = `
🌙 <b>${title}</b>

📅 <b>Thời gian:</b> ${note.date}
📝 <b>Nội dung:</b>
${note.content}

⏰ <i>Thông báo cuối ngày lúc ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>
          `.trim();
          
          await sendTelegramMessage(telegramMessage);
          
          // Cache the notification to prevent duplicates
          await NotificationCache.create({
            noteId: note._id,
            notificationDate: cacheKey
          });
          
          totalMessagesSent++;
          console.log(`[EOD_NOTIFICATION] Sent EOD Telegram for note ${note._id} (date: ${note.date}, days ahead: ${daysAhead})`);
        } catch (error) {
          if ((error as any).code === 11000) {
            console.log(`[EOD_NOTIFICATION] Duplicate cache prevented for note ${note._id}`);
            continue;
          }
          console.error(`[EOD_NOTIFICATION] Error processing note ${note._id}:`, error);
        }
      }
    }
    
    console.log(`[EOD_NOTIFICATION] Completed EOD check. Sent ${totalMessagesSent} Telegram messages.`);
  } catch (error) {
    console.error('[EOD_NOTIFICATION] Error in checkAndCreateEndOfDayNotifications:', error);
    throw error;
  }
};

/**
 * Clean up old notification cache entries (older than 7 days)
 */
export const cleanupNotificationCache = async (): Promise<void> => {
  try {
    // Get current date in GMT+7 (Vietnam timezone)
    const now = new Date();
    const gmt7Offset = 7 * 60; // GMT+7 in minutes
    const localOffset = now.getTimezoneOffset();
    const gmt7Time = new Date(now.getTime() + (gmt7Offset + localOffset) * 60 * 1000);
    
    const sevenDaysAgo = new Date(gmt7Time);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const result = await NotificationCache.deleteMany({
      createdAt: { $lt: sevenDaysAgo }
    });
    
    console.log(`[NOTE_NOTIFICATION] Cleaned up ${result.deletedCount} old cache entries`);
  } catch (error) {
    console.error('[NOTE_NOTIFICATION] Error cleaning up cache:', error);
  }
};
