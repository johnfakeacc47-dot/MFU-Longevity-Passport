// Food Classes - 10 Classes (English labels, snake_case)
// These must match the exact class folder names used in training

export const THAI_FOOD_CLASSES = [
  'pad_thai',
  'khao_man_gai',
  'green_curry',
  'fried_rice',
  'papaya_salad',
  'basil_stir_fry',
  'khao_soi',
  'larb_moo',
  'tom_yum_goong',
  'omelet_rice',
];

// Nutritional information for all 10 food classes
export const FOOD_NUTRITION: { [key: string]: { calories: number; protein: number; carbs: number; fat: number } } = {
  pad_thai: { calories: 400, protein: 12, carbs: 50, fat: 18 },
  khao_man_gai: { calories: 350, protein: 25, carbs: 45, fat: 12 },
  green_curry: { calories: 300, protein: 20, carbs: 15, fat: 20 },
  fried_rice: { calories: 380, protein: 14, carbs: 52, fat: 16 },
  papaya_salad: { calories: 120, protein: 8, carbs: 15, fat: 4 },
  basil_stir_fry: { calories: 280, protein: 22, carbs: 12, fat: 18 },
  khao_soi: { calories: 420, protein: 18, carbs: 55, fat: 14 },
  larb_moo: { calories: 240, protein: 28, carbs: 8, fat: 12 },
  tom_yum_goong: { calories: 180, protein: 24, carbs: 10, fat: 6 },
  omelet_rice: { calories: 450, protein: 16, carbs: 58, fat: 16 },
};
