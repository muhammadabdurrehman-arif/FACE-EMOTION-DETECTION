# load_keras_model.py
import tensorflow as tf
from tensorflow.keras.models import load_model

# Load .keras file (no errors!)
model = load_model('emotion_model.keras', compile=False)
print("✅ Model loaded successfully!")
print(f"Input shape: {model.input_shape}")
print(f"Output shape: {model.output_shape}")