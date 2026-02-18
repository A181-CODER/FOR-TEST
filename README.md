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

**Eng. Abdallah**
*   *Smart Systems Engineer*
*   *Cybersecurity Enthusiast*

---
*Built for the Future of Education.*
