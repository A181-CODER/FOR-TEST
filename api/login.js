import { Pool } from 'pg';

// التأكد من وجود رابط الداتابيز
if (!process.env.POSTGRES_URL) {
  throw new Error('Please add your POSTGRES_URL to .env.local');
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // تضبيط الـ CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { id } = req.body;
    console.log("Trying to login with ID:", id); // ده هيظهر في Logs فيرسل

    try {
      const client = await pool.connect();
      const result = await client.query('SELECT name FROM students WHERE id = $1', [id]);
      client.release();

      if (result.rows.length > 0) {
        console.log("Found:", result.rows[0].name);
        return res.status(200).json({ success: true, name: result.rows[0].name });
      } else {
        console.log("Not Found");
        return res.status(404).json({ error: 'الرقم غير مسجل' });
      }
    } catch (error) {
      console.error("Database Error:", error);
      return res.status(500).json({ error: 'خطأ في الاتصال بقاعدة البيانات', details: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
