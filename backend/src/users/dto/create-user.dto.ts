import { IsEmail, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom complet est obligatoire." })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: "L'identifiant (nom d'utilisateur) est obligatoire." })
  username!: string;

  @IsEmail({}, { message: "L'adresse email n'est pas valide." })
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty({ message: "Le mot de passe est obligatoire." })
  password!: string;

  @IsNumber()
  @IsOptional()
  @Min(0, { message: "La limite de crédit ne peut pas être négative." })
  staffCreditLimit?: number; // Limite optionnelle à la création

  @IsNumber()
  @IsNotEmpty({ message: "Le hotelId est obligatoire." })
  hotelId!: number;
}