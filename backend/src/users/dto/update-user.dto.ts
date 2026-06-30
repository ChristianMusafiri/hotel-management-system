import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @IsNumber()
    @IsOptional()
    @Min(0, { message: "La limite de crédit ne peut pas être négative." })
    staffCreditLimit?: number; // Permet la modification du plafond
}
