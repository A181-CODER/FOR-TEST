import { Pool } from 'pg';
import { createSessionToken } from './_auth.js';

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

export default async function handler(req, res) {
  headers(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = req.body || {};
  const ltiMessage = body.lti_message_type || body.message_type;
  const studentId = String(body.student_id || body.user_id || '').trim();
  const email = String(body.email || '').trim().toLowerCase();

  if (!studentId && !email) {
    return res.status(400).json({ error: 'معرّف الطالب أو البريد الإلكتروني مفقود من رسالة LTI' });
  }

  let client;
  try {
    client = await pool.connect();
    let query = 'SELECT id, name FROM students WHERE id::text = $1';
    let params = [studentId];
    if (!studentId && email) {
      query = 'SELECT id, name FROM students WHERE lower(name) = $1 OR id::text IN (SELECT id::text FROM students)';
      params = [email];
    }
    const result = await client.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'الطالب القادم من منصة التعلم غير مسجل في قاعدة بيانات النظام' });
    }
    const student = result.rows[0];
    const sessionToken = createSessionToken(student.id);
    return res.status(200).json({
      success: true,
      message: 'تم ربط جلسة LTI بنجاح',
      studentId: student.id,
      name: student.name,
      sessionToken,
      launchType: ltiMessage || 'LtiResourceLinkRequest',
    });
  } catch (error) {
    console.error('LTI launch error:', error.message);
    return res.status(500).json({ error: 'تعذر معالجة طلب LTI على الخادم' });
  } finally {
    client?.release();
  }
}
