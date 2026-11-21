import React, { useState, useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { X, Cpu, Cloud, Image as ImageIcon, SwitchCamera, RefreshCw, ChevronLeft, Info, Check, Plus, Minus, Leaf, Sparkle, BadgeAlert } from 'lucide-react';

import { THAI_FOOD_CLASSES } from '../config/foodClasses';
import { useLanguage } from '../contexts/LanguageContext';
import { healthApi } from '../services/healthApi';
import { recognizeFoodWithAi, downscaleForStorage, FoodAiError, type AiFoodResult } from '../services/foodAiApi';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import { translateFoodLabel, FOOD_NAME_KEYS } from '../utils/foodNames';
import { IconBtn, IconChip, Chip, Segmented, ICON_PROPS } from './v2';

type RecognitionEngine = 'local' | 'ai';
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Default meal slot from the time of day (Bangkok users: local clock is fine). */
const defaultSlot = (): MealSlot => {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
};
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
  const [, setIsEditingPrediction] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [servings, setServings] = useState<number>(1);
  const [mealSlot, setMealSlot] = useState<MealSlot>(defaultSlot);
  const [engine, setEngine] = useState<RecognitionEngine>(() =>
    safeGetItem<RecognitionEngine>(ENGINE_KEY, 'local') === 'ai' ? 'ai' : 'local',
  );
  const [aiResult, setAiResult] = useState<AiFoodResult | null>(null);
  // Set once a meal has been written so a second tap on "Log meal" (during the
  // 1.2 s success pause before the modal closes) can't save a duplicate.
  const [mealLogged, setMealLogged] = useState<boolean>(false);
  const savingRef = useRef(false);
  // Flipped when the user closes the modal (or it unmounts) so an in-flight
  // recognition result is dropped instead of calling setState on a dead modal.
  const cancelledRef = useRef(false);
  const engineRef = useRef<RecognitionEngine>('local');
  const { t } = useLanguage();

  const chooseEngine = (next: RecognitionEngine) => {
    engineRef.current = next;
    setEngine(next);
    try { localStorage.setItem(ENGINE_KEY, next); } catch { /* storage unavailable */ }
  };
  engineRef.current = engine;

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };
  useEffect(() => () => { cancelledRef.current = true; }, []);

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
  ];

  // Model class label → localized dish name (shared with the eating history so a
  // saved meal re-translates per language — see src/utils/foodNames.ts).
  const getTranslatedFoodName = (label: string): string => translateFoodLabel(label, t);

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
      // The user may already have tapped "Use AI instead" while we were loading.
      if (engineRef.current === 'local' && !cancelledRef.current) {
        setUploadStatus('error');
        setErrorMessage(t('food.errModelSwitchedToAi'));
        chooseEngine('ai');
      }
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
      // Technical detail goes to the console only — the user sees a localized line.
      console.error('Error during prediction:', error);
      if (cancelledRef.current) return;
      setUploadStatus('error');
      setErrorMessage(t('food.stCannotAnalyze').replace(/[:：]\s*$/, ''));
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
      if (cancelledRef.current) return; // modal was closed mid-flight — drop the result
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
      console.error('AI recognition failed:', err);
      if (cancelledRef.current) return;
      const code = err instanceof FoodAiError ? err.code : 'server';
      const msg =
        code === 'offline' ? t('food.errAiOffline')
        : code === 'not_signed_in' ? t('food.errAiNotSignedIn')
        : code === 'timeout' ? t('food.stAiCannot')
        : code === 'quota' ? t('ai.quotaReached')
        : t('food.errAiServer');
      setUploadStatus('error');
      setErrorMessage(msg);
    } finally {
      if (!cancelledRef.current) {
        setIsProcessing(false);
        setUploadProgress(100);
      }
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
    // 25MB — well above what a modern phone camera produces (even 48MP raw
    // JPEGs land around 15-20MB). Safe to raise: recognizeFoodWithAi()
    // downscales to <=768px/JPEG-82% before it ever leaves the browser (see
    // src/services/foodAiApi.ts), so the actual upload stays under ~1MB
    // regardless of the source file's size — this cap only exists to avoid
    // reading a truly unreasonable file into memory.
    if (file.size > 25 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage(t('food.stTooLarge'));
      return;
    }

    // Start uploading state
    setUploadStatus('uploading');
    setStatusMessage(t('food.stUploadingPrep'));
    setUploadProgress(20);
    setErrorMessage('');
    setMealLogged(false);
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
    setSelectedPredictionIndex(0);
    setServings(1);
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
      setIsCameraActive(false);
      setUploadStatus('error');
      setErrorMessage(t('food.alertCameraDenied'));
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
    setMealLogged(false);
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
    setSelectedPredictionIndex(0);
    setServings(1);
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
    setMealLogged(false);
    setImagePreview(null);
    setPredictions([]);
    setNutritionData(null);
    setAiResult(null);
  };

  // ── Portion scaling + meal slot (ui_ref2 "ผลการรู้จำอาหาร") ─────────────────
  const scaleBy = (n: number | undefined) => Math.round((n ?? 0) * servings);
  const shown = nutritionData
    ? {
        calories: scaleBy(nutritionData.calories),
        protein: scaleBy(nutritionData.protein),
        carbs: scaleBy(nutritionData.carbs),
        fat: scaleBy(nutritionData.fat),
        sugar: scaleBy(nutritionData.sugar),
        sodium: scaleBy(nutritionData.sodium),
        fiber: scaleBy(nutritionData.fiber),
        healthScore: nutritionData.healthScore,
      }
    : null;
  const SLOTS: { id: MealSlot; label: string }[] = [
    { id: 'breakfast', label: t('v2.slot.breakfast') },
    { id: 'lunch', label: t('v2.slot.lunch') },
    { id: 'dinner', label: t('v2.slot.dinner') },
    { id: 'snack', label: t('v2.slot.snack') },
  ];
  const slotLabel = SLOTS.find((s) => s.id === mealSlot)?.label ?? '';
  const busy = uploadStatus === 'uploading' || uploadStatus === 'processing';
  const hasResult = !isProcessing && predictions.length > 0 && !!shown && !!imagePreview && uploadStatus !== 'error';

  // Same save pipeline as before (local quota guard → health API → offline fallback).
  const logMeal = async () => {
    if (!nutritionData || !shown || predictions.length === 0) return;
    if (uploadStatus === 'uploading' || uploadStatus === 'processing') return; // Prevent double click
    // `uploadStatus === 'success'` is also the state right after recognition, so
    // it can't be the guard — a ref + flag is.
    if (savingRef.current || mealLogged) return;
    savingRef.current = true;

    setUploadStatus('uploading');
    setStatusMessage(t('food.stSavingToPassport'));
    setUploadProgress(40);

    const chosenLabel = predictions[selectedPredictionIndex].className;
    const mealName = getTranslatedFoodName(chosenLabel);
    // Known Thai dish → store the model key so history can re-translate it;
    // AI / free-form names have no key.
    const foodKey = FOOD_NAME_KEYS[chosenLabel] ? chosenLabel : undefined;

    // localStorage's shared per-origin quota can't hold the raw camera photo for
    // more than a couple of meals — store a small thumbnail instead.
    let thumbUrl: string | null = null;
    if (imagePreview) {
      try { thumbUrl = await downscaleForStorage(imagePreview); }
      catch (e) { console.warn('Thumbnail downscale failed, saving meal without image', e); }
    }

    // AI-engine dishes have no foodKey, so carry both languages (QA-005).
    const aiNames = aiResult
      ? { foodNameEn: aiResult.dish || mealName, foodNameTh: aiResult.dishLocal || aiResult.dish || mealName }
      : {};

    const meal = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      foodName: mealName,
      foodKey,
      ...aiNames,
      mealType: mealSlot,
      calories: shown.calories,
      healthScore: shown.healthScore,
      imageUrl: thumbUrl,
      macros: {
        protein: shown.protein,
        carbs: shown.carbs,
        fat: shown.fat,
        sugar: shown.sugar,
        sodium: shown.sodium,
        fiber: shown.fiber,
      },
    };

    // QA-003: check the write explicitly, with one retry that drops the image.
    const existingMeals = safeGetItem<any[]>('meals', []);
    existingMeals.push(meal);
    let mealSaved = safeSetItem('meals', existingMeals);
    if (!mealSaved && thumbUrl) {
      existingMeals[existingMeals.length - 1] = { ...meal, imageUrl: null };
      mealSaved = safeSetItem('meals', existingMeals);
    }
    if (!mealSaved) {
      savingRef.current = false;
      setUploadProgress(100);
      setUploadStatus('error');
      setErrorMessage(t('food.stStorageFull'));
      return;
    }
    setMealLogged(true);

    const finish = (msg: string) => {
      window.dispatchEvent(new Event('healthDataUpdated'));
      setUploadProgress(100);
      setUploadStatus('success');
      setStatusMessage(msg);
      setTimeout(() => {
        if (cancelledRef.current) return;
        if (onSuccess) onSuccess();
        else onClose();
      }, 1200);
    };

    try {
      setUploadProgress(75);
      await healthApi.logMeal({
        name: mealName,
        calories: shown.calories,
        carbs: shown.carbs,
        protein: shown.protein,
        fat: shown.fat,
        healthScore: shown.healthScore,
        imageUrl: meal.imageUrl,
      });

      if (selectedPredictionIndex !== 0) {
        const feedback = {
          originalPrediction: predictions[0].className,
          correctedPrediction: predictions[selectedPredictionIndex].className,
          timestamp: Date.now(),
        };
        const existingFeedback = safeGetItem<any[]>('aiFeedback', []);
        existingFeedback.push(feedback);
        localStorage.setItem('aiFeedback', JSON.stringify(existingFeedback));
      }
      finish(t('food.stMealSaved'));
    } catch (error) {
      console.error('Failed to sync meal to API', error);
      finish(t('food.stMealSavedOffline'));
    }
  };

  const pickPrediction = (idx: number) => {
    setSelectedPredictionIndex(idx);
    setServings(1);
    if (engine === 'local') setNutritionData(estimateNutrition(predictions[idx].className, 100));
  };

  const shutter = () => { if (isCameraActive) capturePhoto(); else void startCamera(); };
  const engineChoice = (v: string) => { if (!busy) chooseEngine(v as RecognitionEngine); };

  const title = hasResult ? t('v2.checkResult') : t('v2.scanFoodTitle');
  const pct = predictions[selectedPredictionIndex]?.probability ?? 0;

  return (
    <div className="v2-fr" role="dialog" aria-modal="true" aria-label={t('food.headerTitle')}>
      <div className="v2-page v2-page--nonav" style={{ minHeight: '100%' }}>
        {/* ── header ── */}
        <header className="v2-header v2-header--center">
          {hasResult
            ? <IconBtn label={t('common.back')} onClick={handleRetry}><ChevronLeft size={22} {...ICON_PROPS} /></IconBtn>
            : <IconBtn label={t('common.close')} onClick={handleClose}><X size={22} {...ICON_PROPS} /></IconBtn>}
          <h1 className="v2-header-title">{title}</h1>
          {hasResult
            ? (
              <IconBtn label={t('food.a11yReidentifyAi')} onClick={() => imagePreview && void runAiRecognition(imagePreview)}>
                <RefreshCw size={20} {...ICON_PROPS} />
              </IconBtn>
            )
            : (
              <IconBtn label={t('food.a11yFlipCamera')} onClick={flipCamera}><SwitchCamera size={20} {...ICON_PROPS} /></IconBtn>
            )}
        </header>

        {isLoading && (
          <div className="v2-empty" style={{ flex: 1 }}>
            <span className="v2-spinner" role="status" aria-label={t('food.loading')} />
            <p className="v2-muted">{t('food.loading')}</p>
            <button type="button" className="v2-btn v2-btn--ghost v2-btn--sm" onClick={() => chooseEngine('ai')}>
              <Cloud size={18} {...ICON_PROPS} /> {t('food.useAiInstead')}
            </button>
          </div>
        )}

        {!isLoading && uploadStatus === 'error' && (
          <div className="v2-empty" style={{ flex: 1 }} role="alert">
            <IconChip pillar="danger" size="lg"><BadgeAlert size={26} {...ICON_PROPS} /></IconChip>
            <h2 className="v2-h2">{t('food.errTitle')}</h2>
            <p className="v2-muted">{errorMessage || t('food.errGeneric')}</p>
            <div className="v2-btn-row" style={{ width: '100%', maxWidth: 360 }}>
              <button type="button" className="v2-btn v2-btn--primary" onClick={handleRetry}><RefreshCw size={18} {...ICON_PROPS} /> {t('food.retryAgain')}</button>
              <button type="button" className="v2-btn v2-btn--ghost" onClick={() => fileInputRef.current?.click()}><ImageIcon size={18} {...ICON_PROPS} /> {t('food.chooseAnother')}</button>
            </div>
          </div>
        )}

        {/* ── capture view ── */}
        {!isLoading && uploadStatus !== 'error' && !hasResult && (
          <>
            <Segmented value={engine} onChange={engineChoice} options={[
              { value: 'local', label: <><Cpu size={18} {...ICON_PROPS} /> {t('v2.onDevice')}</> },
              { value: 'ai', label: <><Cloud size={18} {...ICON_PROPS} /> {t('v2.cloudAi')}</> },
            ]} />

            <div
              className={`v2-scan ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (uploadStatus === 'idle') setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (uploadStatus !== 'idle') return;
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
            >
              {isCameraActive && <video ref={videoRef} autoPlay playsInline muted aria-label={t('food.a11yFoodPhoto')} />}
              {imagePreview && !isCameraActive && <img className="v2-scan-img" src={imagePreview} alt={t('food.a11yFoodPhoto')} />}
              <span className="v2-corner v2-corner--tl" /><span className="v2-corner v2-corner--tr" />
              <span className="v2-corner v2-corner--bl" /><span className="v2-corner v2-corner--br" />
              {!isCameraActive && !imagePreview && uploadStatus === 'idle' && (
                <>
                  <Leaf size={44} {...ICON_PROPS} />
                  <p>{t('v2.placeInFrame')}</p>
                </>
              )}
              {busy && (
                <div className="v2-scan-busy" role="status" aria-live="polite">
                  <span className="v2-spinner" />
                  <b>{uploadStatus === 'uploading' ? t('food.analyzingUploading') : engine === 'ai' ? t('food.analyzingAi') : t('food.analyzingLocal')}</b>
                  {statusMessage && <span>{statusMessage}</span>}
                  <div className="v2-bar" style={{ width: 160 }} role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${uploadProgress > 0 ? uploadProgress : 30}%` }} />
                  </div>
                </div>
              )}
            </div>

            <p className="v2-note"><Info size={18} {...ICON_PROPS} /><span>{engine === 'ai' ? t('food.engineHintAi') : t('food.engineHintLocal')}</span></p>

            <div className="v2-capture-bar">
              <button type="button" className="v2-side-btn" onClick={() => fileInputRef.current?.click()} disabled={busy} aria-label={t('food.selectImage')}>
                <ImageIcon size={24} {...ICON_PROPS} />
              </button>
              <button type="button" className="v2-shutter" onClick={shutter} disabled={busy} aria-label={isCameraActive ? t('food.captureBtn') : t('food.openCamera')}><i /></button>
              {isCameraActive
                ? <button type="button" className="v2-side-btn" onClick={stopCamera} aria-label={t('food.cancel')}><X size={24} {...ICON_PROPS} /></button>
                : <span className="v2-side-btn" style={{ visibility: 'hidden' }} />}
            </div>
          </>
        )}

        {/* ── result view ── */}
        {!isLoading && hasResult && shown && nutritionData && (
          <>
            <div className="v2-photo"><img src={imagePreview as string} alt={t('food.a11yFoodPhoto')} /></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="v2-dish">{getTranslatedFoodName(predictions[selectedPredictionIndex].className)}</h2>
              <p className="v2-meta">
                {engine === 'ai' ? <Cloud size={18} {...ICON_PROPS} /> : <Cpu size={18} {...ICON_PROPS} />}
                <span>{engine === 'ai' ? t('v2.cloudAi') : t('v2.recognisedOnDevice')} · {t('v2.confidence')} {Math.round(pct)}%</span>
              </p>
            </div>

            {predictions.length > 1 && (
              <div className="v2-chips" role="group" aria-label={t('food.pickCorrect')}>
                <span className="v2-muted">{t('food.notThisDish')}</span>
                {predictions
                  .map((p, idx) => ({ p, idx }))
                  .filter(({ idx }) => idx !== selectedPredictionIndex)
                  .slice(0, 2)
                  .map(({ p, idx }) => (
                    <Chip key={idx} onClick={() => pickPrediction(idx)}>{getTranslatedFoodName(p.className)}</Chip>
                  ))}
              </div>
            )}

            {aiResult && (aiResult.servingEstimate || aiResult.healthNotes) && (
              <p className="v2-note"><Sparkle size={18} {...ICON_PROPS} /><span>{[aiResult.servingEstimate, aiResult.healthNotes].filter(Boolean).join(' · ')}</span></p>
            )}

            <section className="v2-group">
              <div className="v2-nutri-head">
                <span>{t('v2.estNutrition')}</span>
                <span className="v2-stepper">
                  <button type="button" className="v2-step-btn" onClick={() => setServings((s) => Math.max(0.5, s - 0.5))} disabled={servings <= 0.5} aria-label={t('v2.fewer')}><Minus size={20} {...ICON_PROPS} /></button>
                  <span className="v2-tnum" style={{ minWidth: 64, textAlign: 'center' }}>{servings} {t('v2.serving')}</span>
                  <button type="button" className="v2-step-btn" onClick={() => setServings((s) => Math.min(5, s + 0.5))} disabled={servings >= 5} aria-label={t('v2.more')}><Plus size={20} {...ICON_PROPS} /></button>
                </span>
              </div>
              <div className="v2-nutri">
                <div><span>{t('v2.energy')}</span><b>~{shown.calories}</b><span>kcal</span></div>
                <div><span>{t('food.macroProtein')}</span><b>~{shown.protein}</b><span>{t('v2.gram')}</span></div>
                <div><span>{t('food.macroCarbs')}</span><b>~{shown.carbs}</b><span>{t('v2.gram')}</span></div>
                <div><span>{t('food.macroFat')}</span><b>~{shown.fat}</b><span>{t('v2.gram')}</span></div>
              </div>
            </section>

            <div className="v2-field">
              <span className="v2-label">{t('v2.saveAsMeal')}</span>
              <div className="v2-chips" role="group" aria-label={t('v2.saveAsMeal')}>
                {SLOTS.map((s) => <Chip key={s.id} on={mealSlot === s.id} onClick={() => setMealSlot(s.id)}>{s.label}</Chip>)}
              </div>
            </div>

            <p className="v2-note"><Info size={18} {...ICON_PROPS} /><span>{t('v2.estimateNote')}</span></p>

            {uploadStatus === 'success' && statusMessage && <p className="v2-alert v2-alert--ok" role="status">{statusMessage}</p>}

            <div className="v2-sticky-cta">
              <button type="button" className="v2-btn v2-btn--primary" disabled={busy || mealLogged} onClick={() => void logMeal()} aria-label={t('food.logMeal')}>
                {uploadStatus === 'uploading'
                  ? <><span className="v2-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> {t('food.savingBtn')}</>
                  : <><Check size={20} {...ICON_PROPS} /> {t('v2.addToSlot')} {slotLabel}</>}
              </button>
            </div>
          </>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload}
          style={{ display: 'none' }} aria-label={t('food.a11yUploadInput')} />
      </div>
    </div>
  );
};
