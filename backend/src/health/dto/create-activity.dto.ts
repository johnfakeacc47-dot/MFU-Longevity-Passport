import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { ActivityType } from '../../entities/activity.entity';

export class CreateActivityDto {
  @IsEnum(ActivityType)
  type: ActivityType;

  @IsNumber()
  @Min(0)
  duration: number;

  @IsOptional()
  @IsString()
  intensity?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  caloriesBurned?: number;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
