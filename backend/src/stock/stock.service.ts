import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType, TransferStatus } from '@prisma/client';
import { CreateLossDto } from './dto/stock-movement.dto';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class StockService {
    constructor(private readonly prisma: PrismaService) {}

     // PERTES ET CASSES (Flux LOSS: Injection du logique FIFO
    async declareLoss(userId: number, hotelId: number, dto: CreateLossDto) {
        // Validations initiales de sécurité sur le DTO
        if (!dto.reason || dto.reason.trim().length < 4) {
            throw new BadRequestException("Un motif explicite et auditable est obligatoire pour déclarer une perte.");
        }

        if (dto.quantity <= 0) {
            throw new BadRequestException("La quantité perdue doit être supérieure à 0.");
        }

        const targetPosId = dto.posId || null;

        return await this.prisma.$transaction(async (tx) => {
            // Vérifier si le produit existe dans cet hôtel
            const product = await tx.product.findFirst({
                where: { id: dto.productId, hotelId }
            });
            if (!product) {
                throw new NotFoundException("Produit introuvable dans cet hôtel.");
            }
            if (product.isService) {
            throw new BadRequestException("Impossible de déclarer une perte sur un produit de type Service.");
            }

            // Trouver la ligne de stock correspondante
            const currentStock = await tx.stock.findFirst({
                where: {
                    productId: dto.productId,
                    posId: targetPosId,
                    hotelId
                }
            });

            // Conversion stricte du Decimal avant d'évaluer l'inégalité
            const currentStockQty = currentStock ? Number(currentStock.quantity) : 0;
            // Sécurité : On ne peut pas casser ce qu'on n'a pas
            if (!currentStock || currentStockQty < dto.quantity) {
                throw new BadRequestException(
                    `Stock insuffisant pour déclarer cette perte. Stock actuel : ${currentStock?.quantity || 0}`
                );
            }

            // le moteur FIFO virtuel avec détection des alertes
            const fifoResult = await this.deductStockUsingFIFO(tx, dto.productId, targetPosId, hotelId, dto.quantity);

            // Enregistrer le mouvement de stock pour l'audit (avec le hotelId )
            const emplacement = targetPosId ? `POS ID: ${targetPosId}` : "GENERAL STORE";
            const movement = await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: dto.productId,
                    quantity: -dto.quantity, //negative car cest une sortie seche (comptable)
                    type: MovementType.LOSS, // enum MovementType
                    from: emplacement,
                    to: "POUBELLE / REBUT",
                    reason: dto.reason,
                    userId: userId,
                    costPrice: product.defaultPurchasePrice  // historidation du cout d'achat(pour l'instant)
                }
            });

            return {
                message: "Perte / Casse enregistrée avec succès.",
                movementId: movement.id,
                productId: dto.productId,
                remainingQuantity: Number(fifoResult.updatedStock.quantity),
                location: emplacement,
                alerts: fifoResult.alerts , // Transmis au contrôleur pour déclencher le flash à l'écran !
                financialLossValue: Number(product.defaultPurchasePrice) * dto.quantity
            };
        });
    }

    // LE BARMAN DEMANDE DES ARTICLES
    async createTransferRequest(
        userId: number,
        hotelId: number,
        dto: { productId: number; toPosId: number; quantityRequested: number }
    ) {
        if(dto.quantityRequested <= 0) {
            throw new BadRequestException("La quantité demandée doit être supérieure à 0.")
        }

        const targetPos = await this.prisma.pointOfSale.findFirst({
            where: { id: dto.toPosId, hotelId }
        });
        
        if(!targetPos) { throw new NotFoundException("Point de vente (ciblé) introuvable pour cet établissement."); }

        // Générer une référence unique pour le bon de transfert
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomHex = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, '0').toUpperCase();
        const reference = `TRF-${randomHex}  Date: ${dateStr}`;

        return await this.prisma.stockTransfer.create({
            data: {
                reference,
                status: 'PENDING',  // en attente du storeKeeper
                productId: dto.productId,
                quantityRequested: dto.quantityRequested,
                fromPosId: null, // null = deMANDE AU MAGASIN GENERAL
                toPosId: dto.toPosId,
                createdById: userId,
                hotelId
            },
            include: {
                product: { select: { name: true, code: true } }
            }
        });
    }

    async dispatchTransfer(
        userId: number,
        hotelId: number,
        transferId: number,
        dto: { quantityDispatched: number }
    ) {
        if(dto.quantityDispatched <= 0) { throw new BadRequestException("La quantité expédiée doit être supérieure à 0."); }

        return await this.prisma.$transaction(async (tx) => {
            // Trouver le transfert
            const transfer = await tx.stockTransfer.findFirst({
                where: { id: transferId, hotelId }
            })as any;

            if(!transfer) { throw new NotFoundException("Ordre de transfert introuvable."); }
            if(transfer.status !== 'PENDING') { throw new BadRequestException(`Impossible d'expédier un transfert qui est déjà ${transfer.status}`); }
            
            // Vérifier le stock disponible au Grand Magasin (posId: null)
            const currentStock = await tx.stock.findFirst({
                where: { productId: transfer.productId, posId: null, hotelId }
            });

            const availableQty = currentStock ? Number(currentStock.quantity) : 0;
            if(availableQty < dto.quantityDispatched) {
                throw new BadRequestException(`Stock insuffisant au GENERAL STORE. Disponible : ${availableQty}`);
            }

            // Appeler au moteur FIFO virtuel pour décrémenter le Grand Magasin (posId: null)
            const fifoResult = await this.deductStockUsingFIFO(
                tx,
                transfer.productId,
                null,    //null= General Store
                hotelId,dto.quantityDispatched
            );

            // Récupérer le produit pour capturer le coût d'achat
            const product = await tx.product.findUnique({
                where: { id: transfer.productId }
            });

            // Écriture comptable de SORTIE du Grand Magasin
            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: transfer.productId,
                    quantity: -dto.quantityDispatched,    //nega car ca sort du magasin
                    type: 'TRANSFER',
                    from: "GENERAL STORE",
                    to: `POS_ID_${transfer.toPosId}_TRANSIT`,
                    userId: userId,
                    costPrice: product?.defaultPurchasePrice || 0, // for now
                    transferId: transfer.id
                }
            });

            // Mettre à jour le statut du formulaire de transfert
            const updatedTranfer = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: 'DISPATCHED',
                    quantityDispatched: dto.quantityDispatched,
                    dispatchedById:  userId
                }
            });

            return {
                message: "Marchandise sortie du magasin général et en cours de transit.",
                TransferStatus: updatedTranfer.status,
                quantityDispatched: dto.quantityDispatched,
                alerts: fifoResult.alerts
            };
        });
    }

    // LE BARMAN RECOIT LA MARCHANDISE ET LE STOCK DU BAR/POS AUGMENTE
    async receiveTransfer(
        userId : number,
        hotelId: number,
        transferId: number,
        dto: { quantityReceived: number }
    ) {
        if(dto.quantityReceived < 0) { throw new BadRequestException("La quantité reçue ne peut pas être négative."); }

        return await this.prisma.$transaction(async (tx) => {
            // on récupére le transfert avec les informations du produit
            const transfer = await tx.stockTransfer.findFirst({
                where: { id: transferId, hotelId },
                include: { product: true }
            });

            if(!transfer) throw new NotFoundException("Ordre de transfert introuvable.");
            if(transfer.status !== 'DISPATCHED') {
                throw new BadRequestException(`Impossible de réceptionner un transfert avec le statut : ${transfer.status}`);
            }

            const qtyDispatched = Number(transfer.quantityDispatched);

            // CAS DE LITIGE : Écart entre l'expédition et la réception
            if(dto.quantityReceived !== qtyDispatched) {
                const updatedTranfer = await tx.stockTransfer.update({
                    where: { id: transfer.id },
                    data: { 
                        status: 'CORRECTION_PENDING',
                        quantityReceived: dto.quantityReceived,

                     }
                });

                return {
                    message: `⚠️ LITIGE DÉTECTÉ : Le magasinier a envoyé ${qtyDispatched} mais vous déclarez avoir reçu ${dto.quantityReceived}. Le transfert est bloqué en attente de vérification par un administrateur.`,
                    transferStatus: updatedTranfer.status,
                    isDiscrepancy: true
                };
            }

            // CAS NORMAL :(Les quantités correspondent parfaitement)
            // Mettre à jour ou créer la ligne de stock globale pour le POS cible
            let targetStock = await tx.stock.findFirst({
                where: { productId: transfer.productId, posId: transfer.toPosId, hotelId }
            });

            if(!targetStock) {
                // // Si le produit n'a jamais été envoyé dans ce POS, on initialise la ligne de stock
                targetStock = await tx.stock.create({
                    data: {
                        hotelId,
                        productId: transfer.productId,
                        posId: transfer.toPosId,
                        quantity: dto.quantityReceived
                    }            
                });
            } else {
                // sinon, on incrimente le stoCk exixtant du POS
                targetStock = await tx.stock.update({
                    where: { id: targetStock.id },
                    data: { quantity: { increment: dto.quantityReceived } }
                });
            }

            // on Recrée les lots (StockBatch) au niveau du bar pour le suivi FIFO local
            // On récupère les informations d'expiration d'origine ou on crée un lot générique pour le bar
            await tx.stockBatch.create({
                data: {
                    stockId: targetStock.id,
                    quantity: dto.quantityReceived,
                    // Par défaut 30 jours, ou selon le modèle historique
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });

            // Écriture comptable d'ENTRÉE définitive au POS
            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: transfer.productId,
                    quantity: dto.quantityReceived, // Positif car c'est une entrée au Bar
                    type: 'TRANSFER',
                    from: `GENERAL_STORE_TRANSIT`,
                    to: `POS_ID_${transfer.toPosId}`,
                    userId: userId,
                    costPrice: transfer.product?.defaultPurchasePrice || 0,  // For now 
                    transferId: transfer.id
                }
            });

            // ON Clôture le bon de transfert
            const finalizedTransfer = await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: {
                    status: 'RECEIVED',
                    quantityReceived: dto.quantityReceived,
                    receivedById: userId
                }
            });

            return {
                message: "Stock réceptionné et ajouté au stock du point de vente avec succès.",
                transferStatus: finalizedTransfer.status,
                newPosStockQuantity: Number(targetStock.quantity)
            };
        });
    }

    // =========================================================================
    // AJOUT IMPORTANT LE MANAGER TRANCHE ET CORRIGE L'ÉCART DE STOCK (LITIGE)
    // =========================================================================
    async resolveTransferLitigation(
        userId: number,
        hotelId: number,
        transferId: number,
        dto: { approvedQuantity: number; action: 'ACCEPT_STOREKEEPER_QTY' | 'ACCEPT_BARMAN_QTY'; comment: string }
    ) {
        return await this.prisma.$transaction(async (tx) => {
            const transfer = await tx.stockTransfer.findFirst({
                where: { id: transferId, hotelId },
                include: { product: true }
            });
            if (!transfer || transfer.status !== 'CORRECTION_PENDING') {
                throw new BadRequestException("Aucun litige actif trouvé pour ce transfert.");
            }

            const qtyDispatched = Number(transfer.quantityDispatched); // Ce que le magasin a sorti
            const qtyReceived = Number(transfer.quantityReceived);     // Ce que le bar dit avoir vu
            const product = transfer.product;

            let finalQtyToBar = 0;
            let destinationComptable = "";

            if(dto.action === 'ACCEPT_BARMAN_QTY') {
                // 1. LE BARMAN A RAISON : Il manque de la marchandise. L'erreur est imputée au Storekeeper
                // Le manager valide que le barman a raison (il manque 1 canette par exemple ON 10 EXPECTED, il a recu 9)
                // Le magasin a déjà perdu cette canette lors du DISPATCH
                const manquants = qtyDispatched - qtyReceived;

                finalQtyToBar = qtyReceived;
                destinationComptable = `AUDIT_SUSPENS_STOREKEEPER_ID_${transfer.dispatchedById}`;

                // Enregistrement du litige pour retenue/audit sur le Storekeeper
                await tx.stockMovement.create({
                    data: {
                        hotelId,
                        productId: transfer.productId,
                        quantity: -manquants,
                        type: 'LOSS', // Reste une perte pour le stock physique
                        from: 'GENERAL_STORE_TRANSIT',
                        to: destinationComptable, //  Fléché pour l'audit/salaire du Storekeeper
                        reason: `Litige TRF ${transfer.reference} - Imputé au Storekeeper. Note Admin : ${dto.comment}`,
                        userId,
                        costPrice: product?.defaultPurchasePrice || 0  
                    }
                });
            }else {
                // 2. LE STOREKEEPER A RAISON : Le barman a mal compté ou menti. On force la quantité du magasinier
                finalQtyToBar = qtyDispatched;
                destinationComptable = `POS_ID_${transfer.toPosId}`;

                // On trace l'anomalie du barman pour les auditeurs de caisse
                await tx.stockMovement.create({
                    data: {
                        hotelId,
                        productId: transfer.productId,
                        quantity: 0, // Pas d'impact physique supplémentaire, juste une note de sécurité
                        type: 'INVENTORY_ADJUSTMENT',
                        from: 'SYSTEM_ARBITRATION',
                        to: `AUDIT_SUSPENS_BARMAN_ID_${transfer.createdById}`, // Tracé pour l'audit du Barman
                        reason: `Litige TRF ${transfer.reference} - Barman suspecté de fausse déclaration. Note Admin : ${dto.comment}`,
                        userId,
                        costPrice: 0
                    }
                });
            }

            // Incrémentation du stock au Bar (qu'elle soit partielle ou totale selon l'arbitrage)
            let targetStock = await tx.stock.findFirst({
                where: { productId: transfer.productId, posId: transfer.toPosId, hotelId }
            });

            if (!targetStock) {
                targetStock = await tx.stock.create({
                    data: { hotelId, productId: transfer.productId, posId: transfer.toPosId, quantity: finalQtyToBar }
                });
            } else {
                targetStock = await tx.stock.update({
                    where: { id: targetStock.id },
                    data: { quantity: { increment: finalQtyToBar } }
                });
            }

            // Création du lot pour le Bar
            await tx.stockBatch.create({
                data: { 
                    stockId: targetStock.id, 
                    quantity: finalQtyToBar, 
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // Default 30jours
                }
            });

            // Mouvement de transfert définitif vers le Bar
            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: transfer.productId,
                    quantity: finalQtyToBar,
                    type: 'TRANSFER',
                    from: 'GENERAL_STORE_TRANSIT',
                    to: `POS_ID_${transfer.toPosId}`,
                    userId,
                    costPrice: product?.defaultPurchasePrice || 0,
                    transferId: transfer.id
                }
            });

            // Clôture du transfert
            await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: { status: 'RECEIVED', quantityReceived: finalQtyToBar }
            });

            return { 
                message: "Arbitrage complété avec succès (DIRECTION)",
                finalQuantityDelivered: finalQtyToBar,
                newPosStock: Number(targetStock.quantity)
            };
        })
    }

    //  CORRECTION DU POINT DANGEREUX : INVERSION D'UNE VALIDATION FANTOME (ADMIN ONLY)

    async reverseGhostTransfer(
        userId: number, 
        hotelId: number, 
        transferId: number,
        reason: string
    ) {  
        if (!reason || reason.trim().length < 5) {
            throw new BadRequestException("Un motif d'annulation détaillé est requis pour des raisons d'audit.");
        }
        return await this.prisma.$transaction(async (tx) => {
            // Récupérer le transfert clôturé par erreur
            const transfer = await tx.stockTransfer.findFirst({
                where: { id: transferId, hotelId, status: 'RECEIVED' },
                include: { product: true }
            });

            if (!transfer) {
                throw new NotFoundException("Transfert validé introuvable ou impossible à inverser.");
            }

            const qtyToReverse = Number(transfer.quantityReceived);

            // 1. Soustraire du POS qui a validé par erreur en utilisant TON moteur FIFO
            await this.deductStockUsingFIFO(
                tx, 
                transfer.productId, 
                transfer.toPosId, 
                hotelId, 
                qtyToReverse
            );

            // 2. Remettre le stock au Grand Magasin (fromPosId est null)
            let storeStock = await tx.stock.findFirst({
                where: { productId: transfer.productId, posId: null, hotelId }
            });

            if (!storeStock) {
                storeStock = await tx.stock.create({
                    data: { 
                        hotelId, 
                        productId: transfer.productId, 
                        posId: null, 
                        quantity: qtyToReverse
                    }
                });
            } else {
                storeStock = await tx.stock.update({
                    where: { id: storeStock.id },
                    data: { quantity: { increment: qtyToReverse } }
                });
            }
            // Remettre le lot dans le magasin général
            await tx.stockBatch.create({
                data: { 
                    stockId: storeStock.id, 
                    quantity: qtyToReverse, 
                    expiryDate: new Date()
                }
            });
                
            // 3. Écritures comptables d'annulation pour les auditeurs
            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: transfer.productId,
                    quantity: -qtyToReverse,
                    type: 'INVENTORY_ADJUSTMENT',
                    from: `POS_ID_${transfer.toPosId}`,
                    to: 'GENERAL_STORE_RESTORATION',
                    reason: `ANNULATION TRANSFERT FANTOME(Erreur validation-aveugle(ou rapide) du Barman sans recevoir les produits) ${transfer.reference}. Raison: ${reason}`,
                    userId,
                    costPrice: transfer.product?.defaultPurchasePrice || 0
                }
            });

            // Remettre le statut à CANCELLED
            await tx.stockTransfer.update({
                where: { id: transfer.id },
                data: { status: 'CANCELLED' }
            });

            return { message: "Correction effectuée. Les stocks ont été restitués au Magasin Général." };
        });
    }


    // =========================================================================
    // MOTEUR INTERNE : FIFO VIRTUEL ASSISTÉ (MÉTHODE PRIVÉE)
    // =========================================================================
        private async deductStockUsingFIFO(
            tx: any, 
            productId: number, 
            posId: number | null, 
            hotelId: number, 
            quantityToDeduct: number
        ) {
            // 1. Trouver le stock global pour cet emplacement
            const stock = await tx.stock.findFirst({
                where: { productId, posId, hotelId },
                include: { batches: { orderBy: { expiryDate: 'asc' } } } // Trie du plus urgent au moins urgent
            });
    
            const currentStockQty = stock ? Number(stock.quantity) : 0;
    
            if (!stock || currentStockQty < quantityToDeduct) {
                throw new BadRequestException(`Stock total insuffisant. Disponible : ${stock?.quantity || 0}`);
            }
    
            let remainingToDeduct = quantityToDeduct;
            const flaggedBatchesForCheck: { batchId: number; expiryDate: Date; message: string }[] = []; // Pour stocker les lots vidés à vérifier physiquement
    
        
            // 2. Parcourir les lots pour consommer la quantité
            for (const batch of stock.batches) {
                if (remainingToDeduct <= 0) break;
    
                const batchQty = Number(batch.quantity || 0);
    
                if (batch.quantity <= remainingToDeduct) {
                    remainingToDeduct -= batchQty;
    
                    // Si le lot a une date de péremption et qu'on le vide virtuellement, on lève une alerte
                    if (batch.expiryDate) {
                        flaggedBatchesForCheck.push({
                            batchId: batch.id,
                            expiryDate: batch.expiryDate,
                            message: `Le lot expirant le ${batch.expiryDate.toLocaleDateString()} est marqué comme épuisé par le FIFO informatique. À vérifier physiquement sur l'étagère.`
                        });
                    }
    
                    await tx.stockBatch.delete({ where: { id: batch.id } });
                } else {
                    // Le lot a assez de stock pour couvrir le reste de la demande
                    await tx.stockBatch.update({
                        where: { id: batch.id },
                        data: { quantity: batchQty - remainingToDeduct }
                    });
                    remainingToDeduct = 0;
                }
            }
    
            // 3. Mettre à jour le total global de la table Stock
            const updatedStock = await tx.stock.update({
                where: { id: stock.id },
                data: { quantity: currentStockQty - quantityToDeduct }
            });
    
            return {
                updatedStock,
                alerts: flaggedBatchesForCheck
            };
        }

    // =========================================================================
    // LIBRE ARBITRE & AJUSTEMENTS PAR LE STOREKEEPER
    // =========================================================================

    // Mettre à jour une date après stockage (Libre Arbitre)
    async updateBatchExpiry(hotelId: number, batchId: number, newExpiryDate: string | null) {
        const batch = await this.prisma.stockBatch.findFirst({
            where: { id: batchId, stock: { product: { hotelId: hotelId } } } // filtrage sous le parent direct
        });

        if (!batch) throw new NotFoundException("Lot de stock introuvable.");

        return await this.prisma.stockBatch.update({
            where: { id: batchId },
            data: { expiryDate: newExpiryDate ? new Date(newExpiryDate) : null }
        });
    }

    // Ajustement de cohérence physique en cas de mélange constaté de deux lots
    async reconcileMixedBatches(
        userId: number,
        hotelId: number, 
        body: { productId: number; posId: number | null; expiredBatchExpiry: string; realQuantityLeft: number; correctBatchId: number }
    ) {
        return await this.prisma.$transaction(async (tx) => {
            const stock = await tx.stock.findFirst({
                where: { productId: body.productId, posId: body.posId, hotelId }
            });
            if (!stock) throw new NotFoundException("Stock introuvable pour ce produit à cet emplacement.");

            // 1. Recréer informatiquement le lot périssable trouvé physiquement sur l'étagère
            const createBatch = await tx.stockBatch.create({
                data: {
                    stockId: stock.id,
                    quantity: body.realQuantityLeft,
                    expiryDate: new Date(body.expiredBatchExpiry)
                }
            });

            // 2. Diminuer d'autant le lot secondaire qui a été vidé par erreur physique
            const targetBatch = await tx.stockBatch.findUnique({ where: { id: body.correctBatchId } });
            if (!targetBatch || Number(targetBatch.quantity) < body.realQuantityLeft) {
                throw new BadRequestException("Incohérence : le lot de compensation n'a pas assez de quantité pour absorber ce réajustement.");
            }

            await tx.stockBatch.update({
                where: { id: body.correctBatchId },
                data: { quantity: Number(targetBatch.quantity) - body.realQuantityLeft }
            });

            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: body.productId,
                    quantity: body.realQuantityLeft,
                    type: 'MIXED_BATCH_RECONCILIATION',
                    from: `Lot de compensation ID: ${body.correctBatchId}`,
                    to: `Nouveau Lot ID: ${createBatch.id} (POS: ${body.posId || 'GENERAL STORE'})`,
                    reason: `Rapprochement d'inventaire des lots mélangés effectué par l'utilisateur ID: ${userId}.`,
                    userId: userId // Lu et historisé ici !
                }
            })

            return { message: "Fiche des lots corrigée avec succès selon le constat physique du storekeeper." };
        });
    }


    // =========================================================================
    // TRANSFERT INTER-STOCKS (MAGASIN CENTRAL ➡️ POS ou POS ➡️ POS)
    // =========================================================================
    async transferStock(
        userId: number,
        hotelId: number,
        dto: {
            productId: number;
            sourcePosId: number | null; // null = Grand Magasin
            targetPosId: number | null; // destination (ex: Bar)
            quantity: number;
            reason?: string;
        }
    ) {
        if (dto.sourcePosId === dto.targetPosId) {
            throw new BadRequestException("Les emplacements source et cible doivent être différents.");
        }
        if (dto.quantity <= 0) {
            throw new BadRequestException("La quantité à transférer doit être supérieure à 0.");
        }

        return await this.prisma.$transaction(async (tx) => {
            // Vérifier l'existence et la nature du produit
            const product = await tx.product.findFirst({
                where: { id: dto.productId, hotelId }
            });
            if (!product) throw new NotFoundException("Produit introuvable dans cet hôtel.");
            if (product.isService) throw new BadRequestException("Impossible de transférer un service.");

            // MOTEUR FIFO : Déduire les lots de l'emplacement SOURCE
            // Cette méthode gère déjà la validation des quantités globales et supprime/met à jour les lots.
            const fifoResult = await this.deductStockUsingFIFO(
                tx, 
                dto.productId, 
                dto.sourcePosId, 
                hotelId, 
                dto.quantity
            );

            // INJECTION OU MISE À JOUR à l'emplacement CIBLE
            let targetStock = await tx.stock.findFirst({
                where: { productId: dto.productId, posId: dto.targetPosId, hotelId }
            });

            if (targetStock) {
                targetStock = await tx.stock.update({
                    where: { id: targetStock.id },
                    data: { quantity: Number(targetStock.quantity) + dto.quantity }
                });
            } else {
                targetStock = await tx.stock.create({
                    data: {
                        productId: dto.productId,
                        posId: dto.targetPosId,
                        hotelId,
                        quantity: dto.quantity
                    }
                });
            }

            // RESTRUCTURATION DES LOTS SUR LA DESTINATION
            // On recrée un lot ou des lots miroirs avec les dates critiques pour le POS récepteur.
            // Pour simplifier et garder la traçabilité de péremption, on crée un nouveau lot global 
            // lié au transfert (ou on hérite de la date du lot le plus urgent consommé).
            // Ici, on applique une règle de sécurité : on hérite de la date si elle est connue.
            const primaryAlert = fifoResult.alerts[0]; 
            
            await tx.stockBatch.create({
                data: {
                    stockId: targetStock.id,
                    quantity: dto.quantity,
                    expiryDate: primaryAlert ? primaryAlert.expiryDate : null // Héritage de la date critique constatée
                }
            });

            // 5. HISTORISATION DANS LES MOUVEMENTS DE STOCK POUR L'AUDIT
            const sourceLabel = dto.sourcePosId ? `POS ID: ${dto.sourcePosId}` : "GENERAL STORE";
            const targetLabel = dto.targetPosId ? `POS ID: ${dto.targetPosId}` : "GENERAL STORE";

            await tx.stockMovement.create({
                data: {
                    hotelId,
                    productId: dto.productId,
                    quantity: dto.quantity,
                    type: MovementType.TRANSFER, // Assurez-vous d'avoir TRANSFER dans votre enum Prisma
                    from: sourceLabel,
                    to: targetLabel,
                    reason: dto.reason || "Transfert interne standard d'approvisionnement",
                    userId: userId
                }
            });

            return {
                message: "Transfert inter-stocks effectué avec succès.",
                productId: dto.productId,
                quantityTransferred: dto.quantity,
                source: sourceLabel,
                destination: targetLabel,
                alerts: fifoResult.alerts // Remonte les alertes si des lots d'origine ont été vidés
            };
        });
    }

    async validatePosSaleItem(
        tx: any, 
        hotelId: number,
        posId: number, 
        productId: number, 
        quantityRequested: number,
        userId: number, 
        orderNumber: string, 
        tableName?: string 
    ) {
         // Récupérer le stock actuel au POS
        const stock = await tx.stock.findFirst({
            where: { posId, productId }
        });

        const currentQty = stock ? new Decimal(stock.quantity).toNumber() : 0;
        let isEmergencySale = false; 

         // Si le stock est insuffisant pour la vente
        if (currentQty < quantityRequested) {
    
        // ON VÉRIFIE SI LE SUPERVISEUR A ACTIVÉ LE MODE URGENCE POUR CE POS
        const pos = await tx.pointOfSale.findUnique({
            where: { id: posId },
            select: { allowEmergencySales: true }   //Optimisation: on ne charge que ce champ
            });

            if (!pos || !pos.allowEmergencySales) {
                throw new BadRequestException(
                    `Stock insuffisant (${currentQty} dispo). Vente impossible. Veuillez informer Votre Superviseur.`
                );
            }

        // SI LE MODE URGENCE EST ACTIF : On autorise la vente et le stock passe en négatif temporaire
        // Ce déficit sera tracé et devra être régularisé le lendemain matin par le transfert a posteriori.
        isEmergencySale = true;
        }

        // Décrémentation du stock (soit normalement, soit en négatif si urgence activée)
        if(stock) {
            // Le stock existe, on le décrémente normalement (peut passer en négatif)
            await tx.stock.update({
                where: { id: stock.id },
                data: { quantity: { decrement: quantityRequested } }
            }); 
        } else {
            // Le produit n'a jamais existé dans ce POS. On le crée directement en négatif !
            await tx.stock.create({
                data: {
                    hotelId,
                    posId,
                    productId,
                    quantity: -quantityRequested // Le stock est directement négatif
                }
            });
        }
        // TRAÇABILITÉ (Crucial pour l'analyse des coûts !)
        const reasonPrefix = isEmergencySale ? '[URGENCE - STOCK NEGATIF]' : 'Sortie automatique'

        await tx.stockMovement.create({
            data: {
                // Remplacez 'hotelId' par la façon dont vous le récupérez (souvent via le POS ou l'user)
                hotelId,
                productId: productId,
                quantity: quantityRequested,
                type: 'SALE',
                from: `Stock POS ${posId}`,
                to: `Client (Table: ${tableName || 'Emporter'})`,
                reason: `Sortie automatique sur Facture: ${orderNumber}`,
                userId: userId,
                posId,
                isEmergency: currentQty < quantityRequested
            }
        });
    }

    // MODE URGENCE (SUPERVISEUR SÉCURISÉ)
    async toggleEmergencySaleMode(
        supervisorId: number, 
        hotelId: number, 
        posId: number, 
        activate: boolean
    ) {
        // Optionnel : Vérification  via User/Role service si le supervisorId a bien le rôle 'SUPERVISOR' / 'MANAGER'

        const pos = await this.prisma.pointOfSale.findFirst({
            where: { id: posId, hotelId }
        });

        if (!pos) throw new NotFoundException("Point de vente introuvable.");

        return await this.prisma.pointOfSale.update({
            where: { id: posId },
            data: {
                allowEmergencySales: activate,
                emergencyActivatedBy: activate ? supervisorId : null,
                emergencyActivatedAt: activate ? new Date() : null
            }
        });
    }

    // =========================================================================
    // RAPPORT D'ALERTE : STOCKS EN SOUFFRANCE ET ATTENTE DE RÉGULARISATION
    // =========================================================================

    async getEmergencySalesAlertReport(hotelId: number, posId?: number) {
    // On cherche toutes les lignes de stock qui sont INFERIEURES à zéro (déficitaires)
    // d'un ou de plusieurs POS spécifiques
    const stockAlerts = await this.prisma.stock.findMany({
      where: {
        hotelId,
        quantity: { lt: 0 }, // Uniquement les stocks en négatif (< 0)
        ...(posId && { posId }) // Si un posId est spécifié, on filtre dessus
        },
      include: {
        product: true,
        pos: {
          select: {
            id: true,
            name: true,
            allowEmergencySales: true,
            emergencyActivatedAt: true,
            emergencyActivatedBy: true
            // On peut lier les détails du superviseur si le modèle le permet
            // Exemple fictif si tu as une relation ou une table User :
            // emergencySupervisor: { select: { name: true } } 
          }
        }
      }
    });

    // Si on a besoin de récupérer manuellement le nom du superviseur via son ID 
    // (au cas où il n'y a pas de relation directe au niveau du modèle Prisma)
    const formattedAlerts = await Promise.all(
      stockAlerts.map(async (alert: any) => {
        let supervisorName = "Inconnu";
        
        if (alert.pointOfSale?.emergencyActivatedBy) {
          const supervisor = await this.prisma.user.findUnique({

            where: { id: alert.pointOfSale.emergencyActivatedBy },
            select: { name: true }
         });
            if (supervisor) {
                supervisorName = `${supervisor.name}`;
            }
        }

        // On calcule la quantité exacte que le barman doit régulariser auprès du Storekeeper
        const quantityToRegularize = Math.abs(Number(alert.quantity));

        return {
            posId: alert.pointOfSale.id,
            posName: alert.pointOfSale.name,
            productId: alert.productId,
            productName: alert.product.name,
            sku: alert.product.code,
            stockActuelLogiciel: Number(alert.quantity), // Affichera par exemple -3
            quantiteAEmprunterAuMagasin: quantityToRegularize, // Affichera 3
            modeUrgenceActif: alert.pointOfSale.allowEmergencySales,
            activePar: supervisorName,
            activeLe: alert.pointOfSale.emergencyActivatedAt,
            prixCoutantTotalMouvement: quantityToRegularize * Number(alert.product.defaultPurchasePrice || 0)
        };
      })
    );

    return {
        hotelId,
        generatedAt: new Date(),
        totalAlertesEnCours: formattedAlerts.length,
        alertes: formattedAlerts
    };
  }

    // Récupérer l'état du stock (positif ou négatif) pour un Point de Vente (POS) spécifique
    async getLiveStockByPos(hotelId: number, posId: number) {
        // Vérifier d'abord si le POS appartient bien à l'hôtel
        const pos = await this.prisma.pointOfSale.findFirst({
            where: { id: posId, hotelId }
        });

        if (!pos) {
            throw new NotFoundException("Point de vente introuvable pour cet hôtel.");
        }

        // Récupérer tous les stocks de ce POS avec les détails du produit
        return this.prisma.stock.findMany({
            where: { posId },
            include: {
                product: {
                    select: {
                        name: true,
                        code: true,
                    }
                }
            },
            orderBy: { product: { name: 'asc' } }
        });
    }

    // Activer ou Désactiver le Mode Urgence (Autorisation des ventes à découvert)
    async updateEmergencyMode(hotelId: number, posId: number, allowEmergency: boolean) {
        // Vérification de sécurité de la propriété du POS
        const pos = await this.prisma.pointOfSale.findFirst({
            where: { id: posId, hotelId }
        });

        if (!pos) {
            throw new NotFoundException("Point de vente introuvable pour cet hôtel.");
        }

        // Mise à jour de la configuration du POS
        const updatedPos = await this.prisma.pointOfSale.update({
            where: { id: posId },
            data: { 
                allowEmergencySales: allowEmergency 
                // Note: Si tu as une colonne pour tracer le superviseur qui l'a activé, tu pourras la rajouter ici
            },
            select: { id: true, name: true, allowEmergencySales: true }
        });

        return {
            message: `Le mode urgence a été ${allowEmergency ? 'ACTIVÉ' : 'DÉSACTIVÉ'} avec succès pour le POS: ${updatedPos.name}.`,
            pos: updatedPos
        };
    }
}