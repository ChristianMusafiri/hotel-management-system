import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreatePosDto {
    @IsString()
    @IsNotEmpty({ message: "Le nom du Point de Vente est obligatoire" })
    name!: string;
    
    @IsString()
    @IsOptional()
    type?: string;  // STANDARD, SERVICE
}