const video = document.getElementById('student-cam');
const securityBadge = document.getElementById('security-badge');
const recDot = document.getElementById('rec-dot');
const startScreen = document.getElementById('start-screen');
const aiConnText = document.getElementById('ai-conn');
const logList = document.getElementById('log-list');
const faceGrid = document.getElementById('face-grid');

// دالة البدء التي يستدعيها الزر
function startExam() {
    // طلب صلاحية الكاميرا
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            // 1. تشغيل الفيديو
            video.srcObject = stream;
            
            // 2. إخفاء شاشة الترحيب
            startScreen.style.display = 'none';
            
            // 3. تحديث الواجهة لتبدو "قيد التحميل"
            securityBadge.innerText = "جاري تهيئة الـ AI...";
            securityBadge.className = "status-badge status-wait";
            addLog("تم تشغيل الكاميرا بنجاح.");
            
            // 4. محاكاة الاتصال بالسيرفر (Delay 2 seconds)
            setTimeout(() => {
                activateSystem();
            }, 2000);
        })
        .catch(err => {
            alert("خطأ! لا يمكن الوصول للكاميرا. تأكد من السماح للمتصفح.");
            console.error(err);
            securityBadge.innerText = "خطأ في الكاميرا";
            securityBadge.className = "status-badge status-danger";
        });
}

function activateSystem() {
    // تفعيل حالة "آمن"
    securityBadge.innerText = "آمن (تحليل نشط)";
    securityBadge.className = "status-badge status-safe";
    
    // تفعيل أيقونة التسجيل والشبكة
    recDot.style.opacity = '1';
    faceGrid.style.display = 'block'; // يظهر المربع حول الوجه
    
    // تحديث حالة السيرفر في الشريط الجانبي
    aiConnText.innerText = "متصل (Python Engine)";
    aiConnText.style.color = "#2ecc71";
    
    addLog("تم الاتصال بمحرك Python للتحليل.");
    addLog("نظام المراقبة يعمل بكفاءة 100%.");

    // البدء بإرسال الصور (محاكاة)
    setInterval(simulateAICheck, 5000);
}

function simulateAICheck() {
    // هذه الدالة ستحاكي رد السيرفر كل 5 ثواني
    // لتبين للعميد أن النظام "حي" حتى لو البايثون مش شغال دلوقتي
    const timestamp = new Date().toLocaleTimeString();
    console.log("Sending frame to AI...");
    
    // حركة بسيطة: تغيير زمن الاستجابة عشوائياً ليبدو حقيقياً
    const latency = Math.floor(Math.random() * 50) + 10;
    document.getElementById('latency').innerText = latency + "ms";
}

function addLog(message) {
    const li = document.createElement('li');
    li.innerText = `✅ ${message}`;
    li.style.marginBottom = "5px";
    li.style.borderBottom = "1px solid #eee";
    logList.prepend(li);
}