import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class ValidateAdminAndTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  adminUsername: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  adminPassword: string;
}
