import { IsDateString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateSleepDto {
  @IsOptional()
  @IsDateString()
  bedtime?: string;

  @IsOptional()
  @IsDateString()
  waketime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  quality?: number;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
