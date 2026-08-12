import { Pool } from 'pg';
import { readBearerToken, verifySessionToken } from './_auth.js';

if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is not configured');
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

const EVENT_TYPES = new Set([
  'session_started', 'session_submitted', 'face_missing', 'multiple_faces', 'look_away',
  'audio_activity', 'tab_hidden', 'tab_visible', 'window_blur', 'fullscreen_exit',
  'fullscreen_unavailable', 'blocked_copy', 'blocked_cut', 'blocked_paste', 'blocked_contextmenu',
  'blocked_dragstart', 'blocked_shortcut', 'answer_file_selected',
]);
const SEVERITIES = new Set(['info', 'warning', 'danger']);
const SESSION_STATUSES = new Set(['active', 'submitted', 'expired', 'abandoned']);

function jsonHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = {};
  for (const [key, raw] of Object.entries(value).slice(0, 12)) {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue;
    if (typeof raw === 'string') allowed[key] = raw.slice(0, 300);
    else if (typeof raw === 'number' && Number.isFinite(raw)) allowed[key] = raw;
    else if (typeof raw === 'boolean') allowed[key] = raw;
  }
  return allowed;
}

export default async function handler(req, res) {
  jsonHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let auth;
  try {
    auth = verifySessionToken(readBearerToken(req));
  } catch (error) {
    console.error('Token verification configuration error:', error.message);
    return res.status(503).json({ error: 'التوثيق غير مهيأ على الخادم' });
  }
  if (!auth) return res.status(401).json({ error: 'جلسة التوثيق غير صالحة أو منتهية' });

  const body = req.body || {};
  const sessionId = body.sessionId;
  const studentId = String(body.studentId ?? '');
  const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
  const examSubject = safeText(body.examSubject, 200) || 'غير محدد';
  const status = SESSION_STATUSES.has(body.status) ? body.status : 'active';
  const riskScore = Math.min(Math.max(Number(body.riskScore) || 0, 0), 100);

  if (!isUuid(sessionId) || !/^\d{4,20}$/.test(studentId)) return res.status(400).json({ error: 'بيانات الجلسة غير صالحة' });
  if (auth.studentId !== studentId) return res.status(403).json({ error: 'الجلسة لا تخص هذا الطالب' });
  if (events.length > 500) return res.status(413).json({ error: 'عدد الأحداث أكبر من الحد المسموح' });

  const normalizedEvents = [];
  for (const event of events) {
    const sequenceNo = Number(event?.id);
    if (!Number.isInteger(sequenceNo) || sequenceNo < 1 || sequenceNo > 10000) continue;
    const type = safeText(event?.type, 64);
    const message = safeText(event?.message, 500);
    const severity = safeText(event?.severity, 16);
    const eventHash = safeText(event?.hash, 128);
    const previousHash = safeText(event?.previousHash, 128);
    const occurredAt = new Date(event?.occurredAt);
    if (!EVENT_TYPES.has(type) || !SEVERITIES.has(severity) || !message || !eventHash || !previousHash || Number.isNaN(occurredAt.getTime())) continue;
    normalizedEvents.push({
      sequenceNo,
      type,
      message,
      severity,
      risk: Math.min(Math.max(Number(event?.risk) || 0, 0), 100),
      occurredAt,
      metadata: safeMetadata(event?.metadata),
      previousHash,
      eventHash,
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO exam_sessions (session_id, student_id, exam_subject, status, risk_score, event_count, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $4 = 'submitted' THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT (session_id) DO UPDATE SET
         status = EXCLUDED.status,
         risk_score = GREATEST(exam_sessions.risk_score, EXCLUDED.risk_score),
         event_count = GREATEST(exam_sessions.event_count, EXCLUDED.event_count),
         submitted_at = CASE WHEN EXCLUDED.status = 'submitted' THEN COALESCE(exam_sessions.submitted_at, CURRENT_TIMESTAMP) ELSE exam_sessions.submitted_at END`,
      [sessionId, studentId, examSubject, status, riskScore, normalizedEvents.length],
    );

    let accepted = 0;
    for (const event of normalizedEvents) {
      const result = await client.query(
        `INSERT INTO proctor_events
          (session_id, sequence_no, event_type, message, severity, risk_points, occurred_at, metadata, previous_hash, event_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         ON CONFLICT (session_id, sequence_no) DO NOTHING`,
        [sessionId, event.sequenceNo, event.type, event.message, event.severity, event.risk, event.occurredAt, JSON.stringify(event.metadata), event.previousHash, event.eventHash],
      );
      accepted += result.rowCount;
    }
    await client.query('COMMIT');
    return res.status(200).json({ success: true, accepted, received: normalizedEvents.length });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('Audit persistence error:', error.message);
    return res.status(500).json({ error: 'تعذر حفظ سجل الجلسة' });
  } finally {
    client?.release();
  }
}
