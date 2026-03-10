import React, { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';

import { THAI_FOOD_CLASSES } from '../config/foodClasses';
import { useLanguage } from '../contexts/LanguageContext';
import { healthApi } from '../services/healthApi';

interface FoodRecognitionProps {
  onClose: () => void;
}

interface Prediction {
  className: string;
  probability: number;
}

interface NutritionData {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  healthScore: number;
}

export const FoodRecognition: React.FC<FoodRecognitionProps> = ({ onClose }) => {
  const [model, setModel] = useState<tf.LayersModel | tf.GraphModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [classNames, setClassNames] = useState<string[]>(THAI_FOOD_CLASSES);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [selectedPredictionIndex, setSelectedPredictionIndex] = useState<number>(0);
  const [isEditingPrediction, setIsEditingPrediction] = useState<boolean>(false);
  const { t } = useLanguage();

  // Food name translation mapping (model label → translation key)
  const foodTranslationMap: Record<string, string> = {
    pad_thai: 'food.padthai',
    khao_man_gai: 'food.khaoManGai',
    green_curry: 'food.greenCurry',
    fried_rice: 'food.friedRice',
    papaya_salad: 'food.papayaSalad',
    basil_stir_fry: 'food.basilFry',
    khao_soi: 'food.khaoSoi',
    larb_moo: 'food.larbMoo',
    tom_yum_goong: 'food.tomYum',
    omelet_rice: 'food.omelletRice',
  };

  // Function to get translated food name based on current language
  const getTranslatedFoodName = (label: string): string => {
    const translationKey = foodTranslationMap[label];
    return translationKey ? t(translationKey) : label;
  };

  useEffect(() => {
    // Ensure TensorFlow.js is ready before loading model
    tf.ready().then(() => {
      loadModel();
    });
    return () => {
      stopCamera();
    };
  }, []);

  const loadModel = async () => {
    try {
      setIsLoading(true);
      console.log('TensorFlow.js backend:', tf.getBackend());
      
      const modelUrl = `${window.location.origin}/model/model.json`;
      console.log('Loading model from:', modelUrl);
      
      let loadedModel: tf.LayersModel | tf.GraphModel | null = null;

      try {
        // Try GraphModel first (SavedModel format from EfficientNet export)
        console.log('Attempting GraphModel format...');
        loadedModel = await tf.loadGraphModel(modelUrl);
        console.log('✅ Model loaded successfully as GraphModel');
      } catch (graphError) {
        console.warn('GraphModel loading failed, trying LayersModel...', graphError);
        try {
          // Fallback to LayersModel
          loadedModel = await tf.loadLayersModel(modelUrl);
          console.log('✅ Model loaded successfully as LayersModel');
        } catch (layersError) {
          console.error('LayersModel loading also failed:', layersError);
          throw new Error(`Failed to load model in both formats.`);
        }
      }

      setModel(loadedModel);

      // Load class names
      try {
        const response = await fetch('/model/class_names.json');
        if (response.ok) {
          const names = await response.json();
          if (Array.isArray(names) && names.length > 0) {
            console.log('Loaded class names:', names);
            setClassNames(names);
          }
        }
      } catch (fetchError) {
        console.warn('Could not load class_names.json, using defaults', fetchError);
        console.log('Using default class names:', THAI_FOOD_CLASSES);
      }
    } catch (error) {
      console.error('Error initializing model:', error);
      alert('โมเดลไม่พร้อมใช้งาน กรุณาตรวจสอบไฟล์ใน public/model/');
    } finally {
      setIsLoading(false);
    }
  };

  const estimateNutrition = (foodName: string, confidence: number): NutritionData => {
    const normalizeName = (name: string) =>
      name.toLowerCase().replace(/\s+/g, '').replace(/[-_]/g, '');

    const aliases: Record<string, string> = {
      padthaiprawn: 'pad_thai',
      padthaiprawns: 'pad_thai',
      phatthai: 'pad_thai',
      phadthai: 'pad_thai',
      khaomangai: 'khao_man_gai',
      kaomangai: 'khao_man_gai',
      greencurry: 'green_curry',
      friedrice: 'fried_rice',
      papayasalad: 'papaya_salad',
      basilstirfry: 'basil_stir_fry',
      khaosoi: 'khao_soi',
      larbmoo: 'larb_moo',
      tomyumgoong: 'tom_yum_goong',
      omeletrice: 'omelet_rice',
    };

    // Calorie database for common Thai foods (per 100g serving)
    const calorieDatabase: { [key: string]: { calories: number; carbs: number; protein: number; fat: number } } = {
      fried_rice: { calories: 180, carbs: 28, protein: 4, fat: 6 },
      pad_thai: { calories: 350, carbs: 45, protein: 12, fat: 14 },
      tom_yum_goong: { calories: 90, carbs: 8, protein: 12, fat: 3 },
      papaya_salad: { calories: 120, carbs: 20, protein: 5, fat: 2 },
      khao_man_gai: { calories: 420, carbs: 52, protein: 25, fat: 15 },
      basil_stir_fry: { calories: 350, carbs: 35, protein: 20, fat: 15 },
      green_curry: { calories: 200, carbs: 12, protein: 15, fat: 12 },
      khao_soi: { calories: 450, carbs: 55, protein: 18, fat: 18 },
      larb_moo: { calories: 180, carbs: 8, protein: 20, fat: 8 },
      omelet_rice: { calories: 450, carbs: 58, protein: 16, fat: 16 },
    };

    const normalized = normalizeName(foodName);
    const matchedKey = aliases[normalized] || foodName;

    // Find matching food or use default
    const nutrition = calorieDatabase[matchedKey] || { calories: 250, carbs: 35, protein: 15, fat: 10 };

    // Estimate portion size based on confidence (assume higher confidence = better portion detection)
    const portionMultiplier = 1.5 + (confidence / 200); // Range: 1.5x to 2.0x

    // Calculate health score (0-100) based on nutritional balance
    const proteinRatio = nutrition.protein / (nutrition.carbs + nutrition.protein + nutrition.fat);
    const fatRatio = nutrition.fat / (nutrition.carbs + nutrition.protein + nutrition.fat);
    const healthScore = Math.round(
      (proteinRatio * 40) + // Protein is good (max 40 points)
      (1 - fatRatio) * 30 + // Lower fat is better (max 30 points)
      (confidence / 100 * 30) // Confidence in detection (max 30 points)
    );

    return {
      calories: Math.round(nutrition.calories * portionMultiplier),
      carbs: Math.round(nutrition.carbs * portionMultiplier),
      protein: Math.round(nutrition.protein * portionMultiplier),
      fat: Math.round(nutrition.fat * portionMultiplier),
      healthScore: Math.min(healthScore, 100),
    };
  };

  const preprocessImage = async (imageElement: HTMLImageElement): Promise<tf.Tensor4D> => {
    return tf.tidy(() => {
      // Convert image to tensor (shape: [height, width, 3])
      let tensor = tf.browser.fromPixels(imageElement);
      
      // Ensure it's RGB (not RGBA)
      if (tensor.shape[2] === 4) {
        tensor = tf.slice(tensor, [0, 0, 0], [-1, -1, 3]);
      }
      
      // Resize to model input size (224x224)
      tensor = tf.image.resizeBilinear(tensor, [224, 224]);
      
      // Convert to float32 (Keep range [0, 255] as EfficientNet has internal rescaling/normalization layers)
      tensor = tensor.toFloat();
      
      // Add batch dimension [1, 224, 224, 3]
      const batched = tensor.expandDims(0) as tf.Tensor4D;
      
      console.log('Preprocessed image shape:', batched.shape);
      
      return batched;
    });
  };

  const predictFood = async (imageElement: HTMLImageElement) => {
    if (!model) {
      alert('โมเดลยังไม่พร้อม กรุณารอสักครู่');
      return;
    }

    let tensor: tf.Tensor | null = null;
    let prediction: tf.Tensor | null = null;

    try {
      setIsProcessing(true);
      
      // Preprocess image
      tensor = await preprocessImage(imageElement);
      console.log('Input tensor shape:', tensor.shape);
      console.log('Input tensor dtype:', tensor.dtype);
      
      // Validate tensor
      if (!tensor || tensor.shape.length !== 4) {
        throw new Error(`Invalid tensor shape: ${tensor?.shape || 'null'}`);
      }

      // Run prediction - works for both LayersModel and GraphModel
      try {
        if ('predict' in model) {
          console.log('Using LayersModel.predict()');
          prediction = model.predict(tensor) as tf.Tensor;
        } else {
          console.log('Using GraphModel.executeAsync()');
          const output = await (model as tf.GraphModel).executeAsync(tensor);
          prediction = Array.isArray(output) ? output[0] as tf.Tensor : output as tf.Tensor;
        }
      } catch (predictionError) {
        console.error('Prediction execution failed:', predictionError);
        throw new Error(`Model prediction failed: ${(predictionError as Error).message}`);
      }

      if (!prediction) {
        throw new Error('Prediction returned null or undefined');
      }

      console.log('Prediction tensor shape:', prediction.shape);
      console.log('Prediction tensor dtype:', prediction.dtype);
      
      // Ensure output has correct shape [1, 10]
      if (prediction.shape[prediction.shape.length - 1] !== classNames.length) {
        throw new Error(`Output shape mismatch: expected last dim ${classNames.length}, got ${prediction.shape[prediction.shape.length - 1]}`);
      }

      const scores = await prediction.data();
      const scoresArray = Array.from(scores);
      
      console.log('Raw scores:', scoresArray);
      
      // DEBUG: Log all predictions with their indices
      const allPredictions = scoresArray.map((score, index) => ({
        index,
        className: classNames[index] || `Unknown ${index}`,
        score: score,
        percentage: (score * 100).toFixed(2)
      }));
      console.log('All predictions with indices:', allPredictions);
      
      // Find which index has the highest score
      let maxScore = -1;
      let maxIndex = -1;
      scoresArray.forEach((score, index) => {
        if (score > maxScore) {
          maxScore = score;
          maxIndex = index;
        }
      });
      console.log(`⭐ HIGHEST CONFIDENCE: Index ${maxIndex} (${classNames[maxIndex]}) with score ${(maxScore * 100).toFixed(2)}%`);
      
      // Get all predictions and sort by probability
      const topPredictions: Prediction[] = scoresArray
        .map((score, index) => ({
          className: classNames[index] || `Unknown ${index}`,
          probability: score * 100
        }))
        .sort((a, b) => b.probability - a.probability);
      
      console.log('Top predictions:', topPredictions);
      setPredictions(topPredictions);
      setSelectedPredictionIndex(0);
      setIsEditingPrediction(false);
      
      // Estimate nutrition for top prediction
      if (topPredictions.length > 0) {
        const topFood = topPredictions[0];
        const nutrition = estimateNutrition(topFood.className, topFood.probability);
        setNutritionData(nutrition);
      }

    } catch (error) {
      console.error('Error during prediction:', error);
      const errorMsg = (error as Error).message || 'Unknown error';
      alert('เกิดข้อผิดพลาด: ' + errorMsg);
    } finally {
      // Cleanup tensors safely
      if (tensor) {
        try {
          tensor.dispose();
        } catch (e) {
          console.warn('Error disposing input tensor:', e);
        }
      }
      if (prediction) {
        try {
          prediction.dispose();
        } catch (e) {
          console.warn('Error disposing prediction tensor:', e);
        }
      }
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setImagePreview(imageUrl);
      setPredictions([]);
      setNutritionData(null);
      setSelectedPredictionIndex(0);
      setIsEditingPrediction(false);

      // Create image element and predict
      const img = new Image();
      img.onload = () => {
        console.log('Image loaded, starting prediction...');
        predictFood(img);
      };
      img.onerror = (err) => {
        console.error('Error loading image:', err);
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      // Stop existing stream if we are flipping cameras
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง / Could not access the camera. Please check permissions.');
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Re-start camera when facingMode changes, but only if camera is already active
  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const imageUrl = canvas.toDataURL('image/jpeg');
    setImagePreview(imageUrl);
    setPredictions([]);
    setNutritionData(null);
    setSelectedPredictionIndex(0);
    setIsEditingPrediction(false);
    stopCamera();

    // Create image element and predict
    const img = new Image();
    img.onload = () => {
      console.log('Image captured, starting prediction...');
      predictFood(img);
    };
    img.src = imageUrl;
  };

  return (
    <div className="food-recognition-overlay">
      <div className="food-recognition-modal">
        <div className="modal-header">
          <h2>{t('food.title')}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-content">
          {isLoading && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>{t('food.loading')}</p>
            </div>
          )}

          {!isLoading && (
            <>
              {!imagePreview && !isCameraActive && (
                <div className="upload-section">
                  <div className="upload-buttons">
                    <button className="action-button camera-btn" onClick={startCamera} aria-label={t('food.openCamera')}>
                      {t('food.openCamera')}
                    </button>
                    <button
                      className="action-button upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t('food.selectImage')}
                    >
                      {t('food.selectImage')}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    aria-label="Upload food image"
                  />
                </div>
              )}

              {isCameraActive && (
                <div className="camera-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: '20px 0' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="camera-preview"
                    style={{ width: '100%', maxWidth: '350px', maxHeight: '50vh', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <div className="camera-controls" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="capture-btn" onClick={capturePhoto} style={{ padding: '12px 24px', borderRadius: '24px', background: '#2ecc71', color: 'white', border: 'none', fontWeight: 600, fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(46, 204, 113, 0.25)' }}>
                      {t('food.capture')}
                    </button>
                    <button className="flip-btn" onClick={flipCamera} style={{ padding: '12px', borderRadius: '50%', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px' }} aria-label="Flip Camera">
                      🔄
                    </button>
                    <button className="cancel-btn" onClick={stopCamera} style={{ padding: '12px 24px', borderRadius: '24px', background: '#ffebee', color: '#c62828', border: 'none', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}>
                      {t('food.cancel')}
                    </button>
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="preview-section">
                  <img src={imagePreview} alt="Food" className="food-image" />
                  
                  {isProcessing && (
                    <div className="processing-overlay" style={{ color: '#0f140f' }}>
                      <div className="spinner"></div>
                      <p>{t('food.analyzing')}</p>
                    </div>
                  )}

                  {!isProcessing && predictions.length > 0 && nutritionData && (
                    <div className="results-container" style={{ color: '#0f140f' }}>
                      <div className="food-header">
                        {!isEditingPrediction ? (
                          <>
                            <h2 className="food-title">
                              {getTranslatedFoodName(predictions[selectedPredictionIndex].className)}
                            </h2>
                            <button 
                              className="edit-prediction-btn" 
                              onClick={() => setIsEditingPrediction(true)}
                              aria-label="Correct prediction"
                              style={{ marginLeft: '10px', fontSize: '14px', padding: '4px 8px', borderRadius: '4px', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer' }}
                            >
                              ✏️ Not this?
                            </button>
                          </>
                        ) : (
                          <div className="correction-container" style={{ width: '100%', marginBottom: '10px' }}>
                            <label htmlFor="food-correction-select" className="sr-only">Select correct food</label>
                            <select 
                              id="food-correction-select"
                              title="Select correct food"
                              value={selectedPredictionIndex}
                              onChange={(e) => {
                                const newIdx = parseInt(e.target.value, 10);
                                setSelectedPredictionIndex(newIdx);
                                setIsEditingPrediction(false);
                                
                                // Recalculate nutrition with manually selected food
                                // Use 100 confidence for manual selections
                                const newFood = predictions[newIdx];
                                const nutrition = estimateNutrition(newFood.className, 100);
                                setNutritionData(nutrition);
                              }}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px', color: '#333' }}
                            >
                              {predictions.map((p, idx) => (
                                <option key={idx} value={idx}>
                                  {getTranslatedFoodName(p.className)} - {(p.probability).toFixed(1)}% match
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="calories-display">
                        <div className="calories-icon">☀️</div>
                        <div className="calories-number">{nutritionData.calories}</div>
                      </div>

                      <div className="macros-row">
                        <div className="macro-item">
                          <div className="macro-label">Carbs</div>
                          <div className="macro-value">{nutritionData.carbs}.0g</div>
                        </div>
                        <div className="macro-item">
                          <div className="macro-label">Protein</div>
                          <div className="macro-value">{nutritionData.protein}.0g</div>
                        </div>
                        <div className="macro-item">
                          <div className="macro-label">Fat</div>
                          <div className="macro-value">{nutritionData.fat}.0g</div>
                        </div>
                      </div>

                      <div className="health-score-section">
                        <div className="health-icon">❤️</div>
                        <div className="health-label">Health Score</div>
                        <div className="health-bar-container">
                          <div 
                            className="health-bar-fill" 
                            style={{ width: `${nutritionData.healthScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="nutrition-facts">
                        <div className="nutrition-header">
                          <span className="nutrition-icon">🍎</span>
                          <span className="nutrition-title">Nutrition facts</span>
                        </div>
                        <div className="nutrition-list">
                          <div className="nutrition-row">
                            <span className="nutrition-label">Carbohydrate</span>
                            <span className="nutrition-value">{nutritionData.carbs}.0g</span>
                          </div>
                          <div className="nutrition-row">
                            <span className="nutrition-label">Protein</span>
                            <span className="nutrition-value">{nutritionData.protein}.0g</span>
                          </div>
                          <div className="nutrition-row">
                            <span className="nutrition-label">Fat</span>
                            <span className="nutrition-value">{nutritionData.fat}.0g</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        className="log-meal-btn"
                        onClick={async () => {
                          if (!nutritionData || predictions.length === 0) return;
                          
                          // Save meal to localStorage
                          const mealName = getTranslatedFoodName(predictions[selectedPredictionIndex].className);
                          const meal = {
                            id: Date.now(),
                            timestamp: new Date().toISOString(),
                            foodName: mealName,
                            calories: nutritionData.calories,
                            carbs: nutritionData.carbs,
                            protein: nutritionData.protein,
                            fat: nutritionData.fat,
                            healthScore: nutritionData.healthScore,
                            imageUrl: imagePreview
                          };

                          const existingMeals = JSON.parse(localStorage.getItem('meals') || '[]');
                          existingMeals.push(meal);
                          localStorage.setItem('meals', JSON.stringify(existingMeals));
                          
                          try {
                            const payload = {
                              name: mealName,
                              calories: nutritionData.calories,
                              carbs: nutritionData.carbs,
                              protein: nutritionData.protein,
                              fat: nutritionData.fat,
                              healthScore: nutritionData.healthScore,
                              imageUrl: imagePreview,
                            };
                            await healthApi.logMeal(payload);
                            
                            // If user corrected the AI prediction, log feedback
                            if (selectedPredictionIndex !== 0) {
                              console.log(`[AI Feedback] User corrected prediction from ${predictions[0].className} to ${predictions[selectedPredictionIndex].className}`);
                              // In a real scenario, we might call an endpoint like healthApi.logAIFeedback(...)
                              // We simulate it here by logging to console/localStorage
                              const feedback = {
                                originalPrediction: predictions[0].className,
                                correctedPrediction: predictions[selectedPredictionIndex].className,
                                timestamp: Date.now()
                              };
                              const existingFeedback = JSON.parse(localStorage.getItem('aiFeedback') || '[]');
                              existingFeedback.push(feedback);
                              localStorage.setItem('aiFeedback', JSON.stringify(existingFeedback));
                            }
                            
                            // Trigger score refresh after successful API call
                            window.dispatchEvent(new Event('healthDataUpdated'));
                          } catch (error) {
                            console.error('Failed to sync meal to API', error);
                            // Still trigger refresh for localStorage fallback
                            window.dispatchEvent(new Event('healthDataUpdated'));
                          }

                          alert(t('food.mealLogged'));
                          onClose();
                        }}
                        aria-label={t('food.logMeal')}
                      >
                        {t('food.logMeal')}
                      </button>

                      <button 
                        className="retake-btn-bottom"
                        onClick={() => {
                          setImagePreview(null);
                          setPredictions([]);
                          setNutritionData(null);
                        }}
                      >
                        {t('food.retake')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
