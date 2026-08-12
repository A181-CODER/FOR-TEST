import crypto from 'node:crypto';
import { Pool } from 'pg';
import { readBearerToken, verifySessionToken } from './_auth.js';

if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is not configured');
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

function headers(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sanitizeAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).map((ans) => (typeof ans === 'string' ? ans.trim().slice(0, 10000) : ''));
}

export default async function handler(req, res) {
  headers(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let auth;
  try {
    auth = verifySessionToken(readBearerToken(req));
  } catch (error) {
    console.error('Submission auth error:', error.message);
    return res.status(503).json({ error: 'التوثيق غير مهيأ على الخادم' });
  }
  if (!auth) return res.status(401).json({ error: 'جلسة التوثيق غير صالحة أو منتهية' });

  const body = req.body || {};
  const sessionId = body.sessionId;
  const studentId = String(body.studentId || '');
  const examId = isUuid(body.examId) ? body.examId : null;
  const answers = sanitizeAnswers(body.answers);
  const attachmentInfo = body.attachment && typeof body.attachment === 'object' ? {
    name: String(body.attachment.name || '').slice(0, 255),
    size: Number(body.attachment.size) || 0,
    type: String(body.attachment.type || '').slice(0, 64),
  } : {};

  if (!isUuid(sessionId) || !/^\d{4,20}$/.test(studentId)) {
    return res.status(400).json({ error: 'معرّفات الجلسة أو الطالب غير صالحة' });
  }
  if (auth.studentId !== studentId) {
    return res.status(403).json({ error: 'الجلسة لا تخص هذا الطالب' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // تحقق من وجود الجلسة أو إنشائها لو لم تكن مسجلة
    await client.query(
      `INSERT INTO exam_sessions (session_id, student_id, exam_subject, status, risk_score, event_count, submitted_at)
       VALUES ($1, $2, $3, 'submitted', 0, 0, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id) DO UPDATE SET
         status = 'submitted',
         submitted_at = COALESCE(exam_sessions.submitted_at, CURRENT_TIMESTAMP)`,
      [sessionId, studentId, String(body.examSubject || 'اختبار').slice(0, 200)],
    );

    const submissionId = crypto.randomUUID();
    await client.query(
      `INSERT INTO exam_submissions (submission_id, session_id, student_id, exam_id, answers, attachment_info, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'submitted')
       ON CONFLICT (session_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         attachment_info = EXCLUDED.attachment_info,
         submitted_at = CURRENT_TIMESTAMP`,
      [submissionId, sessionId, studentId, examId, JSON.stringify(answers), JSON.stringify(attachmentInfo)],
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, submissionId });
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error('Submission persistence error:', error.message);
    return res.status(500).json({ error: 'تعذر حفظ إجابات الامتحان على الخادم' });
  } finally {
    client?.release();
  }
}
