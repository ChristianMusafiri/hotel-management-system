import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto'
import { PrinterService } from '../printer/printer.service'; // injection service socket TCP
import { StockService } from '../stock/stock.service';
import { Decimal } from '@prisma/client/runtime/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrderService {
    constructor(private readonly prisma: PrismaService,
                private readonly printerService: PrinterService, // on injecte le service
                private readonly stockService: StockService, // 
    ) {}

    async createOrder(userId: number, hotelId: number, dto: CreateOrderDto) {
        const { posId, shiftId, paymentMethodId, folioId, tableName, items, discountAmount = 0 } = dto;

        if(!items || items.length === 0) {
            throw new BadRequestException("Une commande doit contenir au moins un article.");
        }
        // controle shift: seul un shift ouvert peu encaisser
        const shift = await this.prisma.posShift.findFirst({
            where: { 
                id: shiftId,
                pos: { hotelId }
            }
        });

        if(!shift || shift.status !== 'OPEN') {
            throw new BadRequestException("Le shift de caisse sélectionné est fermé ou introuvable.");
        }

        // logique Saas (traitement aricle et application prix promotionnel)
        const itemsWithAppliedPrices = await Promise.all(
            items.map(async (item) => {
                //on cherche si ce produit a un prix promotionnel sur tel POS
                const posMenu = await this.prisma.posMenu.findUnique({
                    where: { posId_productId: { posId, productId: item.productId } }
                });

                // if prix promo existe sur pos1, on utilise; otherwise on prend le prix envoyé
                const finalPrice = (posMenu && posMenu.customPrice !== null) ? posMenu.customPrice: item.price;

                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: finalPrice,              //prix historisé et ajoute selon POS
                };
            })
        );

        //calcule du montant de base actualisé brut et net - reduction(il ya eu)
        const grossAmount = itemsWithAppliedPrices.reduce((sum, item) => { 
            const itemPrice = new Decimal(item.price).toNumber();
            return sum + (itemPrice * item.quantity) }, 0);
        

        //generation du numero de facture
        //const uniqueTimestamp = Date.now().toString().substring(6);
        //const orderNumber = `FAC-${uniqueTimestamp}  ${new Date().getFullYear()}`;

        // determination du status (cash ou chambre)
        let initialStatus: 'PENDING' | 'PENDING_ROOMLINK' = 'PENDING';
        if(folioId) {
            initialStatus = 'PENDING_ROOMLINK';
            const folio = await this.prisma.folio.findFirst({ where: { id: folioId } });
            if (!folio || folio.status !== 'CHECKED_IN') {
                throw new BadRequestException("Le Folio/Chambre selectionnée pas actif(ve) (déjà Check-out ou inexistant).")
            }
        }

        //transaction atomique pour l'enregistrement das la bd :Création de la commande + Déstockage direct
        const newOrder = await this.prisma.$transaction(async (tx) =>{
            // Génération d'une référence temporaire ou réutilisation du tableName pour le log de stock
            const logReference = tableName ? `Table: ${tableName}` : `Folio: ${folioId}`;
            // Déstockage physique et traçabilité pour chaque article
            for (const item of itemsWithAppliedPrices) {
                await this.stockService.validatePosSaleItem(
                    tx, 
                    hotelId,            
                    posId, 
                    item.productId, 
                    item.quantity, 
                    userId,              
                    `Session de commande - ${logReference}`,         
                    tableName        
                );
            }
            // Recherche d'une commande EN COURS (PENDING) pour cette même table / ce même folio sur ce POS
            const existingOrder = await tx.order.findFirst({
                where: {
                    posId,
                    status: initialStatus,
                    ...(tableName ? { tableName } : { folioId })
                },
                include: { items: true }
            });

            if (existingOrder) {
                // LA TABLE EST DÉJÀ OCCUPÉE -> ON MET À JOUR LA FACTURE EXISTANTE
                
                for (const item of itemsWithAppliedPrices) {
                    // On vérifie si ce produit existe déjà sur la facture de la table
                    const existingItem = existingOrder.items.find(oi => oi.productId === item.productId);

                    if (existingItem) {
                        // Le produit existe déjà (ex: ils recommandent des Fanta), on incrémente la quantité
                        await tx.orderItem.update({
                            where: { id: existingItem.id },
                            data: { quantity: { increment: item.quantity } }
                        });
                    }else {
                        // Nouveau produit pour cette table, on crée une nouvelle ligne sur l'Order existante
                        await tx.orderItem.create({
                            data: {
                                hotelId,
                                orderId: existingOrder.id,
                                productId: item.productId,
                                quantity: item.quantity,
                                price: item.price
                            }
                        });
                    }
                }
                //recalcul start point
                // Recouvrement propre de toutes les lignes pour recalcul global exact
                const allUpdatedItems = await tx.orderItem.findMany({
                    where: { orderId: existingOrder.id }
                });

                const totalGross = allUpdatedItems.reduce((sum, i) => {
                    return sum + (new Decimal(i.price).toNumber() * Number(i.quantity));
                }, 0);

                const totalDiscount = new Decimal(existingOrder.discountAmount).toNumber() + discountAmount;


                // Recalcul du montant total global de la facture (Ancien total + Nouveau brut - nouveau discount)
                //const newTotalAmount = Math.max(0, new Decimal(existingOrder.totalAmount).toNumber() + grossAmount - discountAmount);
                const newTotalAmount = Math.max(0, totalGross - totalDiscount);

                return tx.order.update({
                    where: { id: existingOrder.id },
                    data: {
                        totalAmount: newTotalAmount,
                        //discountAmount: { increment: discountAmount }
                        discountAmount: totalDiscount
                    },
                    include: {
                        items: { include: { product: true } },
                        pos: true,
                        user: { select: { name: true } }
                    }
                });

            } else {
                // A) LA TABLE EST VIDE -> ON CRÉE UNE NOUVELLE FACTURE UNIQUE
                const uniqueTimestamp = Date.now().toString().substring(6);
                const orderNumber = `FAC-${uniqueTimestamp} ${new Date().getFullYear()}`;
                //
                const grossAmount = itemsWithAppliedPrices.reduce((sum, item) => { 
                    return sum + (new Decimal(item.price).toNumber() * item.quantity);
                }, 0);
                //
                const totalAmount = Math.max(0, grossAmount - discountAmount); // on evite le montant negatif
            
                return tx.order.create({
                    data: {
                        hotelId,
                        orderNumber,
                        tableName,
                        totalAmount,
                        discountAmount,
                        status: initialStatus,
                        posId,
                        paymentMethodId,
                        userId, // le serveur qui saisi la commande
                        shiftId,
                        folioId: folioId || null,
                        items: {
                            create: itemsWithAppliedPrices.map(i => ({
                                hotelId: hotelId,
                                productId: i.productId,
                                quantity: i.quantity,
                                price: i.price
                            })),
                        },
                    },

                    include: {
                        items: { include: { product: true } },
                        pos: true,
                        user: { select: { name: true } }
                    },
                });
            }
        });

        // IMPRESSION AUTOMATIQUE AU BAR / CUISINE (Via le Mapping IP stocké sur le POS)
        // option 2(Prisma.OrderGetPayload in case if doesnt work properly)
        const printerIp = newOrder.pos['printerIp'] || newOrder.pos['printerId'];
        if(printerIp) {
            const printerPort = newOrder.pos['printerPort'] || 9100;
            
            let ticketText = `\n    ***BONS DE COMMANDE***    \n`;
            ticketText += `Facture Référence  ${newOrder.orderNumber} \n`;
            ticketText += `Serveur: ${newOrder.user.name} \n`;
            ticketText += `Table   : ${newOrder.tableName || 'N/A'}\n`;
            ticketText += `Date: ${new Date().toLocaleTimeString()} \n`;
            ticketText += `------------------------------ \n`;
            newOrder.items.forEach(i => {
                ticketText += `${i.quantity} x ${i.product.name} \n`;
            });
            ticketText += `-------------------------cm212 \n`;

            // Envoi asynchrone (en tâche de fond pour ne pas faire ramer l'application)
            try {
                this.printerService.sendToPrinter(printerIp, printerPort, ticketText);
            } catch (err) {
                console.error("Erreur impression bon de commande :", (err as Error).message);
            }
        }
        return newOrder;
    };

    // Securisation printed bill from waiter
    async requestBillPrint(orderId: number, hotelId: number) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, pos: { hotelId } },
            include: { pos: true, items: { include: { product: true } } }
        });

        if(!order) { throw new NotFoundException("commande introuvable - pas de commande ") }

        if(order.status !== 'PENDING' && order.status !== 'PENDING_ROOMLINK') {
            throw new BadRequestException("Impossible d'imprimer l'addition : il y a pas de commande encours")
        }

        // status passe en PRINTED - plus dacces au serveur 
        const updatedOrder = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'PRINTED' },
        });

        const printerIp = order.pos['printerIp'] || order.pos['printerId'];
       
        //Envoi de l'addition (Pré-facture) pour le client
        if(printerIp) {
            const printerPort = order.pos['printerPort'] || 9100;
            let billText = `\n    === FACTURE ===    \n`;
            billText += `Facture: ${order.orderNumber} \n`;
            billText += `Table: ${order.tableName || 'N/A'} \n`;
            billText += `------------------------------ \n`;
            
            order.items.forEach(i => {
                const priceDec = new Decimal(i.price);
                const qtyDec = new Decimal(i.quantity);
                const lineTotal = priceDec.times(qtyDec);
                billText += `${i.product.name}\n  ${qtyDec.toNumber()} x ${priceDec.toFixed(2)} = ${lineTotal.toFixed(2)}$ \n`;
            })
            billText += `------------------------------ \n`;
            
            const discNum = new Decimal(order.discountAmount).toNumber();
            if(discNum > 0) {
                billText += `Reduction : -${discNum.toFixed(2)}$ \n`;
            }

            const totalAmountNum = new Decimal(order.totalAmount).toNumber();
            billText += `TOTAL NET : ${totalAmountNum.toFixed(2)}$ \n`;
            billText += `-------------------------cm212 \n`;

            try {
                await this.printerService.sendToPrinter(printerIp, printerPort, billText);
            } catch (err) {
                console.error("Erreur impression addition :", (err as Error).message);
            }
        } return updatedOrder;
    }


    //Validation payment par la caisse ou affectation chambre / offre(comte management)
    async validationPayment (orderId: number, cashierId: number, hotelId: number) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId, pos: { hotelId } },
            include: { paymentMethod: true }
        });
        
        if(!order) { throw new NotFoundException("commande introuvable - pas de commande ") }

        if(order.status !== 'PRINTED' && order.status !== 'PENDING_ROOMLINK') {
            throw new BadRequestException("La commande doit d'abord être imprimée ou envoyée en attente de validation chambre.")
        }

        const methodName = order?.paymentMethod?.name?.toUpperCase() || '';
        if(methodName.includes('MANAGEMENT')) {
            const executingUser = await this.prisma.user.findUnique({
                where: { id: cashierId },
                include: {
                    roles: { include: { role: true } } // // On traverse la table pivot UserRole pour atteindre Role
                }
            });

            const userRoles = executingUser?.roles.map(ur => ur.role.name.toUpperCase()) || [];

            const hasAuthorization = userRoles.includes('ADMIN') || userRoles.includes('MANAGER') ;

            if(!hasAuthorization) {
                throw new ForbiddenException("Action refusée : Seule la direction (MANAGER) peut clore une note sur le compte MANAGEMENT.");
            }
        }

        let finalStatus: 'VALIDATED' | 'CHARGED_TO_ROOM' | 'MANAGEMENT_CLOSED' = 'VALIDATED';
        if(order.folioId) {
            finalStatus = 'CHARGED_TO_ROOM'; // montant affecté à la chambre , augmente le montant chambre 
        } else if(methodName.includes('MANAGEMENT')) {
            finalStatus = 'MANAGEMENT_CLOSED'; //  Optionnel pour un statut clair en BD
        }

        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: finalStatus,
                cashierId,
                validatedAt: new Date(),
            },
            include: {
                paymentMethod: true,
                user: { select: { name: true } } 
            }
        });
    }
    //Cas dannulation produit sur commande ou reaffectation room by supervisor (Audit trail)
    async supervisorcorrection(
        orderId: number,
        supervisorId: number,
        hotelId: number,
        
        body: {
            reason: string;
            action: 'CANCEL_TOTAL' | 'CANCEL_ITEM' | 'CORRECT-ROOM';
            orderItemId?: number;
            quantityToWithdraw?:number;
            newFolioId?: number; 
        }
    ) {
        const { action, reason, orderItemId, quantityToWithdraw, newFolioId } = body;

        // find order whith items
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, pos: { hotelId } },
            include: { items: { include: { product: true } }, pos: true }
        });

        if(!order) { throw new NotFoundException("commande introuvable - pas de commande ") };

        if(order.status === 'VALIDATED' || order.status === 'CHARGED_TO_ROOM' || order.status === 'MANAGEMENT_CLOSED') {
            throw new BadRequestException("Impossible de corriger une facture déjà encaissée ou clôturée.")
        }

        // Variables pour stocker les informations du ticket à imprimer en tâche de fond
        let triggerPrint = false;
        let cancelTicketText = '';

        const result = await this.prisma.$transaction(async (tx) => {
            //Annulation total de la facture
            if(action === 'CANCEL_TOTAL') {
                const cancelledOrder = await tx.order.update({
                    where: { id: orderId },
                    data: { status: 'CANCELLED', correctionReason: reason, correctedById: supervisorId, totalAmount: 0 }, // passe a zero pour la caisse (fact)
                    include: { items: { include: {product: true } } }
                });
                //ici on retourn tous les items dans le stock et dans le lots
                for(const item of order.items) {
                    const productStock = await tx.stock.findFirst({
                        where: { productId: item.productId, posId: order.posId }
                    });

                    if (productStock) {
                        const currentQty = new Decimal(productStock.quantity);
                        // reintegre la quantity total de la ligne
                        await tx.stock.update({
                            where: { id: productStock.id },
                            data: { quantity: currentQty.plus(item.quantity).toNumber() }
                        });

                        // gestion Batch (fifo)
                        const latestBatch = await tx.stockBatch.findFirst({
                            where: { stockId: productStock.id },
                            orderBy: { id: 'desc' } // on cible le lot le plus recent
                        });

                        if(latestBatch) {
                            // on remet les produits dans ce lot
                            await tx.stockBatch.update({
                                where: { id: latestBatch.id },
                                data: { quantity: new Decimal(latestBatch.quantity).plus(item.quantity).toNumber() }
                            });
                        } else {
                            // si aucun lot n'existe pas de tout, on en cree un par defaut pour ne pas casser le fifo
                            await tx.stockBatch.create({
                                data: {
                                    stockId: productStock.id,
                                    quantity: item.quantity,
                                    expiryDate: null // ou une date par defaut si product non perisssable
                                },
                            });
                        }
                    }
                    // historique du mouvement pour chaque facture annulée
                    await tx.stockMovement.create({
                        data: {
                            hotelId,
                            productId: item.productId,
                            quantity: item.quantity,
                            type: `RETURN_AFTER_CANCEL`,
                            from: `Facture: ${order.orderNumber} (ANNULATION TOTALE)`,
                            to: `Stock POS ${order.posId}`,
                            reason: `Facture intégrale annulée par le Superviseur(ID): ${supervisorId}. Motif: ${reason}`,
                            userId: supervisorId
                        }
                    });
                }
                // Préparation du ticket d'annulation totale pour le bar/cuisine
                triggerPrint = true;
                cancelTicketText = `\n   !!! ANNULATION TOTALE !!!   \n`;
                //
                cancelTicketText += `Facture: ${order.orderNumber}\n`;
                cancelTicketText += `Table: ${order.tableName || 'N/A'}\n`;
                cancelTicketText += `Motif: ${reason}\n`;
                cancelTicketText += `------------------------------\n`;
                //
                order.items.forEach(i => {
                    cancelTicketText += `ANNULÉ: ${i.quantity} x ${i.product.name}\n`;
                });
                cancelTicketText += `-------------------------cm212\n`;


                return { message: "Facture intégrale annulée avec succès et tous les articles ont été réintégrés au stock POS.",
                    cancelledOrder
                };
            }

            //Annulation facture ligne par ligne des items (Premium)
            if(action === 'CANCEL_ITEM') {
                if(!orderItemId || !quantityToWithdraw) {
                    throw new BadRequestException("Pour une annulation partielle, vous devez spécifier l'article et la quantité à retirer.");
                }
                
                // Find ligne specifique de larticle sur facture (orderItem)
                const item = order.items.find(i => i.id === orderItemId);
                if(!item) { throw new NotFoundException("Cet article n'existe pas sur cette facture.") }
                
                const currentItemQty = new Decimal(item.quantity).toNumber();
                if(quantityToWithdraw > currentItemQty) { 
                    throw new BadRequestException(`Impossible de retirer ${quantityToWithdraw} articles. Cette facture n'en contient que ${item.quantity}.`);
                }
                const itemPrice = new Decimal(item.price).toNumber();
                const priceToSubstract = itemPrice * quantityToWithdraw;

                if(currentItemQty === quantityToWithdraw) {
                    // client retire tous les primus par ex: 4 sur 4, on supprime comptement la ligne primus
                    await tx.orderItem.delete({ where: { id: orderItemId } });
                }  else {
                    // sinon on actualise la quantité restante(4-1) 3
                    await tx.orderItem.update(
                        { where: { id: orderItemId }, 
                          data: { quantity: currentItemQty - quantityToWithdraw }
                        });
                }

                // Recalcul précis après suppression partielle
                const remainingItems = await tx.orderItem.findMany({ where: { orderId } });
                const newTotalAmount = Math.max(0, remainingItems.reduce((sum, i) => sum + (new Decimal(i.price).toNumber() * Number(i.quantity)), 0) - new Decimal(order.discountAmount).toNumber());
                //const currentTotal = new Decimal(order.totalAmount).toNumber();
                // recalcul immediat de la facture generale
                //const newTotalAmount = Math.max(0,currentTotal - priceToSubstract);

                //mise a jour de la facture et audit supervisuer(tracabilite)
                const updatedOrder = await tx.order.update({
                    where: { id: orderId }, // change bug : orderItemId
                    data: {
                        totalAmount: newTotalAmount,
                        //on garde une trace de la derniere modification dans les logs textuels
                        correctionReason: `Retrait de ${quantityToWithdraw} x (Product ID: ${item.productId}). Motif: ${reason}`,
                        correctedById: supervisorId,
                        //On repasse en PENDING ou PRINTED pour forcer le caissier à voir le nouveau montant
                        status: 'PRINTED'
                    },
                    include: { items: { include: { product: true } } }
                });

                // AUTOMATISATION DU STOCK (RéIntégrée dans la même transaction) ,Batch methode
                const productStock = await tx.stock.findFirst({
                    where: { productId: item.productId, posId: order.posId }
                });

                if (productStock) {
                    const currentQty = new Decimal(productStock.quantity);
                    // rintegration du stock physique POS
                    await tx.stock.update({
                        where: { id: productStock.id },
                        data: { quantity: currentQty.plus(quantityToWithdraw).toNumber() }
                    });

                    // Réintégration dans le lot (StockBatch) le plus récent
                    const latestBatch = await tx.stockBatch.findFirst({
                        where: { stockId: productStock.id },
                        orderBy: {  id: 'desc'}
                    });

                    if(latestBatch) {
                        await tx.stockBatch.update({
                            where: { id: latestBatch.id },
                            data: { quantity: new Decimal(latestBatch.quantity).plus(quantityToWithdraw).toNumber() }
                        });
                    } //else {
                       // await tx.stockBatch.create({
                       //     data: {
                        //        stockId: productStock.id,
                        //        quantity: quantityToWithdraw,
                        //        expiryDate: null
                    //        }
                    //    });
                   // }
                }

                // Écriture de la fiche de stock (Fiche de mouvements) pour les contrôleurs
                await  tx.stockMovement.create({
                    data: {
                        hotelId,
                        productId: item.productId,
                        quantity: quantityToWithdraw,
                        type: 'RETURN_AFTER_CANCEL',
                        from: `Facture ${order.orderNumber}`,
                        to: `Stock POS ${order.posId}`,
                        reason: `Annulation (p-T) par le Superviseur(ID): ${supervisorId}. Avec Motif: ${reason} `,
                        userId: supervisorId 
                    }
                });
                // Préparation du ticket d'annulation partielle
                triggerPrint = true;
                cancelTicketText = `\n   !!! ANNULATION PARTIELLE !!!   \n`;
                //
                cancelTicketText += `Facture: ${order.orderNumber}\n`;
                cancelTicketText += `Table: ${order.tableName || 'N/A'}\n`;
                cancelTicketText += `Motif: ${reason}\n`;
                cancelTicketText += `------------------------------\n`;
                cancelTicketText += `ANNULÉ: ${quantityToWithdraw} x ${item.product.name}\n`;
                cancelTicketText += `-------------------------cm212\n`;
                //
                
                return {
                    message: "Article(s) retiré(s) avec succès. Facture mise à jour et POS stock réintégré.",
                    newTotal: updatedOrder.totalAmount,
                    updatedOrder,
                };
            }

            //Mauvaise affectation chambre
            if(action === 'CORRECT-ROOM' && newFolioId) {
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        correctedFromFolioId: order.folioId,
                        folioId: newFolioId,
                        status: 'CHARGED_TO_ROOM',
                        correctionReason: reason,
                        correctedById: supervisorId,
                    },
                });

                return { message: "Facture reaffectée à la bonne chambre avec succès" };
            }

            throw new BadRequestException( "Action de correction non reconnue");
        });

        // IMPRESSION EN TÂCHE DE FOND (Hors de la transaction pour ne pas bloquer la BD)
       if (triggerPrint && order.pos['printerIp'] && cancelTicketText !== '') {
            try {
                this.printerService.sendToPrinter(order.pos['printerIp'], order.pos['printerPort'] || 9100, cancelTicketText);
            } catch (err) {
                console.error("Erreur d'impression du ticket d'annulation :", (err as Error).message);
            }
        }

        return result;
    }  
}