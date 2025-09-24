import cron from 'node-cron';
import { updateTrendsCache } from '../services/trendsService.js';

export function startScheduledJobs() {
  // Update trends every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('Running scheduled trends update...');
    try {
      await updateTrendsCache(['business', 'technology', 'marketing', 'finance']);
      console.log('Scheduled trends update completed');
    } catch (error) {
      console.error('Scheduled trends update failed:', error);
    }
  });

  // Initial trends cache population after 5 seconds
  setTimeout(async () => {
    console.log('Populating initial trends cache...');
    try {
      await updateTrendsCache(['business', 'technology', 'marketing']);
      console.log('Initial trends cache populated');
    } catch (error) {
      console.error('Initial trends cache population failed:', error);
    }
  }, 5000);
}