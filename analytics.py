from flask import Flask, request, jsonify
import cv2
import numpy as np

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze():
    # هنا كود استلام الصورة وتحليلها
    # ...
    return jsonify({"status": "SAFE", "score": 0.1})

if __name__ == '__main__':
    print("AI Engine Started on Port 5000...")
    app.run(port=5000)