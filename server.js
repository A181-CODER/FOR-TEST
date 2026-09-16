const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log(`${req.method} ${req.url}`);

  // خدمة الملفات الثابتة
  if (req.method === 'GET') {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    
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

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
    return;
  }

  // API endpoints (محاكاة بسيطة بدون قاعدة بيانات حقيقية للتجربة)
  if (req.url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        
        // محاكاة قاعدة البيانات للتجربة - في الإنتاج استخدم PostgreSQL الحقيقي
        const mockStudents = {
          '921240008': 'أحمد حموده قرني سلامة',
          '921240012': 'أحمد سعيد عبدالله محمود',
          '921240001': 'ابراهيم السيد عبدالحميد السيد',
          '921230001': 'ابراهيم احمد حمدى احمد'
        };
        
        if (mockStudents[id]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, name: mockStudents[id] }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'الرقم غير مسجل في قاعدة البيانات' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  if (req.url === '/api/log_violation' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Violation logged:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'logged' }));
    });
    return;
  }

  if (req.url === '/api/submit_exam' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Exam submitted:', body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'submitted', message: 'تم التسليم بنجاح' }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 HNUSIS Proctoring Server running on http://localhost:${PORT}`);
  console.log(`📝 Admin panel: http://localhost:${PORT}/admin.html`);
});
