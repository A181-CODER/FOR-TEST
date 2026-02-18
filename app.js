// ضيف الدالة دي واستدعيها في initSystem() أو window.onload
function loadExamFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');

    if (data) {
        try {
            // فك التشفير: Base64 -> JSON
            const decodedData = JSON.parse(decodeURIComponent(escape(atob(data))));
            
            // 1. وضع اسم المادة
            document.getElementById('subjectTitle').innerText = "مادة: " + decodedData.s;
            
            // 2. ضبط الوقت
            let timeInSeconds = decodedData.t * 60;
            startCustomTimer(timeInSeconds);

            // 3. عرض الأسئلة
            const container = document.getElementById('questionsContainer');
            container.innerHTML = ""; // مسح أي حاجة قديمة
            
            decodedData.q.forEach((qText, index) => {
                const qDiv = document.createElement('div');
                qDiv.style.marginBottom = "20px";
                qDiv.innerHTML = `
                    <p style="font-weight:bold; margin-bottom:10px;">س${index + 1}: ${qText}</p>
                    <textarea style="width:100%; height:100px; padding:10px; border:2px solid #eee; border-radius:8px; resize:none;" placeholder="اكتب الإجابة هنا..."></textarea>
                `;
                container.appendChild(qDiv);
            });

        } catch (e) {
            console.error(e);
            alert("رابط الامتحان غير صالح!");
        }
    } else {
        // لو مفيش داتا في اللينك (امتحان افتراضي)
        document.getElementById('subjectTitle').innerText = "اختبار تجريبي (Default)";
    }
}

// دالة تايمر معدلة لتقبل وقت متغير
function startCustomTimer(duration) {
    let time = duration;
    const el = document.getElementById('timer');
    // إلغاء أي تايمر سابق لو موجود
    if(window.examInterval) clearInterval(window.examInterval);
    
    window.examInterval = setInterval(() => {
        time--;
        let m = Math.floor(time / 60);
        let s = time % 60;
        el.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        if (time <= 0) {
            clearInterval(window.examInterval);
            alert("انتهى الوقت!");
        }
    }, 1000);
}

// استدعي الدالة دي لما الصفحة تفتح
window.addEventListener('DOMContentLoaded', loadExamFromURL);
// المتغيرات
const video = document.getElementById('student-cam');
const canvas = document.createElement('canvas'); // للتصوير الخفي
const timerDisplay = document.getElementById('exam-timer');
const aiBadge = document.getElementById('ai-badge');
const camContainer = document.getElementById('cam-container');
const logList = document.getElementById('log-list');

// إعدادات الوقت (مثلاً 60 دقيقة)
let timeRemaining = 60 * 60; // بالثواني
let timerInterval;

function authenticateAndStart() {
    // 1. نقل البيانات من الـ Login للـ Sidebar
    document.getElementById('display-name').innerText = document.getElementById('student-name').value;
    document.getElementById('display-email').innerText = document.getElementById('student-email').value;
    document.getElementById('display-id').innerText = "ID: " + document.getElementById('student-id').value;

    // 2. طلب الكاميرا
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            document.getElementById('login-screen').style.display = 'none'; // إخفاء الدخول
            startTimer(); // بدء الوقت
            startAIAnalysis(); // تشغيل الرقابة
        })
        .catch(err => alert("لا يمكن بدء الامتحان بدون كاميرا!"));
}

// دالة التايمر المتحرك
function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert("انتهى الوقت! سيتم سحب الورقة.");
            document.getElementById('answer-area').disabled = true;
        }
    }, 1000);
}

function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    timerDisplay.innerText = `${minutes < 10 ? '0'+minutes : minutes}:${seconds < 10 ? '0'+seconds : seconds}`;
    
    // لو الوقت قرب يخلص يحمر
    if (timeRemaining < 300) timerDisplay.style.color = "red";
}

// دالة الذكاء الاصطناعي
function startAIAnalysis() {
    setInterval(() => {
        captureAndCheck();
    }, 1000); // إرسال صورة كل ثانية (سريع ودقيق)
}

function captureAndCheck() {
    // تحويل الفيديو لصورة
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg');

    // إرسال الصورة للسيرفر (Python)
    fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
    })
    .then(response => response.json())
    .then(data => {
        updateUI(data);
    })
    .catch(err => console.log("AI Server Offline")); // عشان لو نسيت تشغل البايثون ميعطلش
}

function updateUI(result) {
    if (result.status === "SAFE") {
        aiBadge.innerText = "آمن (مستقر)";
        aiBadge.className = "status-badge status-safe";
        camContainer.style.border = "2px solid #ddd"; // حدود طبيعية
        document.getElementById('security-text').innerText = "آمن";
        document.getElementById('security-text').style.color = "green";
    } 
    else if (result.status === "WARNING") {
        aiBadge.innerText = "تحذير: " + result.message;
        aiBadge.className = "status-badge status-wait";
        camContainer.style.border = "4px solid orange";
    }
    else if (result.status === "CHEAT") {
        aiBadge.innerText = "غش: " + result.message;
        aiBadge.className = "status-badge status-danger";
        camContainer.style.border = "5px solid red"; // برواز أحمر عريض
        
        // إضافة للسجل
        let li = document.createElement('li');
        li.innerText = `⚠️ ${result.message} (${new Date().toLocaleTimeString()})`;
        logList.prepend(li);
    }
}
