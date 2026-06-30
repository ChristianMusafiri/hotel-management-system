import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateLossDto {
    @IsNotEmpty()
    @IsNumber()
    productId!: number;

    @IsNotEmpty()
    @IsNumber()
    @Min(1, { message: "La quantité jetée ou cassée doit être au moins de 1."})
    quantity!: number;

    @IsOptional()
    @IsNumber()
    posId?: number;   // si null , la perte vient du depot general(GS)

    @IsNotEmpty()
    @IsString()
    reason!: string;  //ex: cassée par le barman; date de peremption depassée
}
// fnct evoyé par le front-end dans leDTo(i hoe so)
export class ReconcileMixedBatchesDto {
  @IsNotEmpty()
  @IsNumber()
  productId!: number;

  @IsOptional() // null si c'est le magasin général
  @IsNumber()
  posId!: number | null;

  @IsNotEmpty()
  @IsString()
  expiredBatchExpiry!: string;

  @IsNotEmpty()
  @IsNumber()
  realQuantityLeft!: number;

  @IsNotEmpty()
  @IsNumber()
  correctBatchId!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}