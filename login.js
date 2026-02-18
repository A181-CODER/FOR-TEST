// api/login.js
import { Pool } from 'pg';

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // هنجيب الرابط من إعدادات فيرسل
  ssl: {
    rejectUnauthorized: false
  }
});

export default async function handler(req, res) {
  // السماح بطلبات من أي مكان (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'POST') {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'الرجاء إدخال الرقم الجامعي' });
    }

    try {
      // البحث في قاعدة البيانات SQL
      const client = await pool.connect();
      const result = await client.query('SELECT name FROM students WHERE id = $1', [id]);
      client.release();

      if (result.rows.length > 0) {
        // الطالب موجود
        return res.status(200).json({ 
          success: true, 
          name: result.rows[0].name 
        });
      } else {
        // الطالب غير موجود
        return res.status(404).json({ error: 'هذا الرقم غير مسجل في النظام' });
      }

    } catch (error) {
      console.error('Database Error:', error);
      return res.status(500).json({ error: 'خطأ في الاتصال بقاعدة البيانات' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
