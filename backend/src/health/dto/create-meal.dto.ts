export class CreateMealDto {
  name: string;
  portionSize?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  imageUrl?: string;
  confidence?: number;
  healthScore?: number;
  timestamp?: string;
}
