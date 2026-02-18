from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import base64

app = Flask(__name__)
CORS(app) # للسماح للمتصفح بالاتصال بالسيرفر

# إعدادات MediaPipe لكشف الوجه
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        # 1. استلام الصورة من المتصفح
        data = request.json['image']
        header, encoded = data.split(",", 1)
        binary = base64.b64decode(encoded)
        image_array = np.frombuffer(binary, dtype=np.uint8)
        img = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        # 2. تحليل الصورة
        img_h, img_w, _ = img.shape
        results = face_mesh.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

        status = "SAFE"
        message = "طبيعي"

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # حساب اتجاه الرأس (Head Pose Estimation)
                # نأخذ إحداثيات الأنف والأذن لتقدير الدوران
                nose_tip = face_landmarks.landmark[1]
                left_ear = face_landmarks.landmark[234]
                right_ear = face_landmarks.landmark[454]

                # لو الأنف قربت أوي من ودن، يبقى هو لافف وشه
                # حسابات بسيطة للمسافات النسبية
                nose_x = nose_tip.x
                left_ear_x = left_ear.x
                right_ear_x = right_ear.x

                if nose_x < left_ear_x or nose_x > right_ear_x:
                     status = "CHEAT"
                     message = "التفات كامل للوجه!"
                
                # تقدير الالتفات البسيط (يمين/يسار)
                dist_left = abs(nose_x - left_ear_x)
                dist_right = abs(nose_x - right_ear_x)
                
                ratio = dist_left / (dist_right + 0.0001)

                if ratio > 2.5: # ينظر لليسار بقوة
                    status = "WARNING"
                    message = "التفات لليسار"
                elif ratio < 0.3: # ينظر لليمين بقوة
                    status = "WARNING"
                    message = "التفات لليمين"
        else:
            status = "CHEAT"
            message = "الوجه غير ظاهر!"

        return jsonify({"status": status, "message": message})

    except Exception as e:
        print(e)
        return jsonify({"status": "ERROR", "message": "خطأ في المعالجة"})

if __name__ == '__main__':
    print("AI Engine Running on Port 5000...")
    app.run(port=5000, debug=True)
