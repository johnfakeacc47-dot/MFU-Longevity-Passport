// Maps a TensorFlow.js model class label to an i18n key so a saved meal shows
// in the user's current language rather than whatever language it was logged in
// (QA-008). AI-engine results have a free-form dish name and no key.

export const FOOD_NAME_KEYS: Record<string, string> = {
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

/** Translate a model class label. Returns the label unchanged if it isn't a known dish. */
export const translateFoodLabel = (label: string, t: (k: string) => string): string => {
  const key = FOOD_NAME_KEYS[label];
  return key ? t(key) : label;
};

/**
 * Display name for a saved meal: prefer the model class key (re-translated on
 * every render); for AI-engine dishes, pick whichever language field matches the
 * current UI language (QA-005 — an AI-recognized dish used to freeze in whatever
 * language it was scanned in, e.g. staying Thai even after switching to English);
 * fall back to the plain stored name for anything older/manually-named.
 */
export const mealDisplayName = (
  meal: { foodKey?: string; foodName?: string; foodNameEn?: string; foodNameTh?: string },
  t: (k: string) => string,
  fallback: string,
  isTh?: boolean,
): string => {
  if (meal.foodKey && FOOD_NAME_KEYS[meal.foodKey]) return t(FOOD_NAME_KEYS[meal.foodKey]);
  if (meal.foodNameEn || meal.foodNameTh) {
    return (isTh ? meal.foodNameTh : meal.foodNameEn) || meal.foodNameEn || meal.foodNameTh || fallback;
  }
  return meal.foodName || fallback;
};
