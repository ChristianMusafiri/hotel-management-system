import { IsNotEmpty, MinLength, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "Nom d'utilisateur requis!"})
  username!: string;

  @IsNotEmpty()
  @MinLength(6,{ message: "Mot de passe trop court"})
  password!: string;
}