import { ActivityType } from '../../entities/activity.entity';

export class CreateActivityDto {
  type: ActivityType;
  duration: number;
  intensity?: string;
  caloriesBurned?: number;
  timestamp?: string;
}
