import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseStatus, FundRequestStatus, MovementType } from '@prisma/client';
import { CreatePurchaseRequestDto, GateSecurityValidationDto } from './dto/purchase-request.dto';
// import { CreateLossDto } from './dto/stock-movement.dto';

@Injectable()
export class PurchaseRequestService {
    constructor(private readonly prisma: PrismaService) {}

    // =========================================================================
    // ETAPE 1 : INITIALISATION DE LA DEMANDE D'ACHAT (Par l'économe / dépôt)
    // =========================================================================
    async createRequest(userId: number, hotelId: number, dto: CreatePurchaseRequestDto) {
        if (!dto.items || dto.items.length === 0) {
            throw new BadRequestException("La demande doit contenir au moins un article.");
        }

        const reference = `REQ-${Math.floor(100 + Math.random() * 900)}-${Date.now()}`;

        return this.prisma.purchaseRequest.create({
            data: {
                reference,
                status: PurchaseStatus.PENDING_MGR_REVIEW,
                hotelId,
                requestedById: userId,
                posId: dto.posId || null, // Le POS qui exprime le besoin (ex: Bar)
                items: {
                    create: dto.items.map(item => ({
                        hotelId: hotelId,
                        productId: item.productId,
                        quantityOrdered: item.quantityOrdered,
                        estimatedPrice: item.estimatedPrice, // Prix estimé au départ
                        quantityReceived: 0
                    }))
                }
            },
            include: { items: { include: { product: true } } }
        });
    }

    // =========================================================================
    // ETAPE 2 : NEGOCIATION & VERROUILLAGE DES PRIX (Manager / HOD)
    // =========================================================================
    async managerValidationAndLock(
        requestId: number,
        hotelId: number,
        body: {
            adjustedItems: { itemId: number; quantityOrdered: number; finalPricePaid: number }[]
        }
    ) {
        // 1. Récupérer la réquisition et son hôtel pour inspecter l'abonnement SaaS
        const request = await this.prisma.purchaseRequest.findFirst({
            where: { id: requestId, hotelId },
            include: { hotel: true }
        });

        if (!request) throw new NotFoundException("Réquisition introuvable pour cet hôtel.");
        if (request.status !== PurchaseStatus.PENDING_MGR_REVIEW) {
            throw new BadRequestException("Cette demande a déjà été verrouillée ou traitée par le management.");
        }

        return this.prisma.$transaction(async (tx) => {
            // 2. Fixer et verrouiller les prix réels négociés avec le fournisseur
            for (const adj of body.adjustedItems) {
                await tx.purchaseOrderItem.updateMany({
                    where: { id: adj.itemId, requestId: requestId },
                    data: {
                        quantityOrdered: adj.quantityOrdered,
                        finalPricePaid: adj.finalPricePaid // Le prix ferme négocié
                    }
                });
            }

            // 3. Routage selon l'activation de l'option Premium du Boss
            let nextStatus: PurchaseStatus = PurchaseStatus.VERIFIED_REQUISITION; // Reste en attente du Boss

            if (!request.hotel.isBossApprovalRequired) {
                // Mode Standard (Sans Boss) : Saute l'étape du Boss, va direct à la caisse !
                nextStatus = PurchaseStatus.READY_FOR_CASH;
            }

            return tx.purchaseRequest.update({
                where: { id: requestId },
                data: { status: nextStatus },
                include: { items: true }
            });
        });
    }

    // =========================================================================
    // ETAPE 3 : REGROUPEMENT EN DEMANDE DE FONDS (Manager -> Pour le Boss Premium)
    // =========================================================================
    async createFundRequest(hotelId: number, purchaseRequestIds: number[], notes?: string) {
        const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
        if (!hotel?.isBossApprovalRequired) {
            throw new BadRequestException("Votre abonnement standard ne nécessite pas de validation du propriétaire.");
        }

        // Récupérer tous les items des réquisitions sélectionnées pour calculer le montant exact négocié
        const items = await this.prisma.purchaseOrderItem.findMany({
            where: { 
                requestId: { in: purchaseRequestIds },
                request: { hotelId, status: PurchaseStatus.VERIFIED_REQUISITION }
            }
        });

        if (items.length === 0) {
            throw new BadRequestException("Aucune réquisition valide ou vérifiée n'a été sélectionnée.");
        }

        // Somme des (Quantités validées * Prix négociés)
        const totalAmount = items.reduce((sum, item) => 
            { 
                const qtyOrdAsNum = Number(item.quantityOrdered || 0);
                const priceAsNum = Number(item.finalPricePaid || item.estimatedPrice || 0) 
                
                return sum + (qtyOrdAsNum * priceAsNum)

        }, 0);
        const code = `DF N°: ${Math.floor(100 + Math.random() * 900)}  DATE: ${Date.now()}`;

        return this.prisma.$transaction(async (tx) => {
            // 1. Création de la enveloppe globale pour le Boss
            const fundRequest = await tx.fundRequest.create({
                data: { code, totalAmount, hotelId, notes, status: FundRequestStatus.PENDING_CEO}
            });

            // 2. Basculer les réquisitions incluses sous le contrôle du Boss
            await tx.purchaseRequest.updateMany({
                where: { id: { in: purchaseRequestIds }, hotelId, status: PurchaseStatus.VERIFIED_REQUISITION },
                data: { 
                    fundRequestId: fundRequest.id,
                    status: PurchaseStatus.IN_FUND_REQUEST
                }
            });

            return fundRequest;
        });
    }

    // =========================================================================
    // ETAPE 4 : L'APPROBATION DE LA DEMANDE DE FONDS (Par le Boss / Admin Premium)
    // =========================================================================
    async bossFundApproval(
        fundRequestId: number, 
        hotelId: number, 
        userId: number, 
        action: 'APPROVE' | 'REJECT', 
        excludePurchaseRequestIds?: number[]
    ) {
        // Vérification stricte du rôle Admin/Propriétaire
        const userWithRoles = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } }
        });
        const isAdmin = userWithRoles?.roles.some(ur => ur.role.name === 'ADMIN' || ur.role.name === 'CEO');
        if (!isAdmin) throw new ForbiddenException("Seul le propriétaire peut arbitrer les demandes de fonds.");

        const fundRequest = await this.prisma.fundRequest.findFirst({
            where: { id: fundRequestId, hotelId },
            include: { purchaseRequests: { include: { items: true } } }
        });

        if (!fundRequest || fundRequest.status !== FundRequestStatus.PENDING_CEO) {
            throw new BadRequestException("Demande de fonds introuvable ou déjà traitée.");
        }

        return this.prisma.$transaction(async (tx) => {
            // rejet total de l'enveloppe
            if (action === 'REJECT') {
                await tx.fundRequest.update({ 
                    where: { id: fundRequestId }, 
                    data: { status: FundRequestStatus.REJECTED } 
                });
                // En cas de rejet, les réquisitions retournent chez le manager pour correction/renégociation
                await tx.purchaseRequest.updateMany({
                    where: { fundRequestId },
                    data: { status: PurchaseStatus.VERIFIED_REQUISITION, fundRequestId: null } // On les détache de cette enveloppe rejetée
                });
                return { message: "Demande de fonds entièrement rejetée et renvoyée au management." };
            }

            // APPROBATION (AVEC OU SANS EXCLUSIONS)

            let finalApprovedAmount = Number(fundRequest.totalAmount);
            let excludedInfoMessage = "";

            // Si le Boss a sélectionné des réquisitions à exclure
            if (excludePurchaseRequestIds && excludePurchaseRequestIds.length > 0) {

                // Sécurité : Vérifier que tous les IDs soumis pour exclusion font bien partie de cette enveloppe
                const actualLinkedIds = fundRequest.purchaseRequests.map(pr => pr.id);
                const hasInvalidId = excludePurchaseRequestIds.some(id => !actualLinkedIds.includes(id));
                if (hasInvalidId) {
                    throw new BadRequestException("Certaines réquisitions demandées pour exclusion n'appartiennent pas à cette demande de fonds.");
                }
                
                // Vérifier que les réquisitions à exclure appartiennent bien à cette demande de fonds
                const validExclusions = fundRequest.purchaseRequests.filter(pr => 
                    excludePurchaseRequestIds.includes(pr.id)
                );

                if (validExclusions.length === fundRequest.purchaseRequests.length) {
                    throw new BadRequestException("Vous ne pouvez pas exclure toutes les réquisitions d'une approbation. Faites un 'REJECT' global à la place.");
                }

                if (validExclusions.length > 0) {
                    const excludedIds = validExclusions.map(pr => pr.id);

                    // Sortir ces réquisitions de l'enveloppe et les renvoyer au manager (statut VERIFIED_REQUISITION)
                    await tx.purchaseRequest.updateMany({
                        where: { id: { in: excludedIds } },
                        data: { 
                            status: PurchaseStatus.VERIFIED_REQUISITION,
                            fundRequestId: null // Détachement de l'enveloppe
                        }
                    });

                    // Recalculer le montant des éléments rejetés pour le déduire du total
                    let totalToDeduct = 0;
                    for (const pr of validExclusions) {
                        const prAmount = pr.items.reduce((sum, item) => { 
                            const qtyOrdAsNum = Number(item.quantityOrdered || 0);
                            const priceAsNum = Number(item.finalPricePaid || item.estimatedPrice || 0);
                            return sum + (qtyOrdAsNum * priceAsNum);
                        },0);
                        totalToDeduct += prAmount;
                    }

                    finalApprovedAmount = Number(fundRequest.totalAmount) - totalToDeduct;
                    excludedInfoMessage = ` (${validExclusions.length} réquisition(s) exclue(s) renvoyée(s) au management, ${totalToDeduct.toFixed(2)}$ déduits)`;
                }
            }

            // Si Approuvé : L'enveloppe passe au vert, et TOUTES les réquisitions liées s'ouvrent pour le caissier
            await tx.fundRequest.update({ 
                where: { id: fundRequestId }, 
                data: { status: FundRequestStatus.APPROVED, totalAmount: finalApprovedAmount} 
            });
            // le requisitions restantes passent au status Ready for cash
            await tx.purchaseRequest.updateMany({
                where: { fundRequestId: fundRequestId, status: PurchaseStatus.IN_FUND_REQUEST },
                data: { status: PurchaseStatus.READY_FOR_CASH }
            });

            return { 
                message: `Demande de fonds approuvée avec Succes ${excludedInfoMessage}. Montant disponible pour décaissement à la caisse.`,
                totalBudgetApproved: finalApprovedAmount,
                status: FundRequestStatus.APPROVED
            };
        });
    }

    // =========================================================================
    // ETAPE 5 : MISE À JOUR DE LA CAISSE (Simulation du décaissement pour débloquer la suite)
    // =========================================================================
    async simulateDisbursement(requestId: number, hotelId: number) {
        const request = await this.prisma.purchaseRequest.findFirst({
            where: { id: requestId, hotelId }
        });

        if (!request || request.status !== PurchaseStatus.READY_FOR_CASH) {
            throw new BadRequestException("Cette réquisition n'est pas prête pour le décaissement.");
        }

        return this.prisma.purchaseRequest.update({
            where: { id: requestId },
            data: { status: PurchaseStatus.DISBURSED } // L'argent est sorti ! Le magasin peut recevoir.
        });
    }

    // =========================================================================
    // ETAPE 6 : RECEPTION ET AUDIT AU GRAND MAGASIN ,  RESTRUCTURATION PAR LOTS
    // =========================================================================
    async gateAndStoreKeeperValidation(
        requestId: number,
        hotelId: number,
        gateKeeperName: string,
        dto: GateSecurityValidationDto
    ) {
        const request = await this.prisma.purchaseRequest.findFirst({
            where: { id: requestId, hotelId },
            include: { items: { include: { product: true } } }
        });

        if (!request) throw new NotFoundException("Demande d'achat introuvable.");
        if (request.status !== PurchaseStatus.DISBURSED) {
            throw new BadRequestException("Impossible de réceptionner : les fonds n'ont pas encore été décaissés par la caisse.");
        }

        let financialDiscrepancyToReturn = 0;

        const updatedRequest = await this.prisma.$transaction(async (tx) => {
            // Log de contrôle de sécurité à la guérite
            await tx.securityGateLog.create({
                data: {
                    hotelId: hotelId,
                    requestId,
                    verifiedBy: gateKeeperName,
                    gateNotes: dto.gateNotes
                }
            });

            // Traitement des articles et injection comptable obligatoirement au GRAND MAGASIN
            for (const itemInput of dto.receivedItems) {
                const dbItem = request.items.find(i => i.id === itemInput.itemId);
                if (!dbItem) throw new BadRequestException(`L'article spécifié (ID ${itemInput.itemId}) n'appartient pas à cette commande.`);

                // Sauvegarde de la quantité réelle constatée par le Storekeeper
                await tx.purchaseOrderItem.update({
                    where: { id: itemInput.itemId },
                    data: { quantityReceived: itemInput.quantityReceived }
                });

                // Calcul de l'écart financier (Basé sur le prix négocié validé)
                const effectivePrice = Number(dbItem.finalPricePaid || dbItem.estimatedPrice || 0);
                const qtyOrdAsNum = Number(dbItem.quantityOrdered || 0);
                if (itemInput.quantityReceived < qtyOrdAsNum) {
                    const missingQty = qtyOrdAsNum - itemInput.quantityReceived;
                    financialDiscrepancyToReturn += missingQty * effectivePrice;
                }

                // INJECTION DANS LE STOCK(PAR LOTS) : Toujours au Grand Magasin central (posId: null)
                if (itemInput.quantityReceived > 0 && !dbItem.product.isService) {

                    const currentStock = await tx.stock.findFirst({
                        where: {
                                productId: dbItem.productId,
                                posId: null,
                                hotelId: hotelId
                        }
                    });
                    let stockId: number;

                    if (currentStock) {
                        const updatedStock = await tx.stock.update({
                            where: { id: currentStock.id },
                            data: { quantity: Number(currentStock.quantity || 0) + itemInput.quantityReceived }
                        });
                        stockId = updatedStock.id;
                    } else {
                        const newStock = await tx.stock.create({
                            data: {
                                productId: dbItem.productId,
                                posId: null,
                                hotelId: hotelId,
                                quantity: itemInput.quantityReceived
                            }
                        });
                        stockId = newStock.id;
                    }

                    // Création du lot de stock distinct pour tracer l'expiration
                    await tx.stockBatch.create({
                        data: {
                            stockId: stockId, // Use of stockId garanti instead of currentStock.id qui peut être null
                            quantity: itemInput.quantityReceived,
                            expiryDate: itemInput['expiryDate'] ? new Date(itemInput['expiryDate']) : null //
                        }
                    });

                    // Enregistrement de la fiche de mouvement pour l'audit central
                    await tx.stockMovement.create({
                        data: {
                            hotelId: request.hotelId,
                            productId: dbItem.productId,
                            quantity: itemInput.quantityReceived,
                            type: MovementType.PURCHASE,
                            from: `Fournisseur via Réf: ${request.reference}`,
                            to: "GENERAL STORE (Entrée GRN)",
                            reason: `Vérifié et validé par le Storekeeper. Guérite : ${dto.gateNotes}`,
                            userId: request.requestedById
                        }
                    });
                }
            }

            // Définition du statut final selon l'exactitude de la livraison
            const isPartial = dto.receivedItems.some(i => {
                const dbItem = request.items.find(di => di.id === i.itemId);
                return dbItem && i.quantityReceived < Number(dbItem.quantityOrdered);
            });

            const finalStatus = isPartial ? PurchaseStatus.PARTIALLY_RECEIVED : PurchaseStatus.RECEIVED;

            return tx.purchaseRequest.update({
                where: { id: requestId },
                data: { status: finalStatus },
                include: { items: true }
            });
        });

        return {
            message: "Marchandises réceptionnées et stockées au GENERAL STORE avec succès.",
            status: updatedRequest.status,
            financialDiscrepancyToReturn,
            actionRequired: financialDiscrepancyToReturn > 0 
                ? `⚠️ Alerte Audit : Le responsable d'Achat doit retourner ${financialDiscrepancyToReturn.toFixed(2)}$ à la caisse (Écart de livraison).`
                : "Livraison 100% conforme."
        };
    }

    // =========================================================================
    // INTERFACE DE LA CAISSE (Point de convergence universel)
    // =========================================================================
    async getRequestsReadyForDisbursement(hotelId: number) {
        return this.prisma.purchaseRequest.findMany({
            where: {
                hotelId,
                status: PurchaseStatus.READY_FOR_CASH
            },
            include: { items: { include: { product: true } }, requestedBy: true }
        });
    }
    
}