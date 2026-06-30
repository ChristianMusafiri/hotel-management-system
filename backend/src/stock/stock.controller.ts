import { Controller, Post, Body, ParseIntPipe, Param, UseGuards, Get, Patch} from '@nestjs/common';
import { PurchaseRequestService } from './purchase-request.service';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

// import (DTOs) pour valider la rq http avant la logic
import { CreatePurchaseRequestDto, GateSecurityValidationDto } from './dto/purchase-request.dto';
import { CreateLossDto, ReconcileMixedBatchesDto } from './dto/stock-movement.dto';

@Controller('stock')
@UseGuards(RolesGuard)
export class StockController {
    constructor(
        private readonly purchaseRequestService: PurchaseRequestService,
        private readonly stockService : StockService
    ) {}

    // Route : Creation de la demande d'achat
    @UseGuards(JwtAuthGuard)
    @Post('purchase-request')
    @Roles('ADMIN', 'MANAGER', 'STOREKEEPER', 'GENERALCASHIER') // Rôles habilités à demander du stock
    async createRequest(
        @GetUser('id') userId: number,
        @GetUser('hotelId') hotelId: number,
        @Body() dto: CreatePurchaseRequestDto
    ) {
        return this.purchaseRequestService.createRequest(userId,hotelId, dto);
    }

    // Route : Validation, ajustement et verrouillage des prix par le Manager
    @UseGuards(JwtAuthGuard)
    @Post('purchase-request/:id/manager-validate')
    @Roles('ADMIN', 'MANAGER')
    async managerValidate(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('hotelId') hotelId: number,
        @Body() body: { adjustedItems: { itemId: number; quantityOrdered: number; finalPricePaid: number }[] }
    ) {
        return this.purchaseRequestService.managerValidationAndLock(id, hotelId, body);
    }

    // Route : Regroupement des réquisitions en Demande de Fonds (Par le Manager)
    @UseGuards(JwtAuthGuard)
    @Post('fund-request')
    @Roles('ADMIN', 'MANAGER')
    async createFundRequest(
        @GetUser('hotelId') hotelId: number,
        @Body() body: { purchaseRequestIds: number[]; notes?: string }
    ) {
        return this.purchaseRequestService.createFundRequest(hotelId, body.purchaseRequestIds, body.notes);
    }

    // Route  : Approbation financière du Boss (Premium Feature)
    @UseGuards(JwtAuthGuard)
    @Post('fund-request/:id/ceo-approval')
    @Roles('ADMIN', 'BOSS')
    async bossFundApproval(
        @Param('id', ParseIntPipe) fundRequestId: number,
        @GetUser('id') userId: number,
        @GetUser('hotelId') hotelId: number,
        @Body() body: { action: 'APPROVE' | 'REJECT'; excludePurchaseRequestIds?: number[] }
    ) {
         return this.purchaseRequestService.bossFundApproval(
            fundRequestId,
            hotelId,
            userId,
            body.action,
            body.excludePurchaseRequestIds
         )
    }

    // VUE CAISSIER : Réquisitions prêtes pour décaissement
    @UseGuards(JwtAuthGuard)
    @Get('ready-for-cash')
    @Roles('ADMIN', 'MANAGER', 'GENERALCASHIER')
    async getReadyForCash(@GetUser('hotelId') hotelId: number) {
        return this.purchaseRequestService.getRequestsReadyForDisbursement(hotelId);
    }

    // Route (INTERMÉDIAIRE) : Simulation du décaissement à la caisse
    @UseGuards(JwtAuthGuard)
    @Post('purchase-request/:id/disburse-simulation')
    @Roles('ADMIN', 'MANAGER', 'GENERALCASHIER')
    async simulateDisbursement(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('hotelId') hotelId: number
    ) {
        return this.purchaseRequestService.simulateDisbursement(id, hotelId);
    }

    // Route : Réception physique au Magasin general (Sécurité & Storekeeper)
    @UseGuards(JwtAuthGuard)
    @Post('purchase-request/:id/gate-validation')
    @Roles('ADMIN', 'SECURITY', 'STOREKEEPER')
    async gateValidation(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('hotelId') hotelId: number,

        @GetUser('name') name: string, // Extraction directe du nom du user connecté si dispo dans le JWT
        @Body() dto: GateSecurityValidationDto
    ) {
        //on recupere le nom de l'utilisateur connecté pour le log de securité
        const gateKeeperName = name || 'Sécurité Guérite';
        return this.purchaseRequestService.gateAndStoreKeeperValidation(id, hotelId, gateKeeperName, dto);
    }

    // ROUTE : Déclarer une Perte / Casse
    @UseGuards(JwtAuthGuard)
    @Roles('ADMIN', 'STOREKEEPER')
    @Post('loss')
    async declareLoss(
        @GetUser('id') userId: number,
        @GetUser('hotelId') hotelId: number,
        @Body() dto: CreateLossDto
    ) {
        return this.stockService.declareLoss(userId, hotelId, dto);
    }

    //Rapprochement / Ajustement après inventaire physique (Correction des écarts)
    // Restreint au Storekeeper et aux Managers
    @Post('reconcile')
    @Roles('ADMIN', 'MANAGER', 'STOREKEEPER')
    async reconcileStock(
        @GetUser('id') userId: number,
        @GetUser('hotelId') hotelId: number,
        @Body() dto: ReconcileMixedBatchesDto
        //{ posId?: number; productId: number; quantityAdjustment: number; reason: string }
    ) {
        return this.stockService.reconcileMixedBatches(userId, hotelId, dto);
    }
    
    // ROUTES
    // ROOUTE : Consulter l'état du stock pour un Point de Vente (POS) spécifique
    @UseGuards(JwtAuthGuard)
    @Get('pos/:posId')
    @Roles('ADMIN', 'MANAGER', 'STOREKEEPER', 'CASHIER', 'WAITER')
    async getPosStock (
        @Param('posId', ParseIntPipe) posId: number,
        @GetUser('hotelId') hotelId: number
    ) {
        return this.stockService.getLiveStockByPos(hotelId, posId)
    }

    //ROUTE : Activer ou Désactiver le Mode Urgence (Ventes négatives autorisées)
      //Restreint strictement à la direction
    @Patch('emergency/:posId')
    @Roles('ADMIN', 'SUPERVISOR')
    async toggleEmergencyMode(
        @Param('posId', ParseIntPipe) posId: number,
        @GetUser('hotelId') hotelId: number,
        @Body('allowEmergency') allowEmergency: boolean
    ) {
        return this.stockService.updateEmergencyMode(hotelId, posId, allowEmergency)
    }
}
