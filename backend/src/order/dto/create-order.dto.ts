import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from "class-validator";
import { Type } from "class-transformer";

// need to valider la structure commande contenant plusieurs articles(OrderItem)
export class OrderItemDto {
    @IsNumber()
    @IsNotEmpty()
    productId!: number

    @IsNumber()
    @Min(1, { message: "La quantité doit etre superieure ou egale à  1." })
    quantity!: number

    @IsNumber()
    @Min(0)
    price!: number; // historisation du prix au moment de la vente
}

export class CreateOrderDto {
    @IsString()
    @IsOptional()
    tableName?: string; // Optionnel (ex: Table5,...)

    @IsNumber()
    @IsNotEmpty()
    posId!: number

    @IsNumber()
    @IsNotEmpty()
    shiftId!: number

    @IsNumber()
    @IsNotEmpty()
    paymentMethodId!: number

    @IsNumber()
    @IsOptional()
    folioId!: number; // si la facture est imputé à la chambre

    //discount lors de la ceation ou de lencaissement
    @IsNumber()
    @IsOptional()
    @Min(0)
    discountAmount?: number;


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items!: OrderItemDto[];
}