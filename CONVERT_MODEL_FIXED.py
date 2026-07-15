"""
========================================
COMPLETE GOOGLE COLAB CODE
Thai Food Recognition Model - TensorFlow.js Conversion
========================================
Copy this ENTIRE code into a Google Colab cell and run it.
"""

# ===== STEP 1: Mount Google Drive =====
from google.colab import drive
drive.mount('/content/drive')

# ===== STEP 2: Install TensorFlow.js Converter =====
!pip install tensorflowjs

# ===== STEP 3: Import Libraries =====
import tensorflow as tf
import tensorflowjs as tfjs
import os
import zipfile

print("TensorFlow version:", tf.__version__)
print("TensorFlow.js converter version:", tfjs.__version__)

# ===== STEP 4: Extract Dataset (if needed) =====
dataset_zip = '/content/drive/MyDrive/dataset.zip'
extract_path = '/content/dataset'

if os.path.exists(dataset_zip):
    print(f"\n📦 Extracting dataset from {dataset_zip}...")
    with zipfile.ZipFile(dataset_zip, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
    print(f"✅ Dataset extracted to {extract_path}")
else:
    print(f"⚠️  Dataset zip not found at {dataset_zip}")

# ===== STEP 5: Train Model (if not already trained) =====
# Check if model already exists
existing_models = []
for file in os.listdir('.'):
    if file.endswith(('.h5', '.keras')):
        existing_models.append(file)

if existing_models:
    print(f"\n✅ Found existing model(s): {existing_models}")
    MODEL_PATH = existing_models[0]
    print(f"Using: {MODEL_PATH}")
else:
    print("\n🚀 No existing model found. Training new model...")
    
    # Setup data paths
    train_dir = '/content/dataset/train'  # Adjust if your folder structure is different
    
    # Image parameters
    IMG_SIZE = (224, 224)
    BATCH_SIZE = 24
    
    # Load training data
    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=0.2,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        zoom_range=0.2
    )
    
    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training'
    )
    
    val_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='validation'
    )
    
    print(f"\n✅ Classes found: {train_generator.class_indices}")
    num_classes = len(train_generator.class_indices)
    
    # Build model
    from tensorflow.keras import layers, models
    from tensorflow.keras.applications import MobileNetV2
    
    base_model = MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False
    
    # Create model
    inputs = layers.Input(shape=(224, 224, 3))
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation='relu')(x)
    outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = models.Model(inputs=inputs, outputs=outputs)
    
    # Compile
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    # Train
    print("\n🏋️ Training model...")
    history = model.fit(
        train_generator,
        epochs=15,
        validation_data=val_generator
    )
    
    # Save model
    MODEL_PATH = 'thai_food_model.h5'
    model.save(MODEL_PATH)
    print(f"\n✅ Model saved as {MODEL_PATH}")

# ===== STEP 6: Load Model =====
print(f"\n📦 Loading model from: {MODEL_PATH}")
model = tf.keras.models.load_model(MODEL_PATH)

print("\n=== Original Model Info ===")
print("Input shape:", model.input_shape)
print("Output shape:", model.output_shape)
print("Number of layers:", len(model.layers))

# ===== STEP 7: Convert to SavedModel format first (fixes Keras 3.x issues) =====
print("\n🔧 Converting to SavedModel format first (fixes compatibility)...")
SAVED_MODEL_DIR = 'saved_model_temp'
model.export(SAVED_MODEL_DIR)
print(f"✅ Model exported to {SAVED_MODEL_DIR}")

# ===== STEP 8: Convert SavedModel to TensorFlow.js =====
OUTPUT_DIR = 'tfjs_model_fixed'

print(f"\n📤 Converting SavedModel to TensorFlow.js format...")
print(f"Output directory: {OUTPUT_DIR}")

# Use command line converter for SavedModel (more reliable)
import subprocess
result = subprocess.run([
    'tensorflowjs_converter',
    '--input_format=tf_saved_model',
    '--output_format=tfjs_graph_model',
    '--signature_name=serving_default',
    '--saved_model_tags=serve',
    SAVED_MODEL_DIR,
    OUTPUT_DIR
], capture_output=True, text=True)

print(result.stdout)
if result.returncode != 0:
    print("Error:", result.stderr)
    raise Exception("Conversion failed")

# ===== STEP 9: Verify Output =====
print(f"\n✅ Conversion complete! Files created:")
for file in sorted(os.listdir(OUTPUT_DIR)):
    file_path = os.path.join(OUTPUT_DIR, file)
    size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"  - {file} ({size_mb:.2f} MB)")

# ===== STEP 10: Create Class Names File =====
# If you have class names, create a JSON file
import json

class_names = ['แกงเขียวหวาน', 'ข้าวมันไก่', 'ผัดไทย']  # Alphabetically ordered to match model
with open(os.path.join(OUTPUT_DIR, 'class_names.json'), 'w', encoding='utf-8') as f:
    json.dump(class_names, f, ensure_ascii=False, indent=2)

print(f"\n✅ Class names saved to {OUTPUT_DIR}/class_names.json")

# ===== STEP 11: Download Instructions =====
print("\n" + "="*60)
print("🎉 SUCCESS! Next steps:")
print("="*60)
print("1. In Colab left sidebar, click the 📁 Files icon")
print(f"2. Find the folder: {OUTPUT_DIR}")
print("3. Right-click the folder → Download")
print("4. Extract the downloaded zip file")
print("5. Copy ALL files (model.json and .bin files) to:")
print("   c:\\Users\\User\\Desktop\\MFU Longevity Passport\\public\\model\\")
print("6. Replace the old files")
print("7. Refresh your browser with Ctrl+F5")
print("="*60)
print("\n💡 Or run this to zip it for easy download:")
print(f"!zip -r {OUTPUT_DIR}.zip {OUTPUT_DIR}")
print("="*60)
