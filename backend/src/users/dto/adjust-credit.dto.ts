import { IsNotEmpty, IsNumber, IsString, Min, Length } from 'class-validator';

export class AdjustStaffBalanceDto {
  @IsNumber()
  @Min(0.01, { message: "Le montant du remboursement doit être supérieur à 0." })
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @Length(10, 500, { message: "La justification d'audit doit faire entre 10 et 500 caractères." })
  reason!: string; //ex "Retenue sur salaire Juin 2026", "Remboursement cash reçu par la caisse",.

  @IsString()
  @IsNotEmpty()
  validatedBy!: string; // Nom ou identifiant de l'administrateur/comptable qui fait l'action
}