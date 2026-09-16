const { Pool } = require('pg');

// إعداد قاعدة البيانات
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/hnusis_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // مسار تسجيل الدخول
  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { id } = JSON.parse(body);
        
        if (!id) {
          return res.status(400).json({ error: 'الرقم الجامعي مطلوب' });
        }

        const client = await pool.connect();
        const result = await client.query('SELECT name FROM students WHERE id = $1', [id]);
        client.release();

        if (result.rows.length > 0) {
          return res.status(200).json({ success: true, name: result.rows[0].name });
        } else {
          return res.status(404).json({ error: 'الرقم غير مسجل في قاعدة البيانات' });
        }
      } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'خطأ في الاتصال بقاعدة البيانات' });
      }
    });
    return;
  }

  // مسار تسجيل المخالفات
  if (req.url === '/api/log_violation' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { student_id, violation, timestamp } = JSON.parse(body);
        
        const client = await pool.connect();
        await client.query(
          'INSERT INTO cheating_logs (student_id, violation_type, timestamp) VALUES ($1, $2, $3)',
          [student_id, violation, timestamp]
        );
        client.release();

        return res.status(200).json({ status: 'logged' });
      } catch (error) {
        console.error('Log Error:', error);
        return res.status(500).json({ error: 'فشل تسجيل المخالفة' });
      }
    });
    return;
  }

  // مسار تسليم الامتحان
  if (req.url === '/api/submit_exam' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { student_id, student_name, subject, answers, uploaded_file, violations, submission_time } = JSON.parse(body);
        
        const client = await pool.connect();
        
        // حفظ الإجابات
        await client.query(
          `INSERT INTO exam_submissions 
           (student_id, student_name, subject, answers, uploaded_file, violations, submission_time) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [student_id, student_name, subject, JSON.stringify(answers), uploaded_file, JSON.stringify(violations), submission_time]
        );
        
        client.release();

        return res.status(200).json({ status: 'submitted', message: 'تم التسليم بنجاح' });
      } catch (error) {
        console.error('Submit Error:', error);
        return res.status(500).json({ error: 'فشل تسليم الامتحان' });
      }
    });
    return;
  }

  // الصفحة الرئيسية
  if (req.url === '/' && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html');
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    return res.status(200).send(html);
  }

  // خدمة الملفات الثابتة
  if (req.method === 'GET') {
    const fs = require('fs');
    const path = require('path');
    
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, '..', filePath.replace('/api', ''));
    
    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
      case '.js': contentType = 'application/javascript'; break;
      case '.css': contentType = 'text/css'; break;
      case '.json': contentType = 'application/json'; break;
      case '.png': contentType = 'image/png'; break;
      case '.jpg': contentType = 'image/jpeg'; break;
      case '.html': contentType = 'text/html'; break;
    }

    try {
      const content = fs.readFileSync(filePath);
      res.setHeader('Content-Type', contentType);
      return res.status(200).send(content);
    } catch (e) {
      return res.status(404).json({ error: 'File not found' });
    }
  }

  return res.status(404).json({ error: 'Not Found' });
};
