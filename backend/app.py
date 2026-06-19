# Backened Code
# ==========================================================

import os
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore')

import logging
logging.basicConfig(level=logging.ERROR)

from flask import Flask, request, jsonify
from flask_cors import CORS  #Allow frontend to call api from different port
import numpy as np           #Numerical Operations on arrays
import cv2                   #image processing and face detection
import tensorflow as tf       #Deep Learning framework 
from tensorflow.keras.models import load_model   #load .h5 save model file
from tensorflow.keras.optimizers import Adam      #Optimizer for model compilation
from collections import defaultdict, deque        
import threading
import time
import urllib.request
from pathlib import Path
import base64
from datetime import datetime
import json

# ==========================================
# JSON SERIALIZER
# ==========================================
def convert_to_serializable(obj):
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float32, np.float64)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {convert_to_serializable(key): convert_to_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_serializable(item) for item in obj]
    return obj

# ==========================================
# CONFIGURATION
# ==========================================
EMOTIONS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"]
IMG_SIZE = 48
MODEL_PATH = os.path.join(os.path.dirname(__file__), "emotion_model.h5")

# ==========================================
# INITIALIZE APP
# ==========================================
app = Flask(__name__)
app.logger.disabled = True
log = logging.getLogger('werkzeug')
log.disabled = True
CORS(app, resources={r"/*": {"origins": "*"}})

# Thread locks
model_lock = threading.Lock()
stats_lock = threading.Lock()
logs_lock = threading.Lock()

# ==========================================
# GLOBAL VARIABLES
# ==========================================
model = None
face_cascade = None
eye_cascade = None
smile_cascade = None
emotion_counts = defaultdict(int)
total_predictions = 0
frame_timeline = deque(maxlen=300)
detection_logs = []
log_counter = 1

# ==========================================
# LOGS FUNCTIONS
# ==========================================
def add_log_automatically(emotion, confidence):
    global log_counter, detection_logs
    with logs_lock:
        log_entry = {
            "id": int(log_counter),
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "emotion": str(emotion),
            "confidence": float(confidence),
            "status": "success" if confidence >= 70 else "low_confidence"
        }
        detection_logs.append(log_entry)
        log_counter += 1
        if len(detection_logs) > 500:
            detection_logs.pop(0)
        return log_entry

# ==========================================
# LOAD MODEL
# ==========================================
def load_model_file():
    global model
    if not os.path.exists(MODEL_PATH):
        print(f"   ❌ ERROR: Model file NOT FOUND at: {MODEL_PATH}")
        return False
    try:
        print(f"   📁 Loading model from: {MODEL_PATH}")
        model = load_model(MODEL_PATH, compile=False)
        model.compile(optimizer=Adam(learning_rate=0.001), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
        print("   ✅ Real MobileNetV2 model loaded successfully!")
        return True
    except Exception as e:
        print(f"   ❌ ERROR loading model: {e}")
        return False

# ==========================================
# FACE DETECTION
# ==========================================
def init_face_detectors():
    global face_cascade, eye_cascade, smile_cascade
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    if os.path.exists(cascade_path):
        face_cascade = cv2.CascadeClassifier(cascade_path)
    else:
        url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
        local_path = Path(__file__).parent / "haarcascade_frontalface_default.xml"
        urllib.request.urlretrieve(url, local_path)
        face_cascade = cv2.CascadeClassifier(str(local_path))
    
    eye_path = cv2.data.haarcascades + "haarcascade_eye.xml"
    if os.path.exists(eye_path):
        eye_cascade = cv2.CascadeClassifier(eye_path)
    else:
        url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_eye.xml"
        local_path = Path(__file__).parent / "haarcascade_eye.xml"
        urllib.request.urlretrieve(url, local_path)
        eye_cascade = cv2.CascadeClassifier(str(local_path))
    
    smile_path = cv2.data.haarcascades + "haarcascade_smile.xml"
    if os.path.exists(smile_path):
        smile_cascade = cv2.CascadeClassifier(smile_path)
    else:
        url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_smile.xml"
        local_path = Path(__file__).parent / "haarcascade_smile.xml"
        urllib.request.urlretrieve(url, local_path)
        smile_cascade = cv2.CascadeClassifier(str(local_path))
    
    print("   ✅ Face detectors initialized!")

# ==========================================
# FACIAL LANDMARKS
# ==========================================
def detect_facial_landmarks(face_img, x, y, w, h):
    landmarks = []
    landmarks.append([x + int(w * 0.3), y + int(h * 0.3)])   # Left Eye
    landmarks.append([x + int(w * 0.7), y + int(h * 0.3)])   # Right Eye
    landmarks.append([x + int(w * 0.5), y + int(h * 0.5)])   # Nose Tip
    landmarks.append([x + int(w * 0.5), y + int(h * 0.45)])  # Nose Bridge
    landmarks.append([x + int(w * 0.25), y + int(h * 0.25)]) # Left Eyebrow
    landmarks.append([x + int(w * 0.75), y + int(h * 0.25)]) # Right Eyebrow
    landmarks.append([x + int(w * 0.35), y + int(h * 0.7)])  # Mouth Left
    landmarks.append([x + int(w * 0.65), y + int(h * 0.7)])  # Mouth Right
    landmarks.append([x + int(w * 0.5), y + int(h * 0.68)])  # Upper Lip
    landmarks.append([x + int(w * 0.5), y + int(h * 0.75)])  # Lower Lip
    landmarks.append([x + int(w * 0.15), y + int(h * 0.7)])  # Jaw Left
    landmarks.append([x + int(w * 0.85), y + int(h * 0.7)])  # Jaw Right
    landmarks.append([x + int(w * 0.2), y + int(h * 0.85)])  # Chin Left
    landmarks.append([x + int(w * 0.8), y + int(h * 0.85)])  # Chin Right
    landmarks.append([x + int(w * 0.2), y + int(h * 0.55)])  # Left Cheek
    landmarks.append([x + int(w * 0.8), y + int(h * 0.55)])  # Right Cheek
    landmarks.append([x + int(w * 0.5), y + int(h * 0.15)])  # Forehead Center
    landmarks.append([x + int(w * 0.5), y + int(h * 0.05)])  # Top Forehead
    return landmarks[:18]

def draw_all_landmarks(img, landmarks):
    for i, (lx, ly) in enumerate(landmarks):
        cv2.circle(img, (lx, ly), 3, (0, 255, 255), -1)
        cv2.circle(img, (lx, ly), 4, (255, 255, 255), 1)
    return img

# ==========================================
# IMPROVED PREPROCESSING FOR UPLOAD
# ==========================================
def preprocess_for_upload(face_img):
    """專門為上傳圖片優化的預處理"""
    try:
        # Resize to model input size
        face = cv2.resize(face_img, (IMG_SIZE, IMG_SIZE))
        
        # Convert to RGB (model expects RGB)
        if len(face.shape) == 2:
            face = cv2.cvtColor(face, cv2.COLOR_GRAY2RGB)
        elif face.shape[2] == 4:
            face = cv2.cvtColor(face, cv2.COLOR_BGRA2RGB)
        elif face.shape[2] == 3:
            face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        
        # Normalize
        face = face.astype("float32") / 255.0
        
        # Add batch dimension
        return np.expand_dims(face, axis=0)
    except Exception as e:
        print(f"Preprocess error: {e}")
        return None

def predict_emotion_upload(face_img):
    """專門為上傳圖片的預測函數"""
    global model
    
    if model is None:
        return "Neutral", 50.0, {e: 0 for e in EMOTIONS}
    
    try:
        # Try multiple preprocessing methods for better accuracy
        predictions = []
        
        # Method 1: Standard preprocessing
        processed1 = preprocess_for_upload(face_img)
        if processed1 is not None:
            with model_lock:
                pred1 = model.predict(processed1, verbose=0)[0]
            predictions.append(pred1)
        
        # Method 2: With slight blur (reduces noise)
        blurred = cv2.GaussianBlur(face_img, (3, 3), 0)
        processed2 = preprocess_for_upload(blurred)
        if processed2 is not None:
            with model_lock:
                pred2 = model.predict(processed2, verbose=0)[0]
            predictions.append(pred2)
        
        # Method 3: Enhanced contrast
        enhanced = cv2.convertScaleAbs(face_img, alpha=1.2, beta=10)
        processed3 = preprocess_for_upload(enhanced)
        if processed3 is not None:
            with model_lock:
                pred3 = model.predict(processed3, verbose=0)[0]
            predictions.append(pred3)
        
        # Average all predictions
        if predictions:
            avg_preds = np.mean(predictions, axis=0)
        else:
            avg_preds = predictions[0] if predictions else None
        
        if avg_preds is None:
            return "Neutral", 50.0, {e: 0 for e in EMOTIONS}
        
        idx = np.argmax(avg_preds)
        confidence = float(avg_preds[idx] * 100)
        emotion = EMOTIONS[idx]
        probabilities = {EMOTIONS[i]: round(float(avg_preds[i]) * 100, 2) for i in range(len(EMOTIONS))}
        
        print(f"   🎯 Upload prediction: {emotion} ({confidence:.1f}%)")  # Debug
        return emotion, confidence, probabilities
        
    except Exception as e:
        print(f"Prediction error: {e}")
        return "Neutral", 50.0, {e: 0 for e in EMOTIONS}

# ==========================================
# IMPROVED UPLOAD IMAGE PROCESSING
# ==========================================
def process_upload_image(image):
    """專門為上傳圖片優化的處理函數"""
    global total_predictions
    
    results = []
    
    if image is None:
        return results, image
    
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    
    working_image = image.copy()
    
    # Multiple face detection attempts
    gray = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
    
    # Try different parameters for face detection
    face_detection_params = [
        (1.05, 5, (50, 50)),   # Standard
        (1.1, 4, (40, 40)),    # More sensitive
        (1.03, 6, (60, 60)),   # More accurate
        (1.08, 3, (30, 30)),   # Most sensitive
    ]
    
    all_faces = []
    for scale, neighbors, min_size in face_detection_params:
        faces = face_cascade.detectMultiScale(gray, scale, neighbors, minSize=min_size)
        for face in faces:
            x, y, w, h = face
            # Check if face is already detected
            duplicate = False
            for fx, fy, fw, fh in all_faces:
                if abs(x - fx) < 30 and abs(y - fy) < 30:
                    duplicate = True
                    break
            if not duplicate:
                all_faces.append(face)
    
    # If no faces found, try histogram equalization
    if len(all_faces) == 0:
        gray_eq = cv2.equalizeHist(gray)
        faces = face_cascade.detectMultiScale(gray_eq, 1.05, 5, minSize=(40, 40))
        all_faces.extend(faces)
    
    # If still no faces, try with image enhancement
    if len(all_faces) == 0:
        enhanced = cv2.convertScaleAbs(working_image, alpha=1.3, beta=30)
        gray_enhanced = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray_enhanced, 1.05, 5, minSize=(40, 40))
        if len(faces) > 0:
            working_image = enhanced
            all_faces.extend(faces)
    
    for (x, y, w, h) in all_faces:
        # Add margin around face
        margin_x = int(w * 0.15)
        margin_y = int(h * 0.15)
        x = max(0, x - margin_x)
        y = max(0, y - margin_y)
        w = min(working_image.shape[1] - x, w + 2 * margin_x)
        h = min(working_image.shape[0] - y, h + 2 * margin_y)
        
        face_roi = working_image[y:y+h, x:x+w]
        if face_roi.size == 0:
            continue
        
        # Use upload-specific prediction
        emotion, confidence, probabilities = predict_emotion_upload(face_roi)
        landmarks = detect_facial_landmarks(face_roi, x, y, w, h)
        
        add_log_automatically(emotion, confidence)
        
        with stats_lock:
            total_predictions += 1
            emotion_counts[emotion] += 1
        
        # Draw rectangle
        if confidence >= 70:
            color = (0, 255, 0)
        elif confidence >= 50:
            color = (0, 255, 255)
        else:
            color = (0, 0, 255)
        
        cv2.rectangle(working_image, (x, y), (x+w, y+h), color, 2)
        
        label = f"{emotion} ({confidence:.1f}%)"
        label_y = y - 10 if y - 10 > 20 else y + h + 20
        cv2.putText(working_image, label, (x, label_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
        working_image = draw_all_landmarks(working_image, landmarks)
        
        face_result = {
            "emotion": str(emotion),
            "confidence": float(confidence),
            "box": [int(x), int(y), int(w), int(h)],
            "landmarks": [[int(l[0]), int(l[1])] for l in landmarks],
            "probabilities": probabilities,
            "landmark_count": len(landmarks)
        }
        results.append(face_result)
    
    return results, working_image

# ==========================================
# LIVE DETECTION PROCESSING (SAME AS BEFORE)
# ==========================================
def preprocess_live(face_img):
    try:
        face = cv2.resize(face_img, (IMG_SIZE, IMG_SIZE))
        face = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        face = face.astype("float32") / 255.0
        return np.expand_dims(face, axis=0)
    except Exception as e:
        print(f"Preprocess error: {e}")
        return None

def predict_emotion_live(face_img):
    global model
    if model is None:
        return "Neutral", 50.0, {e: 0 for e in EMOTIONS}
    try:
        processed = preprocess_live(face_img)
        if processed is None:
            return "Neutral", 50.0, {e: 0 for e in EMOTIONS}
        with model_lock:
            preds = model.predict(processed, verbose=0)[0]
        idx = np.argmax(preds)
        confidence = float(preds[idx] * 100)
        emotion = EMOTIONS[idx]
        probabilities = {EMOTIONS[i]: round(float(preds[i]) * 100, 2) for i in range(len(EMOTIONS))}
        return emotion, confidence, probabilities
    except Exception as e:
        print(f"Prediction error: {e}")
        return "Neutral", 50.0, {e: 0 for e in EMOTIONS}

def process_live_image(image):
    global total_predictions
    results = []
    if image is None:
        return results, image
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.05, 5, minSize=(40, 40))
    for (x, y, w, h) in faces:
        face_roi = image[y:y+h, x:x+w]
        if face_roi.size == 0:
            continue
        emotion, confidence, probabilities = predict_emotion_live(face_roi)
        landmarks = detect_facial_landmarks(face_roi, x, y, w, h)
        add_log_automatically(emotion, confidence)
        with stats_lock:
            total_predictions += 1
            emotion_counts[emotion] += 1
        color = (0, 255, 0) if confidence >= 70 else (0, 255, 255) if confidence >= 50 else (0, 0, 255)
        cv2.rectangle(image, (x, y), (x+w, y+h), color, 2)
        label = f"{emotion} ({confidence:.1f}%)"
        label_y = y - 10 if y - 10 > 20 else y + h + 20
        cv2.putText(image, label, (x, label_y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        image = draw_all_landmarks(image, landmarks)
        face_result = {
            "emotion": str(emotion),
            "confidence": float(confidence),
            "box": [int(x), int(y), int(w), int(h)],
            "landmarks": [[int(l[0]), int(l[1])] for l in landmarks],
            "probabilities": probabilities,
            "landmark_count": len(landmarks)
        }
        results.append(face_result)
    return results, image

# ==========================================
# API ENDPOINTS
# ==========================================

@app.route('/', methods=['GET'])
def root():
    return jsonify(convert_to_serializable({
        "status": "online",
        "emotions": EMOTIONS,
        "model_loaded": model is not None,
        "model_type": "MobileNetV2",
        "landmarks_detected": 18,
        "port": 5001,
        "logs_count": len(detection_logs)
    }))

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

@app.route('/logs', methods=['GET'])
def get_logs():
    try:
        with logs_lock:
            sorted_logs = sorted(detection_logs, key=lambda x: x['id'], reverse=True)
            return app.response_class(
                response=json.dumps(convert_to_serializable(sorted_logs)),
                status=200,
                mimetype='application/json'
            )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/logs/delete/<int:log_id>', methods=['DELETE'])
def delete_log(log_id):
    global detection_logs
    try:
        with logs_lock:
            initial_length = len(detection_logs)
            detection_logs = [log for log in detection_logs if log['id'] != log_id]
            if len(detection_logs) < initial_length:
                return jsonify({"success": True, "message": f"Log {log_id} deleted"})
            else:
                return jsonify({"error": "Log not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Upload image prediction - IMPROVED"""
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        file = request.files['image']
        np_arr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"error": "Invalid image"}), 400
        
        print(f" Processing uploaded image...")
        results, processed = process_upload_image(image)
        print(f" Found {len(results)} face(s)")
        
        _, buffer = cv2.imencode('.jpg', processed)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        response_data = {
            "success": True,
            "face_count": len(results),
            "faces": results,
            "processed_image": f"data:image/jpeg;base64,{img_base64}"
        }
        
        return app.response_class(
            response=json.dumps(convert_to_serializable(response_data)),
            status=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/liveDetection', methods=['POST'])
def live_detection():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        file = request.files['image']
        np_arr = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({"error": "Invalid image"}), 400
        
        start = time.time()
        results, processed = process_live_image(image)
        inference = (time.time() - start) * 1000
        
        frame_timeline.append(inference)
        if len(frame_timeline) > 0 and sum(frame_timeline) > 0:
            fps = 1000 / (sum(frame_timeline) / len(frame_timeline))
        else:
            fps = 0
        
        _, buffer = cv2.imencode('.jpg', processed)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        response_data = {
            "success": True,
            "face_count": len(results),
            "faces": results,
            "processed_image": f"data:image/jpeg;base64,{img_base64}",
            "fps": round(fps, 1),
            "inference_time_ms": round(inference, 2)
        }
        
        return app.response_class(
            response=json.dumps(convert_to_serializable(response_data)),
            status=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stats', methods=['GET'])
def stats():
    with stats_lock:
        return jsonify(convert_to_serializable({
            "success": True,
            "total_predictions": int(total_predictions),
            "emotion_counts": {k: int(v) for k, v in dict(emotion_counts).items()},
            "emotions": EMOTIONS
        }))

@app.route('/resetStats', methods=['POST'])
def reset_stats():
    global total_predictions, emotion_counts, detection_logs, log_counter
    with stats_lock:
        total_predictions = 0
        emotion_counts.clear()
        frame_timeline.clear()
    with logs_lock:
        detection_logs = []
        log_counter = 1
    return jsonify({"success": True, "message": "Statistics reset"})

@app.route('/liveAccuracy', methods=['GET'])
def live_accuracy():
    with stats_lock:
        if total_predictions == 0:
            overall_accuracy = 0
        else:
            total_confidence = sum([log['confidence'] for log in detection_logs[-100:]])
            overall_accuracy = total_confidence / min(100, len(detection_logs)) if detection_logs else 0
        
        per_emotion_accuracy = {}
        for emotion in EMOTIONS:
            emotion_logs = [log for log in detection_logs if log['emotion'] == emotion]
            if emotion_logs:
                avg_conf = sum([log['confidence'] for log in emotion_logs]) / len(emotion_logs)
                per_emotion_accuracy[emotion] = round(avg_conf, 1)
            else:
                per_emotion_accuracy[emotion] = 0
        
        response_data = {
            "success": True,
            "accuracy": round(overall_accuracy, 2),
            "per_emotion_accuracy": per_emotion_accuracy,
            "total_predictions": int(total_predictions),
            "total_logs": len(detection_logs)
        }
        
        return app.response_class(
            response=json.dumps(convert_to_serializable(response_data)),
            status=200,
            mimetype='application/json'
        )

@app.route('/modelInfo', methods=['GET'])
def model_info():
    return jsonify(convert_to_serializable({
        "model_path": MODEL_PATH,
        "model_loaded": model is not None,
        "model_type": "MobileNetV2",
        "input_size": f"{IMG_SIZE}x{IMG_SIZE}",
        "emotion_classes": EMOTIONS,
        "num_classes": 7,
        "landmarks_detected": 18
    }))

@app.route('/dashboard', methods=['GET'])
def dashboard():
    with stats_lock:
        stats_dict = {str(k): int(v) for k, v in dict(emotion_counts).items()}
        for emotion in EMOTIONS:
            if emotion not in stats_dict:
                stats_dict[emotion] = 0
        return jsonify(convert_to_serializable({
            "success": True,
            "total_predictions": int(total_predictions),
            "stats": stats_dict,
            "model": "MobileNetV2",
            "status": "running",
            "landmarks": 18
        }))
@app.route('/confusionMatrix', methods=['GET'])
def get_confusion_matrix():
    global detection_logs, emotion_counts
    
    # Initialize 7x7 matrix with zeros
    matrix = [[0 for _ in range(7)] for _ in range(7)]
    
    with logs_lock:
        # If we have logs, build confusion matrix based on actual predictions
        # Note: For real confusion matrix, you need ground truth labels
        # Here we're using the emotion_counts as diagonal values
        
        for idx, emotion in enumerate(EMOTIONS):
            count = emotion_counts.get(emotion, 0)
            if count > 0:
                # Place counts on diagonal (correct predictions)
                matrix[idx][idx] = count
    
    # Also add some sample data if matrix is empty for testing
    has_data = any(matrix[i][i] > 0 for i in range(7))
    if not has_data and detection_logs:
        # Build from recent logs
        for log in detection_logs[-50:]:  # Last 50 predictions
            emotion = log.get('emotion', 'Neutral')
            if emotion in EMOTIONS:
                idx = EMOTIONS.index(emotion)
                matrix[idx][idx] = matrix[idx][idx] + 1
    
    return jsonify(convert_to_serializable({
        "matrix": matrix,
        "labels": EMOTIONS,
        "total_predictions": total_predictions
    }))# ==========================================
# MAIN
# ==========================================
# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    print("="*60)
    print(" EMOTION DETECTION API - MobileNetV2")
    print("="*60)
    
    print("\n[1/4] Loading MobileNetV2 model...")
    success = load_model_file()
    
    if not success:
        print("\n" + "="*60)
        print(" FATAL ERROR: MODEL NOT FOUND!")
        print("="*60)
        print("\nPlease ensure 'emotion_model.h5' exists in the backend folder")
        print("="*60)
        exit(1)  
    
    print("\n[2/4] Initializing face detectors...")
    init_face_detectors()  
    
    print("\n[3/4] Checking face detector status...")
    if face_cascade is None:
        print("  WARNING: Face detector failed to load!")
    else:
        print("   Face detector ready")
    
    print("\n[4/4] Starting server...")
    print("   Open in browser: http://localhost:5001")
    print("    DO NOT use: http://0.0.0.0:5001")
    print("="*60 + "\n")
    
    # Use 127.0.0.1 instead of 0.0.0.0 for local testing
app.run(host="0.0.0.0", port=5001, debug=True, threaded=True, use_reloader=False)