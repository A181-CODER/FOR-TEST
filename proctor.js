/* HNUSIS Proctoring Runtime
 * Privacy principle: camera and microphone signals are processed locally.
 * Only structured event metadata is kept in memory/sessionStorage by this module.
 */
(function () {
  "use strict";

  const CONFIG = {
    defaultDurationSeconds: 60 * 60,
    faceMissingGraceMs: 2500,
    multiFaceGraceMs: 1500,
    lookAwayGraceMs: 1800,
    eventCooldownMs: 4000,
    audioSampleMs: 500,
    audioThreshold: 0.12,
    maxRiskScore: 100,
  };

  const state = {
    exam: { subject: "اختبار تجريبي", instructor: "غير محدد", durationSeconds: CONFIG.defaultDurationSeconds, questions: [] },
    student: null,
    authToken: null,
    sessionId: null,
    stream: null,
    faceMesh: null,
    camera: null,
    audioContext: null,
    analyser: null,
    audioData: null,
    objectModel: null,
    timers: new Set(),
    eventLog: [],
    lastEventAt: new Map(),
    violationCounts: Object.create(null),
    riskScore: 0,
    startedAt: null,
    remainingSeconds: CONFIG.defaultDurationSeconds,
    submitted: false,
    handlersInstalled: false,
    faceMissingSince: null,
    multiFaceSince: null,
    lookingAwaySince: null,
    loudAudioSamples: 0,
    lastVisibilityState: document.visibilityState,
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    startScreen: $("startScreen"),
    studentIdInput: $("studentIDInput"),
    loginButton: document.querySelector(".login-box .btn"),
    errorMsg: $("errorMsg"),
    displayName: $("displayStudentName"),
    displayId: $("displayStudentID"),
    subjectTitle: $("subjectTitle"),
    instructor: $("docNameDisplay"),
    questions: $("questionsContainer"),
    timer: $("timer"),
    video: $("input_video"),
    cameraBox: $("camBox"),
    blocker: $("cameraBlocker"),
    blockerTitle: $("blockerTitle"),
    blockerReason: $("blockerReason"),
    logs: $("logs"),
    aiStatus: $("aiStatus"),
    audioStatus: $("audioStatus"),
    objectStatus: $("objectStatus"),
    windowStatus: $("windowStatus"),
    riskScore: $("riskScore"),
    riskBar: $("riskBar"),
    fileInput: $("fileInput"),
    fileName: $("fileName"),
    submitButton: $("submitButton"),
    resultScreen: $("resultScreen"),
    sessionLabel: $("sessionLabel"),
  };

  function setText(element, value) {
    if (element) element.textContent = String(value);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function makeSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function decodeExamData(encoded) {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder("utf-8").decode(bytes));
  }

  function validateExam(raw) {
    if (!raw || typeof raw !== "object") throw new Error("بيانات الامتحان غير صالحة");
    const questions = Array.isArray(raw.q) ? raw.q : [];
    const duration = Number(raw.t);
    if (questions.length === 0 || questions.length > 200) throw new Error("عدد الأسئلة غير صالح");
    if (!Number.isFinite(duration) || duration < 1 || duration > 480) throw new Error("مدة الامتحان غير صالحة");
    return {
      subject: typeof raw.s === "string" && raw.s.trim() ? raw.s.trim().slice(0, 200) : "اختبار بدون اسم",
      instructor: typeof raw.doc === "string" ? raw.doc.trim().slice(0, 120) : "غير محدد",
      durationSeconds: Math.round(duration * 60),
      questions: questions.map((question) => String(question).slice(0, 2000)),
    };
  }

  async function loadExamFromURL() {
    const params = new URLSearchParams(window.location.search);
    const examToken = params.get("exam");
    const encoded = params.get("data");
    try {
      if (examToken) {
        const response = await fetch(`/api/exams?token=${encodeURIComponent(examToken)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "رابط الامتحان غير صالح");
        state.exam = validateExam(payload);
      } else if (encoded) {
        // Legacy local mode: Base64 is encoding, not encryption. Do not use it for live university exams.
        state.exam = validateExam(decodeExamData(encoded));
      }
      renderExam();
    } catch (error) {
      console.error("Invalid exam data", error);
      setText(els.subjectTitle, "تعذر تحميل الامتحان");
      showError("رابط الامتحان غير صالح أو منتهي الصلاحية.");
    }
  }

  function renderExam() {
    setText(els.subjectTitle, state.exam.subject);
    setText(els.instructor, state.exam.instructor);
    state.remainingSeconds = state.exam.durationSeconds;
    updateTimer();
    if (!els.questions) return;
    els.questions.replaceChildren();
    state.exam.questions.forEach((question, index) => {
      const wrapper = document.createElement("section");
      wrapper.className = "question-card";
      const label = document.createElement("label");
      label.htmlFor = `answer-${index}`;
      label.textContent = `س${index + 1}: ${question}`;
      const answer = document.createElement("textarea");
      answer.id = `answer-${index}`;
      answer.name = `answer-${index}`;
      answer.maxLength = 10000;
      answer.placeholder = "اكتب الإجابة هنا...";
      answer.autocomplete = "off";
      wrapper.append(label, answer);
      els.questions.appendChild(wrapper);
    });
  }

  function showError(message) {
    setText(els.errorMsg, `تحذير: ${message}`);
    if (els.errorMsg) els.errorMsg.hidden = false;
  }

  function clearError() {
    if (els.errorMsg) els.errorMsg.hidden = true;
  }

  async function checkID() {
    const inputId = (els.studentIdInput?.value || "").trim();
    if (!inputId) {
      showError("اكتب الرقم الجامعي.");
      return;
    }
    clearError();
    if (els.loginButton) {
      els.loginButton.disabled = true;
      els.loginButton.textContent = "جاري التحقق...";
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inputId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "الرقم الجامعي غير مسجل");
      state.student = { id: inputId, name: String(data.name || "طالب") };
      state.authToken = typeof data.sessionToken === "string" ? data.sessionToken : null;
      if (!state.authToken) throw new Error("لم يستلم المتصفح رمز جلسة آمن من الخادم.");
      await startSession();
    } catch (error) {
      console.error("Login failed", error);
      showError(error.message || "تعذر التحقق من الطالب.");
    } finally {
      if (els.loginButton) {
        els.loginButton.disabled = false;
        els.loginButton.textContent = "بدء الامتحان";
      }
    }
  }

  async function requestMedia() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("المتصفح لا يدعم الوصول إلى الكاميرا.");
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (withAudioError) {
      // Audio is optional; camera access remains mandatory for this build.
      console.warn("Audio permission unavailable; continuing with camera only", withAudioError);
      return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  }

  async function startSession() {
    try {
      state.stream = await requestMedia();
      els.video.srcObject = state.stream;
      await els.video.play().catch(() => {});
      state.sessionId = makeSessionId();
      state.startedAt = Date.now();
      setText(els.displayName, state.student.name);
      setText(els.displayId, state.student.id);
      setText(els.sessionLabel, `جلسة: ${state.sessionId.slice(0, 8)}`);
      if (els.startScreen) els.startScreen.hidden = true;
      setText(els.aiStatus, "قيد التشغيل");
      installSecurityHandlers();
      startTimer();
      startAudioMonitoring();
      state.timers.add(window.setInterval(() => { if (!state.submitted) flushAuditLog("active"); }, 15000));
      await enterFullscreen();
      await initFaceMesh();
      void initObjectDetection();
      recordEvent("session_started", "بدأت جلسة الامتحان", 0, "info", { studentId: state.student.id });
    } catch (error) {
      console.error("Could not start session", error);
      stopMedia();
      showError(error.message || "تعذر بدء الجلسة. تأكد من صلاحية الكاميرا والاتصال الآمن HTTPS.");
    }
  }

  async function enterFullscreen() {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      try {
        await root.requestFullscreen();
      } catch (error) {
        console.warn("Fullscreen was not granted", error);
        recordEvent("fullscreen_unavailable", "تعذر تفعيل ملء الشاشة؛ يستمر الامتحان مع تسجيل الحالة", 1, "warning");
      }
    }
  }

  async function initFaceMesh() {
    if (typeof FaceMesh === "undefined" || typeof Camera === "undefined") {
      throw new Error("مكتبة مراقبة الوجه غير متاحة. تحقق من اتصال الشبكة.");
    }
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    faceMesh.onResults(handleFaceResults);
    const camera = new Camera(els.video, {
      onFrame: async () => {
        if (!state.submitted) await faceMesh.send({ image: els.video });
      },
      width: 640,
      height: 480,
    });
    state.faceMesh = faceMesh;
    state.camera = camera;
    camera.start();
  }

  function handleFaceResults(results) {
    if (state.submitted) return;
    const faces = results.multiFaceLandmarks || [];
    const now = Date.now();
    if (faces.length === 0) {
      state.multiFaceSince = null;
      if (!state.faceMissingSince) state.faceMissingSince = now;
      if (now - state.faceMissingSince >= CONFIG.faceMissingGraceMs) {
        setBlocker(true, "الكاميرا محجوبة أو الوجه خارج الإطار.");
        recordEvent("face_missing", "لم يتم رصد وجه الطالب", 8, "warning");
      }
      updateCameraState("غير متاح", "danger");
      return;
    }

    state.faceMissingSince = null;
    if (faces.length > 1) {
      if (!state.multiFaceSince) state.multiFaceSince = now;
      if (now - state.multiFaceSince >= CONFIG.multiFaceGraceMs) {
        setBlocker(true, "تم رصد أكثر من وجه داخل الكاميرا.");
        recordEvent("multiple_faces", "تم رصد أكثر من وجه", 20, "danger", { count: faces.length });
      }
      updateCameraState("أكثر من وجه", "danger");
      return;
    }

    state.multiFaceSince = null;
    setBlocker(false);
    updateCameraState("نشط", "safe");
    const landmarks = faces[0];
    const nose = landmarks[1];
    const leftSide = landmarks[234];
    const rightSide = landmarks[454];
    if (!nose || !leftSide || !rightSide) return;
    const centerX = (leftSide.x + rightSide.x) / 2;
    const offset = nose.x - centerX;
    const lookingAway = Math.abs(offset) > 0.085;
    if (lookingAway) {
      if (!state.lookingAwaySince) state.lookingAwaySince = now;
      if (now - state.lookingAwaySince >= CONFIG.lookAwayGraceMs) {
        recordEvent("look_away", offset > 0 ? "التفات مستمر إلى اليمين" : "التفات مستمر إلى اليسار", 6, "warning", { offset: Number(offset.toFixed(4)) });
      }
    } else {
      state.lookingAwaySince = null;
    }
  }

  function updateCameraState(label, tone) {
    setText(els.aiStatus, label);
    if (els.cameraBox) els.cameraBox.dataset.state = tone;
  }

  function setBlocker(visible, reason) {
    if (!els.blocker) return;
    els.blocker.hidden = !visible;
    if (visible) {
      setText(els.blockerTitle, "تنبيه أمني");
      setText(els.blockerReason, reason || "صحح وضع الكاميرا للمتابعة.");
    }
  }

  async function initObjectDetection() {
    if (typeof cocoSsd === "undefined") {
      setText(els.objectStatus, "غير متاح");
      return;
    }
    try {
      state.objectModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      setText(els.objectStatus, "محلي فقط");
      const timer = window.setInterval(detectObjects, 2500);
      state.timers.add(timer);
    } catch (error) {
      console.warn("Object detection unavailable", error);
      setText(els.objectStatus, "غير متاح");
    }
  }

  async function detectObjects() {
    if (!state.objectModel || state.submitted || !els.video?.videoWidth) return;
    try {
      const predictions = await state.objectModel.detect(els.video, 10, 0.58);
      const relevant = predictions
        .filter((prediction) => ["cell phone", "laptop", "book", "remote"].includes(prediction.class))
        .sort((a, b) => b.score - a.score)[0];
      if (!relevant) return;
      const risk = relevant.class === "cell phone" ? 12 : 6;
      recordEvent("object_detected", `تم رصد عنصر يحتاج إلى مراجعة: ${relevant.class}`, risk, "warning", { objectClass: relevant.class, confidence: Number(relevant.score.toFixed(2)) });
    } catch (error) {
      console.warn("Object detection frame failed", error);
    }
  }

  function startAudioMonitoring() {
    const audioTrack = state.stream?.getAudioTracks?.()[0];
    if (!audioTrack || !window.AudioContext) {
      setText(els.audioStatus, "غير متاح");
      return;
    }
    try {
      state.audioContext = new AudioContext();
      const source = state.audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 512;
      state.audioData = new Uint8Array(state.analyser.fftSize);
      source.connect(state.analyser);
      const timer = window.setInterval(sampleAudio, CONFIG.audioSampleMs);
      state.timers.add(timer);
      setText(els.audioStatus, "محلي فقط");
    } catch (error) {
      console.warn("Audio analysis unavailable", error);
      setText(els.audioStatus, "غير متاح");
    }
  }

  function sampleAudio() {
    if (!state.analyser || state.submitted) return;
    state.analyser.getByteTimeDomainData(state.audioData);
    let sum = 0;
    for (const value of state.audioData) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / state.audioData.length);
    if (rms >= CONFIG.audioThreshold) {
      state.loudAudioSamples += 1;
      if (state.loudAudioSamples >= 4) {
        recordEvent("audio_activity", "رصد نشاط صوتي مرتفع؛ يلزم التحقق البشري", 4, "warning", { rms: Number(rms.toFixed(3)) });
        state.loudAudioSamples = 0;
      }
    } else {
      state.loudAudioSamples = 0;
    }
  }

  function installSecurityHandlers() {
    if (state.handlersInstalled) return;
    state.handlersInstalled = true;
    document.addEventListener("visibilitychange", () => {
      if (state.submitted) return;
      if (document.visibilityState === "hidden") {
        setText(els.windowStatus, "خارج الصفحة");
        recordEvent("tab_hidden", "تم الانتقال خارج صفحة الامتحان", 12, "danger");
      } else if (state.lastVisibilityState === "hidden") {
        setText(els.windowStatus, "عاد للصفحة");
        recordEvent("tab_visible", "عاد الطالب إلى صفحة الامتحان", 2, "info");
      }
      state.lastVisibilityState = document.visibilityState;
    });
    window.addEventListener("blur", () => {
      if (!state.submitted) recordEvent("window_blur", "فقدت صفحة الامتحان تركيزها", 5, "warning");
    });
    document.addEventListener("fullscreenchange", () => {
      if (!state.submitted && !document.fullscreenElement) {
        setText(els.windowStatus, "ملء الشاشة متوقف");
        recordEvent("fullscreen_exit", "تم الخروج من وضع ملء الشاشة", 10, "danger");
      }
    });
    ["copy", "cut", "paste", "contextmenu", "dragstart"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (state.submitted) return;
        event.preventDefault();
        recordEvent(`blocked_${eventName}`, `تم منع العملية: ${eventName}`, 3, "warning");
      });
    });
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const blockedShortcut = (event.ctrlKey || event.metaKey) && ["c", "v", "x", "s", "p", "u"].includes(key);
      const developerShortcut = event.key === "F12" || ((event.ctrlKey || event.metaKey) && event.shiftKey && ["i", "j", "c"].includes(key));
      if (!state.submitted && (blockedShortcut || developerShortcut)) {
        event.preventDefault();
        recordEvent("blocked_shortcut", `تم منع اختصار لوحة المفاتيح: ${event.key}`, 3, "warning");
      }
    });
    window.addEventListener("beforeunload", (event) => {
      if (!state.submitted && state.startedAt) {
        event.preventDefault();
        event.returnValue = "جلسة الامتحان ما زالت مفتوحة.";
      }
    });
  }

  function recordEvent(type, message, risk, severity, metadata) {
    if (state.submitted && type !== "session_submitted") return;
    const now = Date.now();
    const previous = state.lastEventAt.get(type) || 0;
    if (now - previous < CONFIG.eventCooldownMs) return;
    state.lastEventAt.set(type, now);
    state.violationCounts[type] = (state.violationCounts[type] || 0) + 1;
    state.riskScore = clamp(state.riskScore + Number(risk || 0), 0, CONFIG.maxRiskScore);
    const previousHash = state.eventLog.length ? state.eventLog[state.eventLog.length - 1].hash : "GENESIS";
    const event = {
      id: state.eventLog.length + 1,
      sessionId: state.sessionId,
      type,
      message,
      severity,
      risk: Number(risk || 0),
      occurredAt: new Date(now).toISOString(),
      metadata: metadata || {},
      previousHash,
      hash: "pending",
    };
    state.eventLog.push(event);
    hashEvent(event).then((hash) => {
      event.hash = hash;
      persistAuditLog();
    });
    renderEvent(event);
    updateRiskDisplay();
  }

  async function hashEvent(event) {
    const payload = JSON.stringify({ ...event, hash: undefined });
    if (!window.crypto?.subtle) return `local-${btoa(unescape(encodeURIComponent(payload))).slice(0, 32)}`;
    const bytes = new TextEncoder().encode(payload);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function persistAuditLog() {
    if (!state.sessionId) return;
    const record = { sessionId: state.sessionId, studentId: state.student?.id || null, events: state.eventLog, riskScore: state.riskScore };
    try {
      sessionStorage.setItem(`hnusis-audit-${state.sessionId}`, JSON.stringify(record));
    } catch (error) {
      console.warn("Could not persist local audit log", error);
    }
  }

  function renderEvent(event) {
    if (!els.logs) return;
    const item = document.createElement("li");
    item.className = `log-item log-${event.severity}`;
    const time = new Date(event.occurredAt).toLocaleTimeString("ar-EG");
    item.textContent = `${event.message} — ${time}`;
    els.logs.prepend(item);
    while (els.logs.children.length > 50) els.logs.lastElementChild.remove();
  }

  function updateRiskDisplay() {
    setText(els.riskScore, `${state.riskScore}/100`);
    if (els.riskBar) els.riskBar.style.width = `${state.riskScore}%`;
    if (state.riskScore >= 70) els.riskBar?.classList.add("high");
    else if (state.riskScore >= 35) els.riskBar?.classList.add("medium");
  }

  function startTimer() {
    updateTimer();
    const timer = window.setInterval(() => {
      if (state.submitted) return;
      state.remainingSeconds -= 1;
      updateTimer();
      if (state.remainingSeconds <= 0) submitExam(true);
    }, 1000);
    state.timers.add(timer);
  }

  function updateTimer() {
    const seconds = Math.max(0, state.remainingSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    setText(els.timer, `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`);
    if (els.timer) els.timer.classList.toggle("timer-danger", seconds <= 300);
  }

  function handleFileUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      input.value = "";
      showError("يسمح بملف PDF أو JPG أو PNG بحجم لا يتجاوز 10MB.");
      return;
    }
    setText(els.fileName, `تم إرفاق: ${file.name}`);
    recordEvent("answer_file_selected", "تم اختيار ملف إجابة", 0, "info", { name: file.name, size: file.size, type: file.type });
  }

  function collectAnswers() {
    return Array.from(document.querySelectorAll("#questionsContainer textarea"), (field) => field.value);
  }

  async function flushAuditLog(status) {
    if (!state.authToken || !state.sessionId || !state.student) return;
    await Promise.all(state.eventLog.map(async (event) => {
      if (event.hash === "pending") event.hash = await hashEvent(event);
    }));
    persistAuditLog();
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.authToken}` },
        body: JSON.stringify({
          sessionId: state.sessionId,
          studentId: state.student.id,
          examSubject: state.exam.subject,
          status,
          riskScore: state.riskScore,
          events: state.eventLog,
        }),
      });
      if (!response.ok) console.warn("Audit API rejected the session", response.status);
    } catch (error) {
      console.warn("Audit API unavailable; local session copy remains available", error);
    }
  }

  async function submitExam(autoSubmitted) {
    if (state.submitted) return;
    if (!autoSubmitted && !window.confirm("هل تريد تسليم الامتحان نهائياً؟")) return;
    state.submitted = true;
    recordEvent("session_submitted", autoSubmitted ? "انتهى الوقت وتم إنهاء الجلسة" : "تم إنهاء الجلسة بواسطة الطالب", 0, "info", { answers: collectAnswers().length });
    for (const timer of state.timers) window.clearInterval(timer);
    state.timers.clear();
    await flushAuditLog(autoSubmitted ? "expired" : "submitted");
    stopMedia();
    document.querySelectorAll("#questionsContainer textarea, #fileInput").forEach((element) => { element.disabled = true; });
    if (els.submitButton) els.submitButton.disabled = true;
    if (els.resultScreen) els.resultScreen.hidden = false;
    setText($("resultSession"), state.sessionId || "غير متاح");
  }

  function stopMedia() {
    state.stream?.getTracks?.().forEach((track) => track.stop());
    state.stream = null;
    if (state.audioContext && state.audioContext.state !== "closed") state.audioContext.close().catch(() => {});
    state.audioContext = null;
    if (els.video) els.video.srcObject = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  window.checkID = checkID;
  window.handleFileUpload = handleFileUpload;
  window.submitExam = submitExam;
  window.HNUSIS_PROCTOR = {
    getSessionId: () => state.sessionId,
    getAuditLog: () => state.eventLog.map((event) => ({ ...event })),
    getRiskScore: () => state.riskScore,
  };

  document.addEventListener("DOMContentLoaded", loadExamFromURL);
})();
