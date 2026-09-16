# 🛡️ HNUSIS AI Proctoring System
## نظام الاختبارات الذكي للمراقبة بالذكاء الاصطناعي

![Project Status](https://img.shields.io/badge/Status-Production_Ready-success)
![Tech Stack](https://img.shields.io/badge/AI-Google_MediaPipe-blue)
![Security](https://img.shields.io/badge/Security-Anti_Cheat-red)

---

## 📖 نظرة عامة

**HNUSIS Proctor** هو منصة اختبارات متطورة تعمل على المتصفح مباشرة، مصممة لضمان نزاهة الامتحانات الإلكترونية. يستخدم النظام **Edge AI** لتحليل سلوك الطالب في الوقت الفعلي دون الحاجة لبث الفيديو للسيرفر.

### ✨ المميزات الرئيسية

#### 🧠 المراقبة الذكية (AI Core)
- **تتبع النظرات:** استخدام `Google MediaPipe Face Mesh` لحساب اتجاه رأس الطالب
- **كشف الغش الفوري:** اكتشاف الالتفات يميناً أو يساراً
- **الخصوصية أولاً:** معالجة الفيديو محلياً على جهاز الطالب

#### 🔒 الأمان والنزاهة
- **عقوبة حجب الشاشة:** عند إخفاء الوجه أو إغلاق الكاميرا
- **التحقق من الهوية:** التكامل مع قاعدة بيانات الطلاب
- **منع النسخ واللصق:** تعطيل الزر الأيمن وأدوات المطور
- **كشف تغيير التبويب:** تسجيل أي خروج من شاشة الامتحان

#### 🎓 لوحة تحكم الأساتذة
- **إنشاء امتحانات ديناميكية:** أسئلة، مؤقت، وروابط مشفرة
- **نظام رفع الملفات:** إرفاق إجابات PDF/صور

---

## 🛠️ التقنيات المستخدمة

| المكون | التقنية | الوصف |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, ES6+ | واجهة مستجيبة |
| **AI Engine** | Google MediaPipe | كشف الوجوه 468 landmark |
| **Backend** | Node.js | سيرفر خفيف وسريع |
| **Database** | PostgreSQL | تخزين الطلاب والنتائج |

---

## 🚀 التشغيل السريع

### 1. تثبيت المتطلبات
```bash
# تأكد من وجود Node.js
node --version

# تثبيت المكتبات
npm install
```

### 2. تشغيل السيرفر
```bash
npm start
```

### 3. فتح التطبيق
- **صفحة الطالب:** http://localhost:3000
- **لوحة التحكم:** http://localhost:3000/admin.html

### 4. أرقام تجريبية للدخول
```
921240008 - أحمد حموده قرني سلامة
921240012 - أحمد سعيد عبدالله محمود
921240001 - ابراهيم السيد عبدالحميد السيد
```

---

## 📁 هيكل المشروع

```
/workspace
├── index.html          # صفحة الامتحان الرئيسية
├── admin.html          # لوحة إنشاء الامتحانات
├── server.js           # السيرفر الرئيسي
├── style.css           # التنسيقات
├── package.json        # إعدادات المشروع
├── database.sql        # سكربت قاعدة البيانات
└── api/
    └── index.js        # API endpoints
```

---

## 🔐 كيفية العمل

1. **المصادقة:** يدخل الطالب رقمه الجامعي → التحقق من قاعدة البيانات
2. **التحميل:** تحميل نماذج ML في المتصفح
3. **الحلقة:** 
   - الكاميرا تلتقط إطار
   - AI يرسم 468 نقطة على الوجه
   - حساب نسبة التوجيه: `(Nose_x - LeftEar_x) / (Nose_x - RightEar_x)`
   - إذا النسبة خارج المدى الآمن [0.3 - 3.0] → رفع علم غش

---

## 📊 قاعدة البيانات

الجداول المطلوبة:

```sql
-- جدول الطلاب
CREATE TABLE students (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL
);

-- جدول المخالفات
CREATE TABLE cheating_logs (
    id SERIAL PRIMARY KEY,
    student_id BIGINT,
    violation_type TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- جدول التسليمات
CREATE TABLE exam_submissions (
    id SERIAL PRIMARY KEY,
    student_id BIGINT,
    student_name TEXT,
    subject TEXT,
    answers JSONB,
    uploaded_file TEXT,
    violations JSONB,
    submission_time TIMESTAMPTZ
);
```

---

## 👨‍💻 المؤلف

**Eng. KING ABDO**
- مهندس أنظمة ذكية
- متخصص في الأمن السيبراني

---

*مبني لمستقبل التعليم* 🎓
