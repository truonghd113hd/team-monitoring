import EndpointCheck from '../models/EndpointCheck';
import UptimeRollup from '../models/UptimeRollup';

const toIsoDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Compute uptime for an endpoint over the last `days` days. Combines persisted
 * UptimeRollup rows for completed days with on-the-fly aggregation for today.
 */
export const getEndpointUptime = async (
  endpointId: string,
  days: number
): Promise<{
  uptimePct: number;
  totalChecks: number;
  downCount: number;
  avgResponseTimeMs: number;
  timeline: Array<{ date: string; uptimePct: number; totalChecks: number }>;
}> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const startIso = toIsoDate(start);
  const todayIso = toIsoDate(today);

  const rollups = await UptimeRollup.find({
    endpointId,
    date: { $gte: startIso, $lt: todayIso }
  }).lean();

  // On-the-fly for today
  const todayChecks = await EndpointCheck.find({
    endpointId,
    checkedAt: { $gte: today }
  }).lean();
  const todayUp = todayChecks.filter(c => c.status === 'up').length;
  const todayTotal = todayChecks.length;
  const todayAvgRt = todayTotal > 0
    ? todayChecks.reduce((s, c) => s + (c.responseTimeMs || 0), 0) / todayTotal
    : 0;

  const timeline: Array<{ date: string; uptimePct: number; totalChecks: number }> = [];
  const rollupByDate = new Map(rollups.map(r => [r.date, r]));
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = toIsoDate(d);
    if (iso === todayIso) {
      timeline.push({
        date: iso,
        uptimePct: todayTotal > 0 ? (todayUp / todayTotal) * 100 : 100,
        totalChecks: todayTotal
      });
    } else {
      const r = rollupByDate.get(iso);
      timeline.push({
        date: iso,
        uptimePct: r ? r.uptimePct : 100,
        totalChecks: r ? r.totalChecks : 0
      });
    }
  }

  const totalUp = rollups.reduce((s, r) => s + r.upChecks, 0) + todayUp;
  const totalChecks = rollups.reduce((s, r) => s + r.totalChecks, 0) + todayTotal;
  const avgRtSum =
    rollups.reduce((s, r) => s + r.avgResponseTimeMs * r.totalChecks, 0) +
    todayAvgRt * todayTotal;
  const avgResponseTimeMs = totalChecks > 0 ? avgRtSum / totalChecks : 0;

  return {
    uptimePct: totalChecks > 0 ? (totalUp / totalChecks) * 100 : 100,
    totalChecks,
    downCount: totalChecks - totalUp,
    avgResponseTimeMs,
    timeline
  };
};

/**
 * Compute rollups for yesterday across all endpoints with checks in that window.
 */
export const rollupYesterday = async (): Promise<number> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayIso = toIsoDate(yesterday);

  const aggregation = await EndpointCheck.aggregate([
    { $match: { checkedAt: { $gte: yesterday, $lt: today } } },
    {
      $group: {
        _id: '$endpointId',
        upChecks: { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
        totalChecks: { $sum: 1 },
        avgResponseTimeMs: { $avg: '$responseTimeMs' }
      }
    }
  ]);

  let count = 0;
  for (const row of aggregation) {
    await UptimeRollup.updateOne(
      { endpointId: row._id, date: yesterdayIso },
      {
        $set: {
          upChecks: row.upChecks,
          totalChecks: row.totalChecks,
          uptimePct: row.totalChecks > 0 ? (row.upChecks / row.totalChecks) * 100 : 100,
          avgResponseTimeMs: row.avgResponseTimeMs || 0
        }
      },
      { upsert: true }
    );
    count++;
  }
  return count;
};
