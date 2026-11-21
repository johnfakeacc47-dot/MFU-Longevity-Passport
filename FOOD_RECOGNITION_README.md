# Thai Food Recognition - Setup Guide

## ✅ Completed Steps

1. **TensorFlow.js installed** - The package is ready to use
2. **Model files placed** - Your trained model should be in `/public/model/`
3. **Food Recognition component created** - Full UI with camera and upload functionality
4. **Integrated into Home page** - Click "ถ่ายรูปอาหาร" button to use

## 📁 File Structure

```
MFU Longevity Passport/
├── public/
│   └── model/
│       ├── model.json              ✅ (Place your model here)
│       ├── group1-shard1of3.bin    ✅ (Place your model here)
│       ├── group1-shard2of3.bin    ✅ (Place your model here)
│       └── group1-shard3of3.bin    ✅ (Place your model here)
├── src/
│   ├── components/
│   │   └── FoodRecognition.tsx     ✅ Created
│   ├── config/
│   │   └── foodClasses.ts          ✅ Created (Update with your classes)
│   ├── styles/
│   │   └── FoodRecognition.css     ✅ Created
│   └── pages/
│       └── Home.tsx                 ✅ Updated
```

## ⚙️ Configuration

### Update Food Classes
Edit `/src/config/foodClasses.ts` and replace the array with your actual trained food classes:

```typescript
export const THAI_FOOD_CLASSES = [
  'Your Food Class 1',
  'Your Food Class 2',
  'Your Food Class 3',
  // ... add all your classes in the exact order from training
];
```

## 🎯 Features

- **📷 Camera Capture** - Take photos directly from the app
- **🖼️ Upload Images** - Select images from gallery
- **🤖 Real-time Recognition** - Uses your trained MobileNetV2 model
- **📊 Confidence Scores** - Shows top 3 predictions with percentages
- **💾 Save Data** - Button to save food log (ready to implement)

## 🚀 How to Use

1. Start the development server: `npm run dev`
2. Navigate to Home page
3. Click "ถ่ายรูปอาหาร" button
4. Choose to capture photo or upload image
5. See predictions with confidence scores

## 🔧 Troubleshooting

### Model not loading
- Verify model files are in `/public/model/` directory
- Check browser console for errors
- Ensure model.json path is correct

### Wrong predictions
- Update `THAI_FOOD_CLASSES` array in `/src/config/foodClasses.ts`
- Ensure class order matches your training data
- Check image preprocessing (currently set for MobileNetV2: 224x224, normalized to [-1, 1])

### Camera not working
- Check browser permissions for camera access
- Use HTTPS in production (camera requires secure context)

## 📝 Next Steps

1. **Update Food Classes** - Add your actual trained food names
2. **Add Nutritional Data** - Complete the `FOOD_NUTRITION` object
3. **Implement Save Function** - Connect to backend/database
4. **Add Food History** - Track user's food intake
5. **Calculate Calories** - Show nutritional information based on predictions

## 🎨 Customization

### Adjust Model Input Size
If your model uses a different input size, update in `FoodRecognition.tsx`:

```typescript
// Change from 224x224 to your size
tensor = tf.image.resizeBilinear(tensor, [YOUR_SIZE, YOUR_SIZE]);
```

### Modify Preprocessing
Update normalization if your model uses different preprocessing:

```typescript
// Current: [-1, 1] for MobileNetV2
tensor = tensor.div(127.5).sub(1);

// Alternative: [0, 1]
tensor = tensor.div(255);
```

## 📱 Mobile Optimization

The component is fully responsive and optimized for mobile devices with:
- Touch-friendly buttons
- Camera access with rear camera preference
- Full-screen modal on mobile
- Optimized image handling

## 🔐 Production Considerations

- Add proper error handling for offline scenarios
- Implement image compression before processing
- Add loading states and better UX feedback
- Consider model caching for faster subsequent loads
- Add analytics to track prediction accuracy
