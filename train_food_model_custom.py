import tensorflow as tf
import numpy as np
import pandas as pd
import os
import zipfile
import subprocess
import shutil
import json
from pathlib import Path
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from sklearn.model_selection import train_test_split

def prepare_dataset(zip_name="thai_food_dataset.zip", base_path="dataset"):
    dataset_path = Path(base_path)
    zip_path = Path(zip_name)
    
    if not dataset_path.exists():
        if not zip_path.exists():
            raise FileNotFoundError(f"Could not find dataset zip at {zip_path}")
        print(f"Extracting {zip_path}...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall()
        print("Extraction complete!")
        
    classes = sorted([d.name for d in dataset_path.iterdir() if d.is_dir()])
    filepaths, labels = [], []
    
    for cls in classes:
        cls_path = dataset_path / cls
        for img_file in sorted(cls_path.glob('*.[jJ][pP]*')):
            filepaths.append(str(img_file))
            labels.append(cls)
            
    df = pd.DataFrame({'file_paths': filepaths, 'labels': labels})
    
    print(f"Total images found: {len(df)}")
    
    # 70/15/15 split
    train_df, temp_df = train_test_split(df, test_size=0.3, random_state=42, stratify=df['labels'])
    valid_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42, stratify=temp_df['labels'])
    
    return train_df, valid_df, test_df

def train_model(train_df, valid_df, test_df):
    target_size = (224, 224)
    batch_size = 32
    
    train_datagen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.efficientnet.preprocess_input,
        zoom_range=0.2,
        horizontal_flip=True
    )
    test_datagen = ImageDataGenerator(
        preprocessing_function=tf.keras.applications.efficientnet.preprocess_input
    )
    
    train_gen = train_datagen.flow_from_dataframe(
        train_df, x_col='file_paths', y_col='labels',
        target_size=target_size, batch_size=batch_size, color_mode='rgb', class_mode='categorical'
    )
    valid_gen = test_datagen.flow_from_dataframe(
        valid_df, x_col='file_paths', y_col='labels',
        target_size=target_size, batch_size=batch_size, color_mode='rgb', class_mode='categorical'
    )
    test_gen = test_datagen.flow_from_dataframe(
        test_df, x_col='file_paths', y_col='labels',
        target_size=target_size, batch_size=batch_size, color_mode='rgb', class_mode='categorical'
    )
    
    class_indices = train_gen.class_indices
    num_classes = len(class_indices)
    
    base_model = tf.keras.applications.EfficientNetB0(
        include_top=False, input_shape=(224, 224, 3), weights='imagenet'
    )
    
    model = tf.keras.Sequential([
        base_model,
        tf.keras.layers.GlobalAveragePooling2D(),
        tf.keras.layers.Dense(128, activation='relu'),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(num_classes, activation='softmax')
    ])
    
    model.compile(
        loss='categorical_crossentropy',
        optimizer=Adam(learning_rate=0.001),
        metrics=['accuracy']
    )
    
    callbacks = [
        tf.keras.callbacks.ModelCheckpoint('thai_food_model.keras', save_best_only=True, monitor='val_accuracy'),
        tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, min_lr=1e-7)
    ]
    
    print("Beginning training...")
    model.fit(
        train_gen, validation_data=valid_gen, epochs=30,
        callbacks=callbacks, steps_per_epoch=len(train_gen), validation_steps=len(valid_gen)
    )
    
    return model, test_gen, class_indices

def export_to_tfjs(model, class_indices):
    saved_model_path = Path("thai_food_model_savedmodel")
    if saved_model_path.exists():
        shutil.rmtree(saved_model_path)
        
    print("Exporting to SavedModel format...")
    model.export(str(saved_model_path))
    
    output_dir = Path("tfjs_model_custom")
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("Converting SavedModel to TensorFlow.js GraphModel format...")
    cmd = [
        "tensorflowjs_converter",
        "--input_format", "tf_saved_model",
        "--output_format", "tfjs_graph_model",
        str(saved_model_path),
        str(output_dir),
    ]
    subprocess.run(cmd, check=True)
    
    # Save class names
    class_mapping = {v: k for k, v in class_indices.items()}
    sorted_class_names = [class_mapping[i] for i in sorted(class_mapping.keys())]
    
    with open(output_dir / 'class_names.json', 'w') as f:
        json.dump(sorted_class_names, f, indent=2)
        
    print(f"Export complete. View your files in {output_dir}/")

if __name__ == "__main__":
    train_df, valid_df, test_df = prepare_dataset()
    best_model, test_gen, class_indices = train_model(train_df, valid_df, test_df)
    
    loss, acc = best_model.evaluate(test_gen)
    print(f"Test Accuracy: {acc*100:.2f}%")
    
    export_to_tfjs(best_model, class_indices)
