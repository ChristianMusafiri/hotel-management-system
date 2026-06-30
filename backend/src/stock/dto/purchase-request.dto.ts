import { IsArray, IsInt, IsNumber, IsNotEmpty, IsOptional, IsString, Min, ValidateNested, IsPositive } from "class-validator";
import { Type } from "class-transformer";

// DTO pour un article individuel dans la demande d'achat
export class CreatePurchaseItemDto {
    @IsInt()
    @IsNotEmpty()
    productId! : number;

    @IsNumber()
    @IsPositive()
    @Min(1, { message: "La quantité demandée doit être supérieure à 0" })
    quantityOrdered!: number;

    @IsNumber()
    @IsPositive()
    @Min(0.043, { message: "Le prix estimé doit être supérieur à 0." })
    estimatedPrice!: number;
}

// DTO pour la création globale d'une demande d'achat
export class CreatePurchaseRequestDto {
    @IsInt()
    @IsOptional()
    posId?: number;  // Facultatif : si vide, c'est pour le Grand Magasin

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() =>CreatePurchaseItemDto)
    items!: CreatePurchaseItemDto[]
}

// DTO pour la validation de la sécurité à la guérite
export class GateReceivedItemDto {
    @IsInt()
    @IsNotEmpty()
    itemId!: number; // L'ID de la ligne dans PurchaseOrderItem

    @IsNumber()
    @Min(0)
    quantityReceived!: number; // Quantité réellement comptée par la sécurité

    @IsNumber()
    @Min(0)
    finalPricePaid!: number; // Prix réel payé sur facture fournisseur
}

export class GateSecurityValidationDto {
    @IsString()
    @IsNotEmpty()
    gateNotes!: string; // Ex: "Livraison conforme" ou "Manque 2 casiers de Fanta"

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GateReceivedItemDto)
    receivedItems!: GateReceivedItemDto[];
}