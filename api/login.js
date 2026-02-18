import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL, // لازم تضبط دي في إعدادات فيرسل
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  
  if (req.method === 'POST') {
    const { id } = req.body;
    try {
      const client = await pool.connect();
      // هنا الـ SQL بيشتغل بجد
      const result = await client.query('SELECT name FROM students WHERE id = $1', [id]);
      client.release();

      if (result.rows.length > 0) {
        return res.status(200).json({ success: true, name: result.rows[0].name });
      } else {
        return res.status(404).json({ error: 'الرقم غير مسجل' });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'خطأ في السيرفر' });
    }
  }
}
