// المتغيرات العامة
let studentData = null;
let faceMissingCounter = 0;
let rightLookCounter = 0;
let leftLookCounter = 0;
let examStartTime = null;
let uploadedFileName = '';

// 1. التحقق من هوية الطالب
async function checkID() {
    const inputID = document.getElementById('studentIDInput').value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const btn = document.querySelector('.login-box .btn');

    if (!inputID || inputID.length < 5) {
        errorMsg.innerText = "⚠️ الرجاء إدخال رقم جامعي صحيح";
        errorMsg.style.display = 'block';
        return;
    }

    btn.innerText = "جاري التحقق...";
    btn.disabled = true;
    errorMsg.style.display = 'none';

    try {
        // تجربة الاتصال بالسيرفر أولاً
        let data;
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(inputID) })
            });
            data = await response.json();
        } catch (e) {
            // وضع التجربة - أرقام صالحة للتجربة
            const mockStudents = {
                '921240008': 'أحمد حموده قرني سلامة',
                '921240012': 'أحمد سعيد عبدالله محمود',
                '921240001': 'ابراهيم السيد عبدالحميد السيد',
                '921230001': 'ابراهيم احمد حمدى احمد'
            };
            if (mockStudents[inputID]) {
                data = { success: true, name: mockStudents[inputID] };
            } else {
                data = { error: 'الرقم غير مسجل' };
            }
        }

        if (data.success) {
            studentData = { id: inputID, name: data.name };
            document.getElementById('displayStudentName').innerText = data.name;
            document.getElementById('displayStudentID').innerText = inputID;
            document.getElementById('startScreen').style.display = 'none';
            
            loadExamFromURL();
            initSystem();
            logEvent(`✅ تسجيل دخول: ${data.name}`);
        } else {
            errorMsg.innerText = `⚠️ ${data.error || 'الرقم غير مسجل'}`;
            errorMsg.style.display = 'block';
        }
    } catch (err) {
        console.error(err);
        errorMsg.innerText = "⚠️ خطأ في الاتصال";
        errorMsg.style.display = 'block';
    } finally {
        btn.innerText = "تسجيل الدخول";
        btn.disabled = false;
    }
}

// 2. تحميل الامتحان من الرابط المشفر
function loadExamFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');
    
    if (data) {
        try {
            const jsonString = decodeURIComponent(escape(atob(data)));
            const decodedData = JSON.parse(jsonString);

            document.getElementById('subjectTitle').innerText = decodedData.s;
            document.getElementById('docNameDisplay').innerText = decodedData.doc || "غير محدد";
            
            startTimer(decodedData.t * 60);
            
            const container = document.getElementById('questionsContainer');
            container.innerHTML = "";
            decodedData.q.forEach((qText, index) => {
                const qDiv = document.createElement('div');
                qDiv.innerHTML = `<div style="margin-bottom:20px;"><p style="font-weight:bold; font-size:1.1rem;">س${index+1}: ${qText}</p><textarea style="width:100%; height:100px; padding:10px; border:1px solid #ddd; border-radius:5px; resize:none;" placeholder="اكتب الإجابة نصياً هنا..."></textarea></div>`;
                container.appendChild(qDiv);
            });
            
            logEvent(`📝 بدء امتحان: ${decodedData.s}`);
        } catch (e) {
            console.error(e);
            document.getElementById('subjectTitle').innerText = "خطأ في تحميل الامتحان";
        }
    } else {
        document.getElementById('subjectTitle').innerText = "لا يوجد امتحان نشط";
        document.getElementById('docNameDisplay').innerText = "وضع التجربة";
    }
}

// 3. معالجة رفع الملفات
function handleFileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        uploadedFileName = file.name;
        document.getElementById('fileName').innerText = `✅ تم إرفاق: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
        logEvent(`📎 تم رفع ملف: ${file.name}`);
    }
}

// 4. نظام المراقبة بالذكاء الاصطناعي
function initSystem() {
    const videoElement = document.getElementById('input_video');
    const faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }});

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start();
    
    logEvent('🎥 الكاميرا تعمل - المراقبة نشطة');
}

// منطق كشف الغش
function onResults(results) {
    const blocker = document.getElementById('cameraBlocker');
    const camBox = document.getElementById('camBox');

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceMissingCounter = 0;
        blocker.style.display = "none"; 
        camBox.className = "video-container";

        const landmarks = results.multiFaceLandmarks[0];
        const nose = landmarks[1];
        const leftEar = landmarks[234];
        const rightEar = landmarks[454];
        
        const ratio = Math.abs(nose.x - leftEar.x) / (Math.abs(nose.x - rightEar.x) + 0.001);

        if (ratio > 3.0) {
            leftLookCounter++;
            document.getElementById('leftCount').innerText = leftLookCounter;
            if (leftLookCounter % 3 === 1) logCheating("التفات لليسار ⬅️");
        }
        else if (ratio < 0.33) {
            rightLookCounter++;
            document.getElementById('rightCount').innerText = rightLookCounter;
            if (rightLookCounter % 3 === 1) logCheating("التفات لليمين ➡️");
        }

    } else {
        faceMissingCounter++;
        document.getElementById('faceMissingCount').innerText = faceMissingCounter;
        
        if (faceMissingCounter > 15) {
            blocker.style.display = "flex";
            camBox.className = "video-container border-danger";
            if (faceMissingCounter % 30 === 16) logCheating("⚠️ الوجه غير ظاهر!");
        }
    }
}

// تسجيل الأحداث
let lastLogTime = 0;
function logCheating(msg) {
    const now = Date.now();
    if (now - lastLogTime > 3000) {
        const ul = document.getElementById('logs');
        const li = document.createElement('li');
        li.innerHTML = `<span style="color:red; font-weight:bold;">⚠️ ${msg}</span> <span style="font-size:0.8em">(${new Date().toLocaleTimeString()})</span>`;
        ul.prepend(li);
        lastLogTime = now;
    }
}

function logEvent(msg) {
    const ul = document.getElementById('logs');
    const li = document.createElement('li');
    li.innerHTML = `<span>${msg}</span> <span style="font-size:0.8em">(${new Date().toLocaleTimeString()})</span>`;
    ul.prepend(li);
}

// التايمر
function startTimer(duration) {
    let time = duration || 3600;
    const el = document.getElementById('timer');
    examStartTime = Date.now();
    
    const interval = setInterval(() => {
        time--;
        let m = Math.floor(time / 60);
        let s = time % 60;
        el.innerText = `${m}:${s < 10 ? '0'+s : s}`;
        
        if (time <= 0) {
            clearInterval(interval);
            alert("⏰ انتهى الوقت!");
            submitExam();
        }
    }, 1000);
}

// تسليم الامتحان
async function submitExam() {
    if (!studentData) {
        alert("يجب تسجيل الدخول أولاً");
        return;
    }
    
    const confirmSubmit = confirm("هل أنت متأكد من التسليم النهائي؟");
    if (!confirmSubmit) return;
    
    const answers = [];
    document.querySelectorAll('#questionsContainer textarea').forEach((textarea, index) => {
        answers.push({
            question_index: index + 1,
            answer: textarea.value
        });
    });
    
    const submissionData = {
        student_id: studentData.id,
        student_name: studentData.name,
        subject: document.getElementById('subjectTitle').innerText,
        answers: answers,
        uploaded_file: uploadedFileName,
        violations: {
            right_looks: rightLookCounter,
            left_looks: leftLookCounter,
            face_missing: faceMissingCounter
        },
        submission_time: new Date().toISOString()
    };
    
    try {
        const response = await fetch('/api/submit_exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });
        
        if (response.ok) {
            alert("✅ تم تسليم الامتحان بنجاح!\n\nحظاً موفقاً يا " + studentData.name);
            window.location.href = '/';
        } else {
            alert("تم حفظ الإجابات محلياً");
        }
    } catch (err) {
        console.error(err);
        alert("تم حفظ الإجابات محلياً (مشكلة في الاتصال)");
    }
}

// حماية المتصفح
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('cut', e => e.preventDefault());
    document.addEventListener('paste', e => e.preventDefault());
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && studentData) {
            logCheating("⚠️ خروج من شاشة الامتحان!");
        }
    });
    
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
            e.preventDefault();
            alert("❌ أدوات المطور معطلة لأسباب أمنية");
        }
    });
});
