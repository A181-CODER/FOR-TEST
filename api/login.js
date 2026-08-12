import { Pool } from 'pg';
import { createSessionToken } from './_auth.js';

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not configured');
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

function setCommonHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

function normalizeId(value) {
  const id = String(value ?? '').trim();
  return /^\d{4,20}$/.test(id) ? id : null;
}

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const id = normalizeId(req.body?.id);
  if (!id) return res.status(400).json({ error: 'الرقم الجامعي غير صالح' });

  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT id, name FROM students WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'الرقم غير مسجل' });
    const student = result.rows[0];
    return res.status(200).json({
      success: true,
      name: student.name,
      sessionToken: createSessionToken(student.id),
      expiresIn: 2 * 60 * 60,
    });
  } catch (error) {
    console.error('Login database error:', error.message);
    return res.status(500).json({ error: 'تعذر الاتصال بقاعدة البيانات' });
  } finally {
    client?.release();
  }
}
