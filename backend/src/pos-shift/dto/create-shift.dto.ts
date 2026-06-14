import { IsNumber, IsPositive, Min } from 'class-validator';

export class CreateShiftDto {
    @IsNumber()
    posId!: number;

    @IsNumber()
    @Min(0, {message: 'Le fond de caisse initial ne peut pas être négatif.'})
    initialFloat!: number;
}