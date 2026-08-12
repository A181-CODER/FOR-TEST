# 🛡️ HNUSIS AI Proctoring System
### Next-Gen Secure Examination Platform with Edge AI Monitoring

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Tech Stack](https://img.shields.io/badge/AI-Google_MediaPipe-blue)
![Security](https://img.shields.io/badge/Security-Anti_Cheat-red)
![Backend](https://img.shields.io/badge/Backend-Serverless-black)

## 📖 Overview

**HNUSIS Proctor** is a smart, browser-based examination platform designed to ensure the integrity of online exams. Unlike traditional systems that stream video to a server (high cost/latency), this system utilizes **Client-Side Edge AI** to analyze student behavior in real-time within the browser.

This project was developed to solve the problem of **scalable secure testing**, allowing thousands of students to take exams simultaneously without overloading university servers.

## ✨ Key Features

### 🧠 Intelligent Monitoring (AI Core)
*   **Real-time Gaze Tracking:** Uses `Google MediaPipe Face Mesh` to calculate the **Yaw & Pitch** of the student's head.
*   **Instant Cheating Detection:** Detects if the student looks away (Left/Right) for more than a specific threshold (Geometry-based logic).
*   **Privacy-First:** Video streams are processed locally on the client's device. No video is sent to the server, preserving student privacy.

### 🔒 Security & Integrity
*   **Camera Blackout Penalty:** If the student covers the camera or leaves the frame, the exam screen is instantly blocked.
*   **Identity Verification:** Integration with a student database (SQL/JSON) to verify Student IDs before entry.
*   **Tamper-Proof Timers:** Server-synced countdowns to prevent client-side manipulation.

### 🎓 Faculty Dashboard
*   **Dynamic Exam Generation:** Professors can create exams, set timers, and generate **Encrypted Exam Links**.
*   **Serverless Deployment:** No database setup required for the exam content; questions are encoded directly into the URL for easy sharing.

## 🛠️ Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JS (ES6+) | Responsive UI with Real-time Canvas rendering. |
| **AI Engine** | Google MediaPipe | Lightweight Machine Learning models for Face Mesh. |
| **Backend** | Node.js (Vercel Functions) | API for authentication and secure logging. |
| **Database** | PostgreSQL (Supabase) | Storing student records (IDs, Names, Logs). |
| **Hosting** | Vercel | Serverless edge deployment. |

## 🚀 How It Works (The Engineering Part)

1.  **Authentication:** The student enters their University ID. The system queries the SQL database via a secure API.
2.  **Initialization:** The browser loads the ML models (TinyFaceDetector) into memory.
3.  **The Loop:** 
    *   The webcam captures a frame.
    *   The AI maps **468 facial landmarks**.
    *   The algorithm calculates the ratio between the nose tip and ear coordinates:
        > `Ratio = (Nose_x - LeftEar_x) / (Nose_x - RightEar_x)`
    *   If the ratio deviates from the safe range `[0.3 - 3.0]`, a cheating flag is raised.

## 📸 Screenshots

| Student Login | AI Monitoring | Admin Dashboard |
| :---: | :---: | :---: |
| ![Login Screen](https://via.placeholder.com/300x200?text=Secure+Login) | ![AI Monitor](https://via.placeholder.com/300x200?text=Gaze+Detection) | ![Admin Panel](https://via.placeholder.com/300x200?text=Exam+Creator) |

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/hnusis-proctor.git
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Setup Environment Variables (Vercel):**
    *   Create a `.env` file and add your database connection:
    ```env
    POSTGRES_URL="your_supabase_connection_string"
    ```
4.  **Run Locally:**
    ```bash
    npm start
    ```

## 🛡️ Security Note
This system is designed as a **deterrent**. While it detects visual anomalies, it should be used in conjunction with other security measures (IP logging, Browser Lockdown) for high-stakes exams.

## 👨‍💻 Author

**Eng. KING ABDO**
*   *Smart Systems Engineer*
*   *Cybersecurity Enthusiast*

---
*Built for the Future of Education.*


## Enterprise hardening (v2)

أضيف إلى المشروع مسار مؤسسي أولي يحافظ على خصوصية الكاميرا والميكروفون: تتم معالجة الفيديو والصوت محلياً داخل المتصفح، بينما يرسل المتصفح **بيانات أحداث منظمة فقط** إلى الخادم عند إنهاء الجلسة. لا يقوم المخطط الجديد بتخزين إطارات الكاميرا أو تسجيلات الصوت.

### ما تم تغييره

| المجال | التغيير |
| --- | --- |
| جلسة الطالب | إزالة مسار الدخول التجريبي الذي كان يتجاوز التحقق، وإصدار رمز جلسة موقّع لمدة ساعتين بعد التحقق من الرقم الجامعي. |
| نزاهة الامتحان | دعم روابط امتحان موقّعة ومؤقتة من خلال `api/exams.js`؛ أما `?data=` القديم فهو وضع تجريبي فقط لأن Base64 ترميز وليس تشفيراً. |
| المراقبة المحلية | دعم كشف الوجه المفقود، تعدد الوجوه، الالتفات المستمر، نشاط صوتي مرتفع، الخروج من الصفحة، فقدان التركيز، والخروج من ملء الشاشة. |
| التدقيق | سجل أحداث محلي متسلسل باستخدام SHA-256، مع واجهة `api/events.js` لحفظ البيانات المنظمة في PostgreSQL عند توفر الإعدادات. |
| لوحة الإدارة | إنشاء رابط موقّع من الخادم بدلاً من وضع الأسئلة داخل URL، مع مفتاح إدارة لا يظهر في الكود. |

### إعداد متغيرات البيئة

ضع القيم التالية في إعدادات الاستضافة، ولا تضعها في GitHub أو في ملفات JavaScript:

```env
POSTGRES_URL=postgresql://...
PROCTOR_AUTH_SECRET=ضع_سراً_عشوائياً_لا_يقل_عن_32_حرفاً
EXAM_LINK_SECRET=ضع_سراً_مختلفاً_لا_يقل_عن_32_حرفاً
ADMIN_API_KEY=ضع_مفتاحاً_طويلاً_للوحة_الإدارة
```

شغّل ملفات `database_migrations/001_proctor_audit.sql` و`database_migrations/002_exams.sql` بعد إنشاء جدول `students`. بعد النشر، افتح `admin.html`، أدخل `ADMIN_API_KEY`، ثم أنشئ رابط امتحان. لا تستخدم الرابط التجريبي `?data=` في امتحانات حقيقية.

### حدود مهمة قبل البيع للجامعة

هذه الدفعة تقوّي النزاهة والتدقيق، لكنها لا تجعل المتصفح بيئة لا يمكن اختراقها؛ قيود الويب مثل منع لقطات الشاشة أو أدوات المطورين لا يمكن ضمانها بالكامل من JavaScript وحده. لا ينبغي اتخاذ قرار رسوب أو عقوبة اعتماداً على درجة المخاطر الآلية وحدها. قبل التشغيل عالي المخاطر، يلزم إجراء اختبار دقة وتحياز، ومراجعة خصوصية وموافقة مؤسسية، وربط نظام إدارة التعلم، وإضافة مصادقة مؤسسية مثل SSO، وخدمة تسليم إجابات خادمية منفصلة.

### تحقق محلي

```bash
npm install
npm run check
npm run check:html
```
