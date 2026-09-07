/**
 * Health Calculation Utilities
 */

/**
 * Calculates BMI (Body Mass Index)
 * Formula: weight (kg) / [height (m)]^2
 */
export const calculateBMI = (weightKg: number, heightCm: number): number | null => {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
};

/**
 * Gets BMI Category based on WHO standards
 */
export const getBMICategory = (bmi: number): string => {
  if (bmi < 18.5) return 'bmi.underweight';
  if (bmi < 25) return 'bmi.normal';
  if (bmi < 30) return 'bmi.overweight';
  return 'bmi.obese';
};

/**
 * Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
 */
export const calculateBMR = (
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female' | string
): number | null => {
  if (!weightKg || !heightCm || !age) return null;
  
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
};

/**
 * Calculates Daily Calorie Needs (TDEE - Total Daily Energy Expenditure)
 * Using a standard multiplier for light activity (common for students/office workers)
 */
export const calculateDailyCalorieNeeds = (bmr: number): number => {
  const lightActivityMultiplier = 1.375;
  return Math.round(bmr * lightActivityMultiplier);
};

/**
 * Estimates future weight based on caloric deficit/surplus
 * (Very simplified: 7700 kcal = 1kg)
 */
export const estimateFutureWeight = (
  currentWeight: number,
  dailyDeficit: number,
  weeks: number
): number => {
  const totalDeficit = dailyDeficit * 7 * weeks;
  const weightLoss = totalDeficit / 7700;
  return parseFloat((currentWeight - weightLoss).toFixed(1));
};
