import { IsNotEmpty, MinLength, IsString, IsNumber } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "Nom d'utilisateur requis!"})
  username!: string;

  @IsNotEmpty()
  @MinLength(6,{ message: "Mot de passe trop court"})
  password!: string;

  @IsNumber()
  @IsNotEmpty({ message: "L'identifiant de l'hôtel (hotelId) est requis pour l'authentification." })
  hotelId!: number;
}