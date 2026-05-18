/**
 * Standalone job for checking and creating note notifications
 * Can be run independently from the main server
 * Usage: npm run job:note-notifications
 */

import dotenv from 'dotenv';
import connectDB from '../config/database';
import { checkAndCreateNoteNotifications, checkAndCreateEndOfDayNotifications, cleanupNotificationCache } from '../services/noteNotificationService';

dotenv.config();

const runNotificationJob = async () => {
  console.log('🔔 Note Notification Job Started');
  console.log(`⏰ Current time (GMT+7): ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  
  try {
    // Connect to database
    await connectDB();
    
    // Check and create notifications
    await checkAndCreateNoteNotifications();
    
    console.log('✅ Note notification job completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Note notification job failed:', error);
    process.exit(1);
  }
};

const runCleanupJob = async () => {
  console.log('🧹 Notification Cache Cleanup Job Started');
  
  try {
    // Connect to database
    await connectDB();
    
    // Clean up old cache entries
    await cleanupNotificationCache();
    
    console.log('✅ Cache cleanup job completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Cache cleanup job failed:', error);
    process.exit(1);
  }
};

const runEodNotificationJob = async () => {
  console.log('🌙 EOD Notification Job Started');
  console.log(`⏰ Current time (GMT+7): ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
  
  try {
    // Connect to database
    await connectDB();
    
    // Check and create EOD notifications
    await checkAndCreateEndOfDayNotifications();
    
    console.log('✅ EOD notification job completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ EOD notification job failed:', error);
    process.exit(1);
  }
};

// Parse command line arguments
const jobType = process.argv[2] || 'notification';

if (jobType === 'cleanup') {
  runCleanupJob();
} else if (jobType === 'eod') {
  runEodNotificationJob();
} else {
  runNotificationJob();
}
