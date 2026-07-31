import AlertRule, { IAlertRule } from '../models/AlertRule';
import AlertEvent from '../models/AlertEvent';
import EndpointCheck from '../models/EndpointCheck';
import HostMetric from '../models/HostMetric';
import Endpoint from '../models/Endpoint';
import Host from '../models/Host';
import MonitorProject from '../models/MonitorProject';
import MonitorEnvironment from '../models/MonitorEnvironment';
import { sendTelegramMessage } from './telegramService';
import { emit } from './wsService';
import { restartPm2Process } from './pm2RestartService';

interface ParsedCondition {
  key: 'down' | '5xx' | 'responseTimeMs' | 'cpuPct' | 'memPct' | 'diskPct' | 'agentSilent';
  op?: '>' | '<' | '>=' | '<=';
  threshold?: number;
}

const parseCondition = (raw: string): ParsedCondition | null => {
  const c = raw.trim();
  if (c === 'down' || c === '5xx' || c === 'agentSilent') return { key: c };
  const m = c.match(/^(responseTimeMs|cpuPct|memPct|diskPct)\s*(>=|<=|>|<)\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  return {
    key: m[1] as ParsedCondition['key'],
    op: m[2] as ParsedCondition['op'],
    threshold: parseFloat(m[3])
  };
};

const compare = (value: number, op: ParsedCondition['op'], threshold: number): boolean => {
  switch (op) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    default: return false;
  }
};

const sampleViolates = (sample: any, cond: ParsedCondition, targetType: 'endpoint' | 'host'): boolean => {
  if (targetType === 'endpoint') {
    if (cond.key === 'down') return sample.status === 'down';
    if (cond.key === '5xx') return typeof sample.httpStatus === 'number' && sample.httpStatus >= 500;
    if (cond.key === 'responseTimeMs') {
      if (typeof sample.responseTimeMs !== 'number') return false;
      return compare(sample.responseTimeMs, cond.op, cond.threshold!);
    }
    return false;
  }
  // host
  if (cond.key === 'cpuPct') return compare(sample.cpuPct ?? 0, cond.op, cond.threshold!);
  if (cond.key === 'memPct') return compare(sample.memPct ?? 0, cond.op, cond.threshold!);
  if (cond.key === 'diskPct') {
    const max = (sample.disk || []).reduce((m: number, d: any) => Math.max(m, d.usedPct), 0);
    return compare(max, cond.op, cond.threshold!);
  }
  return false;
};

const formatAlertContext = async (rule: IAlertRule): Promise<{ context: string; targetName: string }> => {
  const project = await MonitorProject.findById(rule.projectId).lean();
  let envName = '';
  let targetName = '';
  let extra = '';
  if (rule.targetType === 'endpoint') {
    const ep = await Endpoint.findById(rule.targetId).lean();
    if (ep) {
      targetName = ep.name;
      extra = `URL: ${ep.url}`;
      const env = await MonitorEnvironment.findById(ep.environmentId).lean();
      envName = env?.name || '';
    }
  } else {
    const h = await Host.findById(rule.targetId).lean();
    if (h) {
      targetName = h.name;
      extra = `Mode: ${h.mode}`;
      const env = await MonitorEnvironment.findById(h.environmentId).lean();
      envName = env?.name || '';
    }
  }
  const context = `Project: ${project?.name || '?'}\nEnv: ${envName || '?'}\n${extra}`;
  return { context, targetName: `${envName || '?'} / ${targetName || '?'}` };
};

const getProjectChatId = async (rule: IAlertRule): Promise<string | null> => {
  const project = await MonitorProject.findById(rule.projectId).lean();
  return project?.telegramChatId || null;
};

interface EvaluationResult {
  violates: boolean;
  latestSample: any | null;
  reason: string;
}

const evaluateRule = async (rule: IAlertRule, cond: ParsedCondition): Promise<EvaluationResult> => {
  const since = new Date(Date.now() - rule.forMinutes * 60 * 1000);

  if (rule.targetType === 'endpoint') {
    const samples = await EndpointCheck.find({
      endpointId: rule.targetId,
      checkedAt: { $gte: since }
    }).sort({ checkedAt: -1 }).lean();
    if (samples.length === 0) return { violates: false, latestSample: null, reason: 'no samples in window' };
    const allBad = samples.every(s => sampleViolates(s, cond, 'endpoint'));
    const reason = allBad
      ? cond.key === 'down' || cond.key === '5xx'
        ? `${samples.length} consecutive failures (last HTTP ${samples[0].httpStatus ?? 'n/a'})`
        : `${cond.key} ${cond.op} ${cond.threshold} for ${rule.forMinutes}m`
      : 'condition cleared';
    return { violates: allBad, latestSample: samples[0], reason };
  }

  // host
  if (cond.key === 'agentSilent') {
    const host = await Host.findById(rule.targetId).lean();
    if (!host) return { violates: false, latestSample: null, reason: 'host not found' };
    const ageMs = host.lastSampledAt ? Date.now() - new Date(host.lastSampledAt).getTime() : Infinity;
    const violates = ageMs > rule.forMinutes * 60 * 1000;
    return {
      violates,
      latestSample: host,
      reason: violates ? `no agent sample for ${Math.round(ageMs / 60000)} min` : 'agent reporting'
    };
  }
  const samples = await HostMetric.find({
    hostId: rule.targetId,
    sampledAt: { $gte: since }
  }).sort({ sampledAt: -1 }).lean();
  if (samples.length === 0) return { violates: false, latestSample: null, reason: 'no samples in window' };
  const allBad = samples.every(s => sampleViolates(s, cond, 'host'));
  const reason = allBad
    ? `${cond.key} ${cond.op} ${cond.threshold} for ${rule.forMinutes}m (last=${
        cond.key === 'diskPct'
          ? Math.max(...samples[0].disk.map(d => d.usedPct)).toFixed(1)
          : (samples[0] as any)[cond.key]?.toFixed?.(1)
      })`
    : 'condition cleared';
  return { violates: allBad, latestSample: samples[0], reason };
};

const runRestartAction = async (rule: IAlertRule): Promise<string> => {
  if (!rule.restartOnFire || !rule.restartHostId || !rule.restartPm2Process) return '';
  const host = await Host.findById(rule.restartHostId);
  if (!host) return `\n⚠️ Restart skipped: host ${rule.restartHostId} not found`;
  const result = await restartPm2Process(host, rule.restartPm2Process);
  console.log(`[ALERT_ENGINE] pm2 restart ${rule.restartPm2Process}@${host.name}: ${result.ok ? 'OK' : 'FAILED'} — ${result.message}`);
  return result.ok
    ? `\n🔧 Restarted pm2 process <b>${rule.restartPm2Process}</b> on ${host.name}`
    : `\n⚠️ pm2 restart failed on ${host.name}: ${result.message}`;
};

export const evaluateAllRules = async (): Promise<void> => {
  const rules = await AlertRule.find({ enabled: true });
  console.log(`[ALERT_ENGINE] Evaluating ${rules.length} rules`);

  for (const rule of rules) {
    try {
      const cond = parseCondition(rule.condition);
      if (!cond) {
        console.warn(`[ALERT_ENGINE] Invalid condition on rule ${rule._id}: "${rule.condition}"`);
        continue;
      }
      const { violates, reason } = await evaluateRule(rule, cond);
      const firing = await AlertEvent.findOne({ ruleId: rule._id, state: 'firing' });

      if (violates) {
        const { context, targetName } = await formatAlertContext(rule);
        const chatId = await getProjectChatId(rule);
        if (!firing) {
          const event = await AlertEvent.create({
            ruleId: rule._id,
            targetType: rule.targetType,
            targetId: rule.targetId,
            projectId: rule.projectId,
            firedAt: new Date(),
            state: 'firing',
            lastNotifiedAt: new Date(),
            message: reason
          });
          const restartNote = await runRestartAction(rule);
          const msg = `🚨 <b>[FIRING] ${targetName}</b>\n<b>Rule:</b> ${rule.name}\n${reason}\n${context}${restartNote}\n<i>Fired ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>`;
          await sendTelegramMessage(msg, chatId);
          emit('alert:event', {
            eventId: String(event._id),
            ruleId: String(rule._id),
            targetId: String(rule.targetId),
            targetType: rule.targetType,
            projectId: String(rule.projectId),
            state: 'firing',
            message: reason,
            firedAt: event.firedAt
          });
          console.log(`[ALERT_ENGINE] FIRED rule ${rule._id} → event ${event._id}`);
        } else {
          const lastNotifiedAge = firing.lastNotifiedAt
            ? Date.now() - firing.lastNotifiedAt.getTime()
            : Infinity;
          if (lastNotifiedAge > rule.renotifyMinutes * 60 * 1000) {
            const restartNote = await runRestartAction(rule);
            const msg = `🔁 <b>[STILL FIRING] ${targetName}</b>\n<b>Rule:</b> ${rule.name}\n${reason}\n${context}${restartNote}`;
            await sendTelegramMessage(msg, chatId);
            firing.lastNotifiedAt = new Date();
            await firing.save();
          }
        }
      } else if (firing) {
        firing.state = 'recovered';
        firing.recoveredAt = new Date();
        await firing.save();
        const { context, targetName } = await formatAlertContext(rule);
        const chatId = await getProjectChatId(rule);
        const msg = `✅ <b>[RESOLVED] ${targetName}</b>\n<b>Rule:</b> ${rule.name}\n${context}\n<i>Recovered ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</i>`;
        await sendTelegramMessage(msg, chatId);
        emit('alert:event', {
          eventId: String(firing._id),
          ruleId: String(rule._id),
          targetId: String(rule.targetId),
          targetType: rule.targetType,
          projectId: String(rule.projectId),
          state: 'recovered',
          recoveredAt: firing.recoveredAt
        });
        console.log(`[ALERT_ENGINE] RESOLVED rule ${rule._id}`);
      }
    } catch (err) {
      console.error(`[ALERT_ENGINE] Error evaluating rule ${rule._id}:`, (err as Error).message);
    }
  }
};
