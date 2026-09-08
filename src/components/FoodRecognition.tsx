import React, { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { LuCamera, LuImage, LuSparkles, LuX, LuFlame, LuHeart, LuApple, LuRefreshCw, LuUtensils, LuLoader, LuCheck, LuPencil, LuChevronRight, LuFileText, LuShieldCheck, LuBadgeAlert, LuBadgeCheck } from 'react-icons/lu';

import { THAI_FOOD_CLASSES } from '../config/foodClasses';
import { useLanguage } from '../contexts/LanguageContext';
import { healthApi } from '../services/healthApi';
import { recognizeFoodWithAi, type AiFoodResult } from '../services/foodAiApi';
import { safeGetItem } from '../utils/safeStorage';
import '../styles/FoodRecognition.css';

type RecognitionEngine = 'local' | 'ai';
const ENGINE_KEY = 'foodRecognitionEngine';

interface FoodRecognitionProps {
  onClose: () => void;
  onSuccess?: () => void;
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
  sugar?: number;
  sodium?: number;
  fiber?: number;
}

export const FoodRecognition: React.FC<FoodRecognitionProps> = ({ onClose, onSuccess }) => {
  const [model, setModel] = useState<tf.LayersModel | tf.GraphModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [classNames, setClassNames] = useState<string[]>(THAI_FOOD_CLASSES);
  
  // NEW: Comprehensive Upload & Processing State Management
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [selectedPredictionIndex, setSelectedPredictionIndex] = useState<number>(0);
  const [isEditingPrediction, setIsEditingPrediction] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [engine, setEngine] = useState<RecognitionEngine>(() =>
    safeGetItem<RecognitionEngine>(ENGINE_KEY, 'local') === 'ai' ? 'ai' : 'local',
  );
  const [aiResult, setAiResult] = useState<AiFoodResult | null>(null);
  const { t } = useLanguage();

  const chooseEngine = (next: RecognitionEngine) => {
    setEngine(next);
    try { localStorage.setItem(ENGINE_KEY, next); } catch { /* storage unavailable */ }
  };

  // Cycling status messages while the on-device model runs. The AI path sets its
  // own single message and shouldn't be overwritten by these.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (uploadStatus === 'processing' && engine === 'local') {
      const messages = [
        t('food.cycle1'),
        t('food.cycle2'),
        t('food.cycle3'),
        t('food.cycle4'),
      ];
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % messages.length;
        setStatusMessage(messages[idx]);
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [uploadStatus, engine, t]);

  type ModelSource = {
    url: string;
    kind: 'graph' | 'layers';
    classNamesUrl: string;
    label: string;
  };

  const modelSources: ModelSource[] = [
    {
      url: `${window.location.origin}/model/model.json`,
      kind: 'graph',
      classNamesUrl: '/model/class_names.json',
      label: 'primary graph model',
    },
    {
      url: `${window.location.origin}/model_backup/model.json`,
      kind: 'layers',
      classNamesUrl: '/model_backup/class_names.json',
      label: 'backup layers model',
    },
  ];

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

  const normalizeModelLabel = (label: string): string => {
    if (label === 'kao_man_gai') {
      return 'khao_man_gai';
    }

    return label;
  };

  // Initial device detection for camera
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setFacingMode('environment');
    } else {
      setFacingMode('user');
    }
  }, []);

  useEffect(() => {
    // Local engine: load the on-device TF.js model. AI engine: skip it entirely
    // (no ~17MB model download, no TensorFlow init).
    if (engine === 'local') {
      tf.ready().then(() => {
        loadModel();
      });
    } else {
      setIsLoading(false);
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const loadModel = async () => {
    try {
      setIsLoading(true);
      console.log('TensorFlow.js backend:', tf.getBackend());

      let loadedModel: tf.LayersModel | tf.GraphModel | null = null;
      let lastLoadError: unknown = null;

      for (const source of modelSources) {
        try {
          console.log(`Loading ${source.label} from:`, source.url);
          loadedModel =
            source.kind === 'graph'
              ? await tf.loadGraphModel(source.url)
              : await tf.loadLayersModel(source.url);
          console.log(`Model loaded successfully as ${source.kind} model from ${source.label}`);
          break;
        } catch (error) {
          lastLoadError = error;
          console.warn(`Failed to load ${source.label}`, error);
        }
      }

      if (!loadedModel) {
        throw lastLoadError instanceof Error
          ? lastLoadError
          : new Error('Failed to load model from all available sources.');
      }

      setModel(loadedModel);

      // Load class names
      let loadedClassNames = false;
      for (const classNamesUrl of modelSources.map((source) => source.classNamesUrl)) {
        try {
          const response = await fetch(classNamesUrl);
          if (!response.ok) {
            continue;
          }

          const names = await response.json();
          if (Array.isArray(names) && names.length > 0) {
            const normalizedNames = names.map((name) => normalizeModelLabel(String(name)));
            console.log('Loaded class names:', normalizedNames);
            setClassNames(normalizedNames);
            loadedClassNames = true;
            break;
          }
        } catch (fetchError) {
          console.warn(`Could not load class names from ${classNamesUrl}`, fetchError);
        }
      }

      if (!loadedClassNames) {
        console.log('Using default class names:', THAI_FOOD_CLASSES);
      }
    } catch (error) {
      console.error('Error initializing model:', error);
      alert(t('food.alertModelUnavailable'));
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
    const calorieDatabase: { [key: string]: { calories: number; carbs: number; protein: number; fat: number; sugar: number; sodium: number; fiber: number } } = {
      fried_rice:     { calories: 180, carbs: 28, protein:  4, fat:  6, sugar:  2, sodium: 620, fiber: 1 },
      pad_thai:       { calories: 350, carbs: 45, protein: 12, fat: 14, sugar:  6, sodium: 890, fiber: 2 },
      tom_yum_goong:  { calories:  90, carbs:  8, protein: 12, fat:  3, sugar:  3, sodium: 980, fiber: 1 },
      papaya_salad:   { calories: 120, carbs: 20, protein:  5, fat:  2, sugar:  8, sodium: 740, fiber: 3 },
      khao_man_gai:   { calories: 420, carbs: 52, protein: 25, fat: 15, sugar:  2, sodium: 760, fiber: 1 },
      basil_stir_fry: { calories: 350, carbs: 35, protein: 20, fat: 15, sugar:  4, sodium: 820, fiber: 2 },
      green_curry:    { calories: 200, carbs: 12, protein: 15, fat: 12, sugar:  3, sodium: 560, fiber: 2 },
      khao_soi:       { calories: 450, carbs: 55, protein: 18, fat: 18, sugar:  3, sodium: 910, fiber: 2 },
      larb_moo:       { calories: 180, carbs:  8, protein: 20, fat:  8, sugar:  2, sodium: 650, fiber: 1 },
      omelet_rice:    { calories: 450, carbs: 58, protein: 16, fat: 16, sugar:  3, sodium: 720, fiber: 1 },
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
      carbs:    Math.round(nutrition.carbs    * portionMultiplier),
      protein:  Math.round(nutrition.protein  * portionMultiplier),
      fat:      Math.round(nutrition.fat      * portionMultiplier),
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
      setUploadStatus('error');
      setErrorMessage(t('food.stModelNotReady'));
      return;
    }

    let tensor: tf.Tensor | null = null;
    let prediction: tf.Tensor | null = null;

    try {
      setIsProcessing(true);
      setUploadStatus('processing');
      setStatusMessage(t('food.stAnalyzingStructure'));
      setUploadProgress(100);
      setErrorMessage('');
      
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
      console.log(`HIGHEST CONFIDENCE: Index ${maxIndex} (${classNames[maxIndex]}) with score ${(maxScore * 100).toFixed(2)}%`);
      
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

      setUploadStatus('success');
      setStatusMessage(t('food.stCompleteBang'));

    } catch (error) {
      console.error('Error during prediction:', error);
      const errorMsg = (error as Error).message || 'Unknown error';
      setUploadStatus('error');
      setErrorMessage(`${t('food.stCannotAnalyze')}${errorMsg}`);
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

  // ── Cloud AI recognition (engine === 'ai', or the "Identify with AI" escalation button) ──
  const runAiRecognition = async (imageUrl: string) => {
    const hint =
      predictions.length > 0
        ? { dish: predictions[0].className, confidence: predictions[0].probability / 100 }
        : undefined;

    setIsProcessing(true);
    setUploadStatus('processing');
    setStatusMessage(t('food.stAiAnalyzingMenu'));
    setUploadProgress(60);
    setErrorMessage('');

    try {
      const r = await recognizeFoodWithAi(imageUrl, hint);
      if (!r.isFood) {
        setUploadStatus('error');
        setErrorMessage(t('food.stNoFood'));
        return;
      }
      setAiResult(r);
      setPredictions([
        { className: r.dishLocal || r.dish, probability: Math.round(r.confidence * 100) },
      ]);
      setNutritionData({
        calories: Math.round(r.nutrition.calories),
        carbs: Math.round(r.nutrition.carbs),
        protein: Math.round(r.nutrition.protein),
        fat: Math.round(r.nutrition.fat),
        healthScore: Math.min(100, Math.max(0, Math.round(r.healthScore))),
        sugar: 0,
        sodium: Math.round(r.nutrition.sodium),
        fiber: Math.round(r.nutrition.fiber),
      });
      setSelectedPredictionIndex(0);
      setIsEditingPrediction(false);
      setUploadStatus('success');
      setStatusMessage(t('food.stAiDone'));
    } catch (err) {
      setUploadStatus('error');
      setErrorMessage((err as Error).message || t('food.stAiCannot'));
    } finally {
      setIsProcessing(false);
      setUploadProgress(100);
    }
  };

  // Route a freshly-loaded image to whichever engine is selected.
  const analyzeImage = (imageUrl: string) => {
    if (engine === 'ai') {
      void runAiRecognition(imageUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      predictFood(img);
    };
    img.onerror = () => {
      setUploadStatus('error');
      setErrorMessage(t('food.stCannotLoadImage'));
    };
    img.src = imageUrl;
  };

  const processFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadStatus('error');
      setErrorMessage(t('food.stOnlyImages'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage(t('food.stTooLarge'));
      return;
    }

    // Start uploading state
    setUploadStatus('uploading');
    setStatusMessage(t('food.stUploadingPrep'));
    setUploadProgress(20);
    setErrorMessage('');
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
    setSelectedPredictionIndex(0);
    setIsEditingPrediction(false);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 80);

    const reader = new FileReader();
    reader.onload = (e) => {
      clearInterval(progressInterval);
      setUploadProgress(100);
      const imageUrl = e.target?.result as string;

      setTimeout(() => {
        setImagePreview(imageUrl);
        setUploadStatus('processing');
        setStatusMessage(t('food.stAnalyzingStructure'));
        setUploadProgress(0);
        analyzeImage(imageUrl);
      }, 350);
    };
    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadStatus('error');
      setErrorMessage(t('food.stReadError'));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
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
      alert(t('food.alertCameraDenied'));
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
    
    stopCamera();
    setUploadStatus('uploading');
    setStatusMessage(t('food.stCapturing'));
    setUploadProgress(50);
    setErrorMessage('');
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
    setSelectedPredictionIndex(0);
    setIsEditingPrediction(false);

    setTimeout(() => {
      setUploadProgress(100);
      setTimeout(() => {
        setImagePreview(imageUrl);
        setUploadStatus('processing');
        setStatusMessage(t('food.stAnalyzingStructure'));
        setUploadProgress(0);
        analyzeImage(imageUrl);
      }, 300);
    }, 250);
  };

  const handleRetry = () => {
    setUploadStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
    setUploadProgress(0);
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
  };

  return (
    <div className="food-recognition-overlay" onClick={(e) => { if (e.target === e.currentTarget && uploadStatus !== 'uploading' && uploadStatus !== 'processing') onClose(); }}>
      <div className="food-recognition-modal">
        {/* Top-Right Absolute Close Button */}
        <button 
          className="close-btn-refined" 
          onClick={onClose} 
          disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
          aria-label="Close"
        >
          <LuX />
        </button>

        {/* Show Clean Header ONLY when NOT in initial upload view (e.g. camera active, analyzing, results) */}
        {(isLoading || isCameraActive || imagePreview || uploadStatus === 'error' || uploadStatus === 'uploading') && (
          <div className="modal-header-clean">
            <div className="header-left">
              <div className="header-icon-box">
                <LuCamera className="header-camera-icon" />
              </div>
              <h2 className="header-title">{t('food.headerTitle')}</h2>
            </div>
            {uploadStatus !== 'idle' && uploadStatus !== 'error' && (
              <div className={`status-badge-header status-${uploadStatus}`}>
                {uploadStatus === 'uploading' && <LuLoader className="animate-spin text-blue-500" />}
                {uploadStatus === 'processing' && <LuSparkles className="animate-pulse text-indigo-500" />}
                {uploadStatus === 'success' && <LuBadgeCheck className="text-emerald-500" />}
                <span>{uploadStatus === 'uploading' ? t('food.badgeUploading') : uploadStatus === 'processing' ? t('food.badgeThinking') : t('food.badgeDone')}</span>
              </div>
            )}
          </div>
        )}

        <div className="modal-content-clean">
          {isLoading && (
            <div className="loading-container-clean">
              <div className="spinner-ring">
                <LuLoader className="spinner-lu" />
              </div>
              <p className="loading-text">{t('food.loading')}</p>
            </div>
          )}

          {!isLoading && (
            <>
              {/* ERROR STATE CARD */}
              {uploadStatus === 'error' && (
                <div className="status-error-container animate-fade-in">
                  <div className="error-icon-ring">
                    <LuBadgeAlert className="error-icon-lu" />
                  </div>
                  <h3 className="error-title">{t('food.errTitle')}</h3>
                  <p className="error-message-text">{errorMessage || t('food.errGeneric')}</p>
                  
                  <div className="error-actions">
                    <button className="health-btn-primary retry-btn" onClick={handleRetry}>
                      <LuRefreshCw className="btn-icon" />
                      <span>{t('food.retryAgain')}</span>
                    </button>
                    <button className="health-btn-secondary" onClick={() => fileInputRef.current?.click()}>
                      <LuImage className="btn-icon" />
                      <span>{t('food.chooseAnother')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* UPLOADING SKELETON / LOADING OVERLAY WHEN NO PREVIEW YET */}
              {uploadStatus === 'uploading' && !imagePreview && (
                <div className="status-loading-container animate-fade-in">
                  <div className="loading-card-glass">
                    <div className="loading-icon-ring">
                      <LuLoader className="loading-spinner-lu text-blue-500 animate-spin" />
                    </div>
                    <h3 className="loading-title-text">{t('food.uploadingTitle')}</h3>
                    <p className="loading-sub-text">{statusMessage || t('food.uploadingSub')}</p>

                    {/* Smooth Progress Bar */}
                    <div className="upload-progress-wrapper">
                      <div 
                        className="upload-progress-bar" 
                        style={{ width: `${uploadProgress > 0 ? uploadProgress : 30}%` }}
                      />
                    </div>
                    <span className="upload-progress-percentage">
                      {uploadProgress > 0 ? `${uploadProgress}%` : t('food.preparingData')}
                    </span>

                    {/* Shimmer Skeleton Preview Placeholder */}
                    <div className="skeleton-image-placeholder">
                      <div className="skeleton-shimmer-wave" />
                      <LuImage className="skeleton-icon" />
                      <span>{t('food.buildingPreview')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* IDLE STATE: 2-COLUMN UPLOAD GRID */}
              {!imagePreview && !isCameraActive && uploadStatus === 'idle' && (
                <div 
                  className={`upload-grid-container ${isDragging ? 'is-dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (uploadStatus === 'idle') setIsDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (uploadStatus === 'idle') setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    if (uploadStatus !== 'idle') return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                >
                  <div className="upload-grid-body">
                    {/* LEFT COLUMN: Header + Subtitle + Centerpiece */}
                    <div className="upload-col-left">
                      <div className="upload-header-row">
                        <div className="header-icon-refined">
                          <LuCamera />
                        </div>
                        <h2 className="title-refined">{t('food.headerTitle')}</h2>
                      </div>
                      <p className="subtitle-refined">
                        {t('food.aiAnalyze')}
                      </p>

                      <div className="engine-toggle" role="group" aria-label="Recognition engine">
                        <button
                          type="button"
                          className={`engine-opt ${engine === 'local' ? 'engine-opt--active' : ''}`}
                          onClick={() => chooseEngine('local')}
                        >
                          <LuShieldCheck /> <span>{t('food.engineLocal')}</span>
                        </button>
                        <button
                          type="button"
                          className={`engine-opt ${engine === 'ai' ? 'engine-opt--active' : ''}`}
                          onClick={() => chooseEngine('ai')}
                        >
                          <LuSparkles /> <span>AI</span>
                        </button>
                      </div>
                      <p className="engine-hint">
                        {engine === 'ai'
                          ? t('food.engineHintAi')
                          : t('food.engineHintLocal')}
                      </p>

                      <div className="centerpiece-refined">
                        <div className="bowl-glow-backdrop"></div>
                        <div className="food-bowl-graphic">
                          <div className="bowl-inner-rim">
                            <div className="ingredient-item ing-salmon"></div>
                            <div className="ingredient-item ing-avocado"></div>
                            <div className="ingredient-item ing-greens"></div>
                            <div className="ingredient-item ing-rice"></div>
                            <LuUtensils className="bowl-center-icon" />
                          </div>
                        </div>
                        <div className="ai-glass-badge">
                          <span>AI</span>
                          <LuSparkles className="badge-sparkle-1" />
                        </div>
                        <LuSparkles className="floating-sparkle sp-1" />
                        <LuSparkles className="floating-sparkle sp-2" />
                        <LuSparkles className="floating-sparkle sp-3" />
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Action Cards */}
                    <div className="upload-col-right">
                      <div className="action-cards-stack">
                        {/* Primary Action: Open Camera */}
                        <button 
                          className="action-card-primary" 
                          onClick={startCamera} 
                          disabled={uploadStatus !== 'idle'}
                          aria-label={t('food.openCamera')}
                        >
                          <div className="action-card-left">
                            <div className="action-icon-circle-primary">
                              <LuCamera />
                            </div>
                            <div className="action-text-group">
                              <div className="action-title-primary">{t('food.actionCameraTitle')}</div>
                              <div className="action-sub-primary">{t('food.actionCameraSub')}</div>
                            </div>
                          </div>
                          <LuChevronRight className="action-arrow-primary" />
                        </button>

                        {/* Secondary Action: Select Image */}
                        <button 
                          className="action-card-secondary" 
                          onClick={() => fileInputRef.current?.click()} 
                          disabled={uploadStatus !== 'idle'}
                          aria-label={t('food.selectImage')}
                        >
                          <div className="action-card-left">
                            <div className="action-icon-circle-secondary">
                              <LuImage />
                            </div>
                            <div className="action-text-group">
                              <div className="action-title-secondary">{t('food.selectImage')}</div>
                              <div className="action-sub-secondary">{t('food.actionGallerySub')}</div>
                            </div>
                          </div>
                          <LuChevronRight className="action-arrow-secondary" />
                        </button>
                      </div>

                      <div className="file-format-note">
                        <LuFileText className="format-icon" />
                        <span>{t('food.formatNote')}</span>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM SECURITY BANNER */}
                  <div className="security-footer-refined">
                    <LuShieldCheck className="security-icon" />
                    <span>{t('food.privacyNote')}</span>
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

              {isCameraActive && uploadStatus === 'idle' && (
                <div className="camera-section-clean animate-fade-in">
                  <div className="camera-preview-wrapper">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-preview-clean"
                    />
                    <div className="camera-scan-overlay">
                      <div className="scan-corner top-left"></div>
                      <div className="scan-corner top-right"></div>
                      <div className="scan-corner bottom-left"></div>
                      <div className="scan-corner bottom-right"></div>
                    </div>
                  </div>
                  
                  <div className="camera-controls-clean">
                    <button className="cancel-btn-clean" onClick={stopCamera}>
                      <LuX />
                      <span>{t('food.cancel')}</span>
                    </button>
                    
                    <button className="capture-btn-clean" onClick={capturePhoto}>
                      <LuCamera className="text-xl mr-1.5" />
                      <span>{t('food.captureBtn')}</span>
                    </button>

                    <button className="flip-btn-clean" onClick={flipCamera} aria-label="Flip Camera">
                      <LuRefreshCw />
                    </button>
                  </div>
                </div>
              )}

              {imagePreview && uploadStatus !== 'error' && (
                <div className="preview-section-clean animate-fade-in">
                  <div className="preview-image-wrapper">
                    <img 
                      src={imagePreview} 
                      alt="Food" 
                      className={`food-image-clean ${uploadStatus === 'processing' || uploadStatus === 'uploading' ? 'is-analyzing-blur' : ''}`} 
                    />
                    
                    {/* MODERN SAAS PROCESSING & UPLOADING OVERLAY */}
                    {(uploadStatus === 'processing' || uploadStatus === 'uploading') && (
                      <div className="processing-overlay-clean">
                        <div className="ai-laser-scanner" />
                        <div className="ai-pulse-ring">
                          {uploadStatus === 'uploading' ? (
                            <LuLoader className="ai-sparkle-spin text-blue-500 animate-spin" />
                          ) : (
                            <LuSparkles className="ai-sparkle-spin text-indigo-500 animate-pulse" />
                          )}
                        </div>
                        <h4 className="analyzing-title">
                          {uploadStatus === 'uploading'
                            ? t('food.analyzingUploading')
                            : engine === 'ai'
                              ? t('food.analyzingAi')
                              : t('food.analyzingLocal')}
                        </h4>
                        {uploadStatus === 'processing' && (
                          <div className={`analyzing-engine analyzing-engine--${engine}`}>
                            {engine === 'ai' ? (
                              <><LuSparkles /> <span>{t('food.engineChipAi')}</span></>
                            ) : (
                              <><LuShieldCheck /> <span>{t('food.engineChipLocal')}</span></>
                            )}
                          </div>
                        )}
                        <p className="analyzing-subtitle">{statusMessage}</p>

                        <div className="overlay-progress-bar-wrapper">
                          <div 
                            className="overlay-progress-bar-fill" 
                            style={{ width: `${uploadProgress > 0 ? uploadProgress : 65}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* SUCCESS TOP BANNER OVERLAY */}
                    {uploadStatus === 'success' && (
                      <div className="success-banner-overlay animate-slide-down">
                        <LuBadgeCheck className="success-banner-icon" />
                        <span>{statusMessage || t('food.successBanner')}</span>
                      </div>
                    )}
                  </div>

                  {/* RESULTS CONTAINER */}
                  {!isProcessing && predictions.length > 0 && nutritionData && (
                    <div className="results-container-clean animate-fade-in">
                      <div className="food-header-clean">
                        {!isEditingPrediction ? (
                          <div className="food-title-row">
                            <h3 className="food-title-clean">
                              {getTranslatedFoodName(predictions[selectedPredictionIndex].className)}
                            </h3>
                            {engine === 'local' && (
                              <button
                                className="edit-prediction-btn-clean"
                                onClick={() => setIsEditingPrediction(true)}
                                aria-label="Correct prediction"
                              >
                                <LuPencil /> <span>{t('food.notThisDish')}</span>
                              </button>
                            )}
                            {engine === 'local' && (
                              <button
                                className="edit-prediction-btn-clean edit-prediction-btn-clean--ai"
                                onClick={() => imagePreview && runAiRecognition(imagePreview)}
                                disabled={uploadStatus === 'processing'}
                                aria-label="Re-identify with AI"
                              >
                                <LuSparkles /> <span>{t('food.identifyWithAi')}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="correction-container-clean">
                            <label htmlFor="food-correction-select" className="correction-label">
                              {t('food.pickCorrect')}
                            </label>
                            <select 
                              id="food-correction-select"
                              title="Select correct food"
                              value={selectedPredictionIndex}
                              onChange={(e) => {
                                const newIdx = parseInt(e.target.value, 10);
                                setSelectedPredictionIndex(newIdx);
                                setIsEditingPrediction(false);
                                
                                const newFood = predictions[newIdx];
                                const nutrition = estimateNutrition(newFood.className, 100);
                                setNutritionData(nutrition);
                              }}
                              className="correction-select"
                            >
                              {predictions.map((p, idx) => (
                                <option key={idx} value={idx}>
                                  {`${getTranslatedFoodName(p.className)} · ${(p.probability).toFixed(1)}% ${t('food.matchLabel')}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {aiResult && (
                        <div className="ai-result-note">
                          <LuSparkles className="ai-result-note-icon" />
                          <div>
                            {aiResult.servingEstimate && (
                              <span className="ai-result-serving">{aiResult.servingEstimate}</span>
                            )}
                            {aiResult.healthNotes && <p className="ai-result-advice">{aiResult.healthNotes}</p>}
                          </div>
                        </div>
                      )}

                      {/* Calories Card */}
                      <div className="calories-display-clean">
                        <div className="calories-icon-box">
                          <LuFlame className="calories-icon-lu" />
                        </div>
                        <div className="calories-data">
                          <span className="calories-number-clean">{nutritionData.calories}</span>
                          <span className="calories-unit-clean">kcal</span>
                        </div>
                      </div>

                      {/* Macros Row */}
                      <div className="macros-row-clean">
                        <div className="macro-item-clean">
                          <span className="macro-label-clean">{t('food.macroCarbs')}</span>
                          <span className="macro-value-clean">{nutritionData.carbs}g</span>
                        </div>
                        <div className="macro-divider"></div>
                        <div className="macro-item-clean">
                          <span className="macro-label-clean">{t('food.macroProtein')}</span>
                          <span className="macro-value-clean">{nutritionData.protein}g</span>
                        </div>
                        <div className="macro-divider"></div>
                        <div className="macro-item-clean">
                          <span className="macro-label-clean">{t('food.macroFat')}</span>
                          <span className="macro-value-clean">{nutritionData.fat}g</span>
                        </div>
                      </div>

                      {/* Health Score Card */}
                      <div className="health-score-card">
                        <div className="health-score-header">
                          <div className="health-icon-box">
                            <LuHeart className="health-icon-lu" />
                          </div>
                          <span className="health-label-clean">{t('food.healthScoreLabel')}</span>
                          <span className="health-score-val">{nutritionData.healthScore}/100</span>
                        </div>
                        <div className="health-bar-container-clean">
                          <div 
                            className="health-bar-fill-clean" 
                            style={{ 
                              width: `${nutritionData.healthScore}%`,
                              background: nutritionData.healthScore >= 70 ? 'linear-gradient(90deg, #10B981, #059669)' : nutritionData.healthScore >= 50 ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #EF4444, #DC2626)'
                            }}
                          />
                        </div>
                      </div>

                      {/* Nutrition Facts List */}
                      <div className="nutrition-facts-clean">
                        <div className="nutrition-header-clean">
                          <LuApple className="nutrition-icon-lu" />
                          <span className="nutrition-title-clean">{t('food.nutritionFactsTitle')}</span>
                        </div>
                        <div className="nutrition-list-clean">
                          <div className="nutrition-row-clean">
                            <span className="nutrition-label-clean">{t('food.nutTotalCalories')}</span>
                            <span className="nutrition-value-clean">{nutritionData.calories} kcal</span>
                          </div>
                          <div className="nutrition-row-clean">
                            <span className="nutrition-label-clean">{t('food.nutCarbs')}</span>
                            <span className="nutrition-value-clean">{nutritionData.carbs} g</span>
                          </div>
                          <div className="nutrition-row-clean">
                            <span className="nutrition-label-clean">{t('food.nutProtein')}</span>
                            <span className="nutrition-value-clean">{nutritionData.protein} g</span>
                          </div>
                          <div className="nutrition-row-clean">
                            <span className="nutrition-label-clean">{t('food.nutFat')}</span>
                            <span className="nutrition-value-clean">{nutritionData.fat} g</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="results-actions-clean">
                        <button 
                          className="health-btn-primary log-meal-btn-clean"
                          disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                          onClick={async () => {
                            if (!nutritionData || predictions.length === 0) return;
                            if (uploadStatus === 'uploading' || uploadStatus === 'processing') return; // Prevent double click
                            
                            setUploadStatus('uploading');
                            setStatusMessage(t('food.stSavingToPassport'));
                            setUploadProgress(40);

                            const mealName = getTranslatedFoodName(predictions[selectedPredictionIndex].className);
                            const meal = {
                              id: Date.now(),
                              timestamp: new Date().toISOString(),
                              foodName: mealName,
                              calories: nutritionData.calories,
                              healthScore: nutritionData.healthScore,
                              imageUrl: imagePreview,
                              macros: {
                                protein: nutritionData.protein,
                                carbs:   nutritionData.carbs,
                                fat:     nutritionData.fat,
                                sugar:   (nutritionData as any).sugar   ?? 0,
                                sodium:  (nutritionData as any).sodium  ?? 0,
                                fiber:   (nutritionData as any).fiber   ?? 0,
                              },
                            };
                            
                            try {
                              const existingMeals = safeGetItem<any[]>('meals', []);
                              existingMeals.push(meal);
                              localStorage.setItem('meals', JSON.stringify(existingMeals));
                              
                              setUploadProgress(75);
                              
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
                              
                              if (selectedPredictionIndex !== 0) {
                                const feedback = {
                                  originalPrediction: predictions[0].className,
                                  correctedPrediction: predictions[selectedPredictionIndex].className,
                                  timestamp: Date.now()
                                };
                                const existingFeedback = safeGetItem<any[]>('aiFeedback', []);
                                existingFeedback.push(feedback);
                                localStorage.setItem('aiFeedback', JSON.stringify(existingFeedback));
                              }
                              window.dispatchEvent(new Event('healthDataUpdated'));
                              
                              setUploadProgress(100);
                              setUploadStatus('success');
                              setStatusMessage(t('food.stMealSaved'));
                              
                              setTimeout(() => {
                                if (onSuccess) onSuccess();
                                else onClose();
                              }, 1200);
                            } catch (error) {
                              console.error('Failed to sync meal to API', error);
                              window.dispatchEvent(new Event('healthDataUpdated'));
                              setUploadProgress(100);
                              setUploadStatus('success');
                              setStatusMessage(t('food.stMealSavedOffline'));
                              setTimeout(() => {
                                if (onSuccess) onSuccess();
                                else onClose();
                              }, 1200);
                            }
                          }}
                          aria-label={t('food.logMeal')}
                        >
                          {uploadStatus === 'uploading' ? (
                            <>
                              <LuLoader className="btn-icon animate-spin" />
                              <span>{t('food.savingBtn')}</span>
                            </>
                          ) : (
                            <>
                              <LuCheck className="btn-icon" />
                              <span>{t('food.logMeal')}</span>
                            </>
                          )}
                        </button>

                        <button 
                          className="health-btn-secondary retake-btn-clean"
                          disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                          onClick={handleRetry}
                        >
                          <LuRefreshCw className="btn-icon" />
                          <span>{t('food.retakeOrChoose')}</span>
                        </button>
                      </div>
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
