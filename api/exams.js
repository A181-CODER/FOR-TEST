import crypto from 'node:crypto';
import { Pool } from 'pg';
import { createExamToken, verifyExamToken } from './_auth.js';

if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is not configured');
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

function jsonHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function text(value, max, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function validAdmin(req) {
  const expected = process.env.ADMIN_API_KEY;
  const received = req.headers?.['x-admin-key'];
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(String(expected));
  const receivedBuffer = Buffer.from(String(received));
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function normalizeQuestions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) return null;
  const questions = value.map((question) => text(question, 2000)).filter(Boolean);
  return questions.length === value.length ? questions : null;
}

export default async function handler(req, res) {
  jsonHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    if (!validAdmin(req)) return res.status(401).json({ error: 'مفتاح الإدارة غير صالح' });
    const subject = text(req.body?.subject, 200);
    const instructor = text(req.body?.instructor, 120, 'غير محدد');
    const durationMinutes = Number(req.body?.durationMinutes);
    const questions = normalizeQuestions(req.body?.questions);
    const ttlHours = Number(req.body?.ttlHours || 72);
    if (!subject || !questions || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
      return res.status(400).json({ error: 'بيانات الامتحان غير صالحة' });
    }
    if (!Number.isFinite(ttlHours) || ttlHours < 1 || ttlHours > 720) return res.status(400).json({ error: 'مدة صلاحية الرابط غير صالحة' });
    const examId = crypto.randomUUID();
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + Math.floor(ttlHours * 60 * 60);
    let client;
    try {
      client = await pool.connect();
      await client.query(
        `INSERT INTO exams (exam_id, subject, instructor, duration_minutes, questions, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, to_timestamp($6))`,
        [examId, subject, instructor, durationMinutes, JSON.stringify(questions), expiresAtSeconds],
      );
      return res.status(201).json({
        success: true,
        examId,
        token: createExamToken(examId, expiresAtSeconds),
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Exam creation error:', error.message);
      return res.status(500).json({ error: 'تعذر إنشاء الامتحان' });
    } finally {
      client?.release();
    }
  }

  if (req.method === 'GET') {
    const token = typeof req.query?.token === 'string' ? req.query.token : '';
    let verified;
    try {
      verified = verifyExamToken(token);
    } catch (error) {
      console.error('Exam token configuration error:', error.message);
      return res.status(503).json({ error: 'توقيع روابط الامتحانات غير مهيأ' });
    }
    if (!verified) return res.status(401).json({ error: 'رابط الامتحان غير صالح أو منتهي' });
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        `SELECT subject, instructor, duration_minutes, questions
         FROM exams WHERE exam_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [verified.examId],
      );
      if (!result.rows.length) return res.status(404).json({ error: 'الامتحان غير موجود أو منتهي' });
      const exam = result.rows[0];
      return res.status(200).json({ s: exam.subject, doc: exam.instructor, t: exam.duration_minutes, q: exam.questions });
    } catch (error) {
      console.error('Exam retrieval error:', error.message);
      return res.status(500).json({ error: 'تعذر تحميل الامتحان' });
    } finally {
      client?.release();
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
