import crypto from 'node:crypto';
import { Pool } from 'pg';

if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is not configured');
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

function adminAuthorized(req) {
  const expected = process.env.ADMIN_API_KEY;
  const received = req.headers?.['x-admin-key'];
  if (!expected || !received) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(received));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function headers(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(req, res) {
  headers(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صالح' });

  const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId : null;
  let client;
  try {
    client = await pool.connect();
    if (sessionId) {
      if (!isUuid(sessionId)) return res.status(400).json({ error: 'معرّف الجلسة غير صالح' });
      const result = await client.query(
        `SELECT e.sequence_no, e.event_type, e.message, e.severity, e.risk_points, e.occurred_at, e.metadata, e.event_hash
         FROM proctor_events e WHERE e.session_id = $1 ORDER BY e.sequence_no ASC`,
        [sessionId],
      );
      return res.status(200).json({ sessionId, events: result.rows });
    }

    const result = await client.query(
      `SELECT s.session_id, s.student_id, st.name AS student_name, s.exam_subject, s.started_at,
              s.submitted_at, s.status, s.risk_score, s.event_count,
              COALESCE((SELECT e.message FROM proctor_events e WHERE e.session_id = s.session_id ORDER BY e.occurred_at DESC LIMIT 1), '') AS latest_event
       FROM exam_sessions s
       JOIN students st ON st.id = s.student_id
       WHERE s.started_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
       ORDER BY s.started_at DESC LIMIT 200`,
    );
    return res.status(200).json({ sessions: result.rows });
  } catch (error) {
    console.error('Session dashboard error:', error.message);
    return res.status(500).json({ error: 'تعذر تحميل جلسات الامتحان' });
  } finally {
    client?.release();
  }
}
