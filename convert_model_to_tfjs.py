import os
import sys

# Monkey patch numpy to fix the tensorflowjs AttributeError: module 'numpy' has no attribute 'object'
try:
    import numpy as np
    if not hasattr(np, 'object'):
        np.object = object
except ImportError:
    pass

import tensorflow as tf
import tensorflowjs as tfjs

def convert_model():
    model_path = 'thai_food_model.keras'
    output_dir = 'public/model'
    
    print(f"Loading Keras model from {model_path}...")
    try:
        model = tf.keras.models.load_model(model_path)
        print("Model loaded successfully.")
        
        print("Converting to TensorFlow.js format...")
        tfjs.converters.save_keras_model(model, output_dir)
        print(f"Conversion complete. Model saved to {output_dir}")
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error converting model: {e}")
        return False

if __name__ == "__main__":
    convert_model()
