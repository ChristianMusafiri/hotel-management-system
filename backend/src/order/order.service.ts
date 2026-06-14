import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto'
import { PrinterService } from '../printer/printer.service'; // injection service socket TCP

@Injectable()
export class OrderService {
    constructor(private readonly prisma: PrismaService,
                private readonly printerService: PrinterService, // on injecte le service
    ) {}

    async createOrder(userId: number, dto: CreateOrderDto) {
        const { posId, shiftId, paymentMethodId, folioId, tableName, items, discountAmount = 0 } = dto;

        if(!items || items.length === 0) {
            throw new BadRequestException("Une commande doit contenir au moins un article.");
        }
        // controle shift: seul un shift ouvert peu encaisser
        const shift = await this.prisma.posShift.findUnique({
            where: { id: shiftId }
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
        const grossAmount = itemsWithAppliedPrices.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalAmount = Math.max(0, grossAmount - discountAmount); // on evite le montant negatif

        //generation du numero de facture
        const uniqueTimestamp = Date.now().toString().substring(6);
        const orderNumber = `FAC-${new Date().getFullYear()}-${uniqueTimestamp}`;

        // determination du status (cash ou chambre)
        let initialStatus: 'PENDING' | 'PENDING_ROOMLINK' = 'PENDING';
        if(folioId) {
            initialStatus = 'PENDING_ROOMLINK';
            const folio = await this.prisma.folio.findFirst({ where: { id: folioId } });
            if (!folio || folio.status !== 'CHECKED_IN') {
                throw new BadRequestException("Le Folio/Chambre selectionnée pas actif(ve) (déjà Check-out ou inexistant).")
            }
        }

        //transaction atomique pour l'enregistrement das la bd
        const newOrder = await this.prisma.$transaction(async (tx) =>{
            
            return tx.order.create({
                data: {
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
                        create: itemsWithAppliedPrices,
                    },
                },

                include: {
                    items: { include: { product: true } },
                    pos: true,
                    user: { select: { name: true } }
                },
            });
        });

        // IMPRESSION AUTOMATIQUE AU BAR / CUISINE (Via le Mapping IP stocké sur le POS)
        if(newOrder.pos.printerId) {
            let ticketText = `\n    ***COMMANDE DE SERVICE***    \n`;
            ticketText += `Facture: ${newOrder.orderNumber} \n`;
            ticketText += `Serveur: ${newOrder.user.name} \n`;
            ticketText += `Date: ${newOrder.createdAt.toLocaleTimeString()} \n`;
            ticketText += `------------------------------ \n`;
            newOrder.items.forEach(i => {
                ticketText += `${i.quantity} x ${i.product.name} \n`;
            });;
            ticketText += `-------------------------cm212 \n`;

            // Envoi asynchrone (en tâche de fond pour ne pas faire ramer l'application)
            this.printerService.sendToPrinter(newOrder.pos.printerId, newOrder.pos.printerPort, ticketText);
        }
        return newOrder;
    };

    // Securisation printed bill from waiter
    async requestBillPrint(orderId: number) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId },
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

        //Envoi de l'addition (Pré-facture) pour le client
        if(order.pos.printerId) {
            let billText = `\n    ===NOTE CONSOMMATION===    \n`;
            billText += `Facture: ${order.orderNumber} \n`;
            billText += `Table: ${order.tableName || 'N/A'} \n`;
            billText += `------------------------------ \n`;
            order.items.forEach(i => {
                billText += `${i.product.name}\n  ${i.quantity} x ${i.price} = ${i.quantity * i.price}$ \n`;
            })
            billText += `------------------------------ \n`;
            
            if(order.discountAmount > 0) {
                billText += `Reduction : -${order.discountAmount}$ \n`;

                this.printerService.sendToPrinter(order.pos.printerId, order.pos.printerPort, billText);
            }
            billText += `-------------------------cm212 \n`;

           return updatedOrder;
        }
    }


    //Validation payment par la caisse ou affectation chaambre
    async validationPayment (orderId: number, cashierId: number) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId }
        });
        
        if(!order) { throw new NotFoundException("commande introuvable - pas de commande ") }

        if(order.status !== 'PRINTED' && order.status !== 'PENDING_ROOMLINK') {
            throw new BadRequestException("La commande doit d'abord être imprimée ou envoyée en attente de validation chambre.")
        }

        let finalStatus: 'VALIDATED' | 'CHARGED_TO_ROOM' = 'VALIDATED';
        if(order.folioId) {
            finalStatus = 'CHARGED_TO_ROOM'; // montant affecté à la chambre , augmente le montant chambre 
        }

        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                status: finalStatus,
                cashierId,
                validatedAt: new Date(),
            },
        });
    }
    //Cas dannulation produit sur commande ou reaffectation room by supervisor (Audit trail)
    async supervisorcorrection(
        orderId: number,
        supervisorId: number,
        
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
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if(!order) { throw new NotFoundException("commande introuvable - pas de commande ") };

        if(order.status === 'VALIDATED' || order.status === 'CHARGED_TO_ROOM') {
            throw new BadRequestException("Impossible de corriger une facture déjà encaissée ou clôturée.")
        }

        return this.prisma.$transaction(async (tx) => {
            //Annulation total de la facture
            if(action === 'CANCEL_TOTAL') {
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: 'CANCELLED', correctionReason: reason, correctedById: supervisorId, }
                });
                //ici on retourn tous les items dans le stock
                return { message: "Facture intégrale annulée avec succès." }
            }

            //Annulation facture ligne par ligne des items (Premium)
            if(action === 'CANCEL_ITEM') {
                if(!orderItemId || !quantityToWithdraw) {
                    throw new BadRequestException("Pour une annulation partielle, vous devez spécifier l'article et la quantité à retirer.");
                }
                
                // Find ligne specifique de larticle sur facture (orderItem)
                const item = order.items.find(i => i.id === orderItemId);
                if(!item) { throw new NotFoundException("Cet article n'existe pas sur cette facture.") }

                if(quantityToWithdraw > item.quantity) { 
                    throw new BadRequestException(`Impossible de retirer ${quantityToWithdraw} articles. Cette facture n'en contient que ${item.quantity}.`);
                }

                let priceToSubstract = item.price * quantityToWithdraw;

                if(item.quantity === quantityToWithdraw) {
                    // client retire tous les primus par ex: 4 sur 4, on supprime comptement la ligne primus
                    await tx.orderItem.delete({ where: { id: orderItemId } });
                }  else {
                    // sinon on actualise la quantité restante(4-1) 3
                    await tx.orderItem.update(
                        { where: { id: orderItemId }, 
                          data: { quantity: item.quantity - quantityToWithdraw }
                        });
                }

                // recalcul immediat de la facture generale
                const newTotalAmount = order.totalAmount - priceToSubstract;

                //mise a jour de la facture et audit supervisuer(tracabilite)
                const updatedOrder = await tx.order.update({
                    where: { id: orderItemId },
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

                return {
                    message: "Article(s) retiré(s) avec succès. Facture mise à jour",
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
    }
}