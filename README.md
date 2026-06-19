# Face Emotion Detection - README

## Requirements

### Backend (Python)
```
tensorflow==2.20.0
flask==3.0.0
flask-cors==4.0.0
opencv-python==4.8.0.76
numpy==1.26.0
pillow==10.2.0
```

### Frontend (Node.js)
```
react@18.3.1
typescript@5.8.3
vite@5.4.19
tailwindcss@3.4.17
framer-motion@12.38.0
lucide-react@0.462.0
recharts@3.8.1
```

## Installation

### 1. Backend
```bash
pip install -r requirements.txt
```

### 2. Frontend
```bash
cd frontend
npm install
```

## Run Project

### Terminal 1 - Backend
```bash
python app.py
```
Server runs on: http://localhost:5000

### Terminal 2 - Frontend
```bash
cd frontend
npm start
```
App opens: http://localhost:3000

## Files Needed

Place these in `model/` folder:
- `emotion_model.h5` (trained model)
- `haarcascade_frontalface_default.xml` (face detector)

## API Endpoint

`POST /predict` - Send image, get emotion

## Author

Muhammad Abdur Rehman Arif (Roll No: 110229)