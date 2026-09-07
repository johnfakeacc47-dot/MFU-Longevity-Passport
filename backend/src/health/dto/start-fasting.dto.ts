import { IsDateString, IsOptional, IsString } from 'class-validator';

export class StartFastingDto {
  @IsOptional()
  @IsString()
  protocol?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;
}
