import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { PrinterService } from '../printer/printer.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PosShiftService {
    constructor(private readonly prisma: PrismaService,
                private readonly printerService: PrinterService
    ) {}
    // overture d'un shift
    async OpenShift( userId: number, hotelId: number, dto: CreateShiftDto) {

        // verification de lexistence du pos et si actif
        const pos = await this.prisma.pointOfSale.findFirst({ 
            where: { id: dto.posId, hotelId },
         });

         if(!pos) {
            throw new NotFoundException("Ce point de vente n'existe pas.");
         }

         if(!pos.isActive) {
            throw new BadRequestException("Ce point de vente est actuellement désactivé.")
         }

         // controle Abonnement Saas : limitation d'un cashier par jour si l'option est desactivée
         const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
         
         if(!hotel) {
            throw new NotFoundException("Configuration introuvable.(hotel) parametre");
         }

         // on cherche sil ya une session ouverte right now on POS precis(existingShift)
         const activeShiftOnPos = await this.prisma.posShift.findFirst({
            where: { posId: dto.posId, status: 'OPEN' },
            include: { user: { select: { name: true } } }
         });

         if(activeShiftOnPos) {
            // Si lhotel n'a pas l'option  : Blocage strict
            if(!hotel.isMultiShiftEnabled) {
                throw new BadRequestException(
                    `Ce point de vente est déjà occupé par ${activeShiftOnPos.user.name}. Votre formule ne permet pas les shifts simultanés.`
                );
            }
         }

         return await this.prisma.posShift.create({
                 data: {
                    hotelId: hotelId,
                    userId,
                    posId: dto.posId,
                    initialFloat: dto.initialFloat,
                    actualAmount: 0,
                    status: 'OPEN',
                    // si un shift etait resté; on pourrqirt stocker une note ou un flqg de notificqtion ici
                },
                 include: { 
                    user:{ select: { id: true, name: true, username: true } },
                    pos: true }
             });

    }

    async closeAndPrintShift(
        shiftId: number, 
        hotelId: number,
        actualAmountDeclared: number, 
        totalCovers: number, 
        closureComment?: string
    ) {
        // Recherche du shift cloisonnée par l'hotelId du POS (Sécurité maximale)
        const shift = await this.prisma.posShift.findFirst({
            where: { id: shiftId, pos: { hotelId } },
            include: { 
                orders: { include: { paymentMethod: true } },
                user: { select: { name: true } },
                pos: true
            }
        });

        if(!shift) {
            throw new NotFoundException("Session de caisse introuvable");
        }
        // verification de la variable shif trouvée, on extrait le nom: ${shift.user.name}
        if(shift.status === 'CLOSED') {
            throw new BadRequestException(`Ce shift a deja ete cloturé par ${shift.userId} et le rapport (imprimé)`)
        }
        // On ne prend en compte que les factures valides ou imputées sur chambre.
        // FILTRAGE STRICT: On exclut les statuts 'CANCELLED', 'LOSS', ou 'PENDING' non facturés.
        const validOrders = shift.orders.filter(order => 
            ['VALIDATED', 'CHARGED_TO_ROOM', 'PRINTED'].includes(order.status)
        );

        // Calcul des ventes réelles (Montant net après déduction des réductions)
        const totalSales = validOrders.reduce((sum,order) => {
            //const amount = order.tableName ? Number(order.totalAmount) : 0;
            const amount = order.totalAmount ? Number(order.totalAmount) : 0;
            return sum + amount ;
        }, 0);

        // Séparation des ventes Cash/Espèces pour le calcul du montant attendu dans le tiroir-caisse(hors-chambre)
        const totalCashSales = validOrders
            .filter(order => !order.folioId && order.paymentMethod?.name.toUpperCase().includes('CASH'))
            .reduce((sum, order) => { 
                const amount = order.totalAmount ? Number(order.totalAmount) : 0;
                return sum + amount;
            }, 0);

        // montant ttendu en caisse = Fond de caisse initial + ventes(uniquement en CASH) de la journee
        const expectedAmount = Number(shift.initialFloat || 0) + totalCashSales;

        // Calcul ecart caisse(surplus ou manquant)
        const discrepancy = actualAmountDeclared - expectedAmount;

        // mettre a jour et FERMER le shift de maniere irreversible
        const closedShift = await this.prisma.posShift.update({
            where: { id: shiftId },
            data: {
                status: 'CLOSED',
                closedAt: new Date(),
                expectedAmount: expectedAmount,
                actualAmount: actualAmountDeclared,
                totalCovers: totalCovers,
                closureComment: closureComment || null
            },
            include: {
                user: { select: { name: true } },
                pos: true
            }
        });

        // Génération du texte brut ESC/POS pour imprimante thermique
        const dateCloture = closedShift.closedAt ? closedShift.closedAt.toLocaleString() : new Date().toLocaleString();
        const ticketRaw = 
            `----------------------------------------\n` +
            `        RAPPORT DE CLOTURE DE CAISSE     \n` +
            `----------------------------------------\n` +
            `PDV        : ${closedShift.pos.name}\n` +
            `Caissier   : ${closedShift.user.name}\n` +
            `Ouverture  : ${closedShift.openedAt.toLocaleString()}\n` +
            `Cloture    : ${dateCloture}\n` +
            `----------------------------------------\n` +
            `Fond initial      : ${Number(closedShift.initialFloat).toFixed(2)} USD\n` +
            `Ventes du Shift   : ${totalSales.toFixed(2)} USD\n` +
            `Montant Attendu   : ${expectedAmount.toFixed(2)} USD\n` +
            `Montant Declare   : ${actualAmountDeclared.toFixed(2)} USD\n` +
            `Ecart de Caisse   : ${discrepancy.toFixed(2)} USD\n` +
            `Total Couverts    : ${totalCovers}\n` +
            `----------------------------------------\n` +
            `Commentaire :\n${closureComment || 'Aucun'}\n` +
            `----------------------------------------\n` +
            `\n\n\n\n`; 

        // Gestion de l'imprimante réseau
        if (closedShift.pos['printerIp']) {
            const printerPort = closedShift.pos['printerPort'] || 9100;
            try {
                this.printerService.sendToPrinter(closedShift.pos['printerIp'], printerPort, ticketRaw);
            } catch (err) {
                const error = err as Error;
                // On log l'erreur d'impression mais on ne bloque pas la réponse API car la BDD est déjà validée
                console.error("Erreur d'impression réseau : ", error.message);
            }
        }

        // Le return doit TOUJOURS être exécuté, peu importe l'état de l'imprimante
        return {
            message: "Shift clôturé avec succès. Le rapport de caisse a été traité.",
            reportData: {
                idInvoicePrefix: closedShift.pos?.name.substring(0,3).toUpperCase() + '-',
                caissier: closedShift.user.name,
                PointDeVente: closedShift.pos.name,
                ouverture: closedShift.openedAt,
                cloture: closedShift.closedAt,
                fondDeCaisseInitial: closedShift.initialFloat,
                ventesDuShift: totalSales,
                montantAttendu: expectedAmount,
                montantReelDeclare: actualAmountDeclared,
                ecartDeCaisse: discrepancy,  
                totalCouverts: totalCovers,
                commentaireCorrectif: closureComment
            }
        };
    }
    // GRAND JOURNAL D'AUDIT DÉTAILLÉ (Génération pour Archivage PDF)
    async getShiftAuditJournal(shiftId: number, hotelId: number) {
        const shift = await this.prisma.posShift.findFirst({
            where: { 
                id: shiftId, 
                pos: { hotelId } 
            },
            include: {
                user: { select: { name: true } },
                pos: { select: { name: true } },
                orders: {
                    where: { status: { in: ['VALIDATED', 'CHARGED_TO_ROOM', 'PRINTED'] } },
                    include: {
                        user: { select: { name: true } },
                        paymentMethod: true,
                        items: { include: { product: { include: { category: true } } } }
                    }
                }
            }
        });

        if(!shift) { throw new NotFoundException("Shift introuvable.") }

        const rows = shift.orders.map((order, index) => {
            let nourriture = 0;
            let boisson = 0;
            let tabac = 0;
            let autres = 0;

            order.items.forEach(item => {
                const categoryName = item.product.category?.name?.toUpperCase() || 'AUTRES';
                const priceAsNumber = Number(item.price || 0);
                const quantityAsNumber = Number(item.quantity || 0);
                const itemTotal = quantityAsNumber * priceAsNumber;

                if(categoryName.includes('NOURRITURE') || categoryName.includes('CUISINE')) nourriture += itemTotal;
                else if(categoryName.includes('BOISSON') || categoryName.includes('BAR')) boisson += itemTotal;
                else if(categoryName.includes('TABAC')) tabac += itemTotal;
                else autres += itemTotal;
            });

            const methodName = order.paymentMethod?.name?.toUpperCase() || '';
            const isRoom = order.folioId !== null;
            const isDept = methodName.includes('CREDIT') || methodName.includes('DETTE');
            const orderTotal = Number(order.totalAmount || 0);

            return {
                id: index + 1,
                nomServeur: order.user.name,
                numeroFacture: order.orderNumber,
                nombreCouverts: 1, // Donnée arbitraire par facture si non tracée par table, ou changeable
                nourriture,
                boisson,
                tabac,
                autres,
                sousTotal: orderTotal + Number(order.discountAmount || 0),
                reductions: Number(order.discountAmount || 0),
                totalFacture: orderTotal,

                // CASH
                paiementEspeces: (!isRoom && methodName.includes('CASH')) ? orderTotal : 0, 
                // CREDIT Hebergement
                fraisChambre: isRoom ? orderTotal : 0,
                // CREDIT/dette client de passage
                creditClientPassage: (!isRoom && isDept) ? orderTotal : 0,

                paiementCard: (!isRoom && (methodName.includes('VISA') || methodName.includes('CARD'))) ? orderTotal : 0,
                paiementMobile: (!isRoom && (methodName.includes('MONEY') || methodName.includes('PESA') || methodName.includes('AIRTEL'))) ? orderTotal : 0,
            };
        });

        return {
            metadata: {
                agentCaisse: shift.user?.name,
                affectation: shift.pos.name,
                dateCloture: shift.closedAt || new Date(),
                fondDeCaisse: shift.initialFloat,
                ecartConstate: Number(shift.actualAmount || 0) - Number(shift.expectedAmount || 0)
            },
            lignesDuJour: rows
        };
    }
}
