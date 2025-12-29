import { IsEmail, IsIn, IsString, Length } from 'class-validator';

export class UserRegisterDto {
  @IsString()
  @Length(1, 15)
    name!: string;

  @IsEmail()
    email!: string;

  @IsString()
  @Length(6, 12)
    password!: string;

  @IsIn(['regular', 'pro'])
    type!: 'regular' | 'pro';
}

export class LoginDto {
  @IsEmail()
    email!: string;

  @IsString()
  @Length(6, 12)
    password!: string;
}

export interface UserPublicDto {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  type: 'regular' | 'pro';
}

export interface AuthTokenDto {
  token: string;
}
