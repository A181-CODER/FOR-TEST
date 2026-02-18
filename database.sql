-- جدول الطلاب والمراقبين
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    role ENUM('student', 'dean', 'proctor'),
    facial_id_hash VARCHAR(255) -- لتأكيد الهوية بالذكاء الاصطناعي
);

-- جدول الامتحانات
CREATE TABLE exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(100),
    start_time DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

-- سجلات كشف الغش (أهم جدول)
CREATE TABLE cheating_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    exam_id INT,
    violation_type VARCHAR(50), -- Look_Away, Mobile_Detected, Voice_Detected
    confidence_score FLOAT,    -- نسبة تأكد الذكاء الاصطناعي
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);