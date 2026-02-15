// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Background Jobs (Cron)
// ─────────────────────────────────────────────────────────────

import { Cron } from 'croner';
import { markStaleAgentsOffline } from '../services/agent.service.js';
import { checkJobTimeouts } from '../services/job.service.js';
import { query } from '../db/connection.js';

export function startBackgroundJobs(): void {
  // Check for stale agents every 30 seconds
  Cron('*/30 * * * * *', async () => {
    try {
      await markStaleAgentsOffline(90);
    } catch (error) {
      console.error('Failed to check stale agents:', error);
    }
  });

  // Check for timed out jobs every 15 seconds
  Cron('*/15 * * * * *', async () => {
    try {
      await checkJobTimeouts();
    } catch (error) {
      console.error('Failed to check job timeouts:', error);
    }
  });

  // Clean up old metrics (retention: 30 days)
  Cron('0 3 * * *', async () => {
    try {
      await query(
        `DELETE FROM metrics_timeseries WHERE timestamp < NOW() - INTERVAL '30 days'`,
      );
      console.log('🧹 Cleaned old metrics data');
    } catch (error) {
      console.error('Failed to clean old metrics:', error);
    }
  });

  console.log('⏰ Background jobs started');
}
