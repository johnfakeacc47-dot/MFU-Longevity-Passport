import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSelfDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
