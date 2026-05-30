import os
import cv2
import numpy as np
import tkinter as tk
from tkinter import filedialog, messagebox
import threading
import mediapipe as mp
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# ================= SETTINGS =================
IMG_SIZE = 96
class_names = ['anger','contempt','disgust','fear','happy','neutral','sad','surprise']

BG = "#0b1e3a"
BTN = "#1f6feb"
FG = "white"

dataset_path = None
model = None

# ================= MEDIA PIPE =================
mp_face = mp.solutions.face_mesh
face_mesh = mp_face.FaceMesh(static_image_mode=True)

def detect_face(img):
    if img is None:
        return None
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)
    if results.multi_face_landmarks:
        h, w, _ = img.shape
        pts = [(int(p.x*w), int(p.y*h)) for p in results.multi_face_landmarks[0].landmark]
        x, y, w_box, h_box = cv2.boundingRect(np.array(pts))
        face = img[y:y+h_box, x:x+w_box]
        if face.size == 0:
            return None
        return face
    return None

# ================= SELECT DATASET =================
def select_dataset():
    global dataset_path
    dataset_path = filedialog.askdirectory()
    if dataset_path:
        messagebox.showinfo("Dataset Selected", dataset_path)

# ================= CNN MODEL =================
def create_model():
    model = models.Sequential([
        layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3)),
        layers.Conv2D(32, (3,3), activation='relu'),
        layers.MaxPooling2D(2,2),
        layers.Conv2D(64, (3,3), activation='relu'),
        layers.MaxPooling2D(2,2),
        layers.Conv2D(128, (3,3), activation='relu'),
        layers.MaxPooling2D(2,2),
        layers.Flatten(),
        layers.Dense(128, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(len(class_names), activation='softmax')
    ])
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    return model

# ================= TRAIN MODEL =================
def train_model():
    global model, dataset_path
    if dataset_path is None:
        messagebox.showerror("Error", "Select dataset first")
        return
    datagen = ImageDataGenerator(rescale=1./255, validation_split=0.2,
                                 rotation_range=20, zoom_range=0.2, horizontal_flip=True)
    train_data = datagen.flow_from_directory(dataset_path,
                                             target_size=(IMG_SIZE, IMG_SIZE),
                                             batch_size=32,
                                             class_mode='categorical',
                                             subset='training')
    val_data = datagen.flow_from_directory(dataset_path,
                                           target_size=(IMG_SIZE, IMG_SIZE),
                                           batch_size=32,
                                           class_mode='categorical',
                                           subset='validation')
    model = create_model()
    history = model.fit(train_data, validation_data=val_data, epochs=15, verbose=1)
    acc = history.history['val_accuracy'][-1] * 100
    messagebox.showinfo("Training Complete", f"Final Accuracy: {acc:.2f}%")
    model.save("emotion_model.h5")

def start_training():
    thread = threading.Thread(target=train_model)
    thread.start()

# ================= IMAGE PREDICT =================
def predict_image():
    global model
    if model is None:
        try:
            model = tf.keras.models.load_model("emotion_model.h5")
        except:
            messagebox.showerror("Error", "Train model first")
            return
    file = filedialog.askopenfilename(filetypes=[("Image Files","*.jpg;*.jpeg;*.png")])
    if not file: return
    img = cv2.imread(file)
    face = detect_face(img)
    if face is None:
        result_label.config(text="No face detected ❌")
        return
    face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))
    face = np.expand_dims(face.astype(np.float32)/255.0, axis=0)
    pred = model.predict(face, verbose=0)
    label = class_names[np.argmax(pred)]
    conf = np.max(pred) * 100
    result_label.config(text=f"Emotion: {label} ({conf:.2f}%)")

# ================= LIVE CAMERA =================
def live_camera():
    global model
    if model is None:
        try:
            model = tf.keras.models.load_model("emotion_model.h5")
        except:
            messagebox.showerror("Error", "Train model first")
            return
    cap = cv2.VideoCapture(0)
    while True:
        ret, frame = cap.read()
        if not ret: break
        face = detect_face(frame)
        if face is not None:
            face = cv2.resize(face, (IMG_SIZE, IMG_SIZE))
            face = np.expand_dims(face.astype(np.float32)/255.0, axis=0)
            pred = model.predict(face, verbose=0)
            label = class_names[np.argmax(pred)]
            conf = np.max(pred) * 100
            cv2.putText(frame, f"{label} {conf:.1f}%", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,0), 2)
        cv2.imshow("Emotion AI LIVE", frame)
        if cv2.waitKey(1) == 27: break
    cap.release()
    cv2.destroyAllWindows()
    

# ================= UI =================
root = tk.Tk()
root.title("Emotion AI PRO FULL SYSTEM")
root.geometry("500x500")
root.configure(bg=BG)

tk.Button(root, text="Select Dataset", bg=BTN, fg=FG, command=select_dataset).pack(pady=10)
tk.Button(root, text="Train Model", bg=BTN, fg=FG, command=start_training).pack(pady=10)
tk.Button(root, text="Live Camera", bg=BTN, fg=FG, command=live_camera).pack(pady=10)
tk.Button(root, text="Predict Image", bg=BTN, fg=FG, command=predict_image).pack(pady=10)

result_label = tk.Label(root, text="Prediction Result", bg=BG, fg="yellow", font=("Arial", 14))
result_label.pack(pady=20)

root.mainloop()
