// Food Classes - 10 Classes (English labels, snake_case)
//
// ORDER IS LOAD-BEARING. The model's output neuron index N maps to the Nth entry
// here. The model was trained with `image_dataset_from_directory`, which assigns
// labels by sorting the class folder names ALPHABETICALLY, so this array must be
// the alphabetical folder order — NOT a "nice" or grouped order.
// Folder `kao_man_gai` sorts before `khao_soi` ("kao" < "kha"); we display it as
// `khao_man_gai` (matching normalizeModelLabel + foodTranslationMap in
// FoodRecognition.tsx) but it keeps the slot the model gave the kao_man_gai folder.
// Verified 60/60 against E:/Projects/dataset. This list is only the fallback used
// when /model/class_names.json fails to fetch; keep the two in sync.
export const THAI_FOOD_CLASSES = [
  'basil_stir_fry',
  'fried_rice',
  'green_curry',
  'khao_man_gai',
  'khao_soi',
  'larb_moo',
  'omelet_rice',
  'pad_thai',
  'papaya_salad',
  'tom_yum_goong',
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
