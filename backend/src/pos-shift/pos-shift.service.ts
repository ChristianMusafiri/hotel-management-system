import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';

@Injectable()
export class PosShiftService {
    constructor(private readonly prisma: PrismaService) {}

    async OpenShift( userId: number, dto: CreateShiftDto) {
        const { posId, initialFloat } = dto;

        // verification de lexistence du pos et si actif
        const pos = await this.prisma.pointOfSale.findUnique({ 
            where: { id: posId },
         });

         if(!pos) {
            throw new NotFoundException("Ce point de vente n'existe pas.");
         }

         if(!pos.isActive) {
            throw new BadRequestException("Ce point de vente est actuellement désactivé.")
         }

         // controle Abonnement Saas : limitation d'un cashier par jour si l'option est desactivée
         const hotel = await this.prisma.hotel.findFirst();
         
         if(!hotel) {
            throw new NotFoundException("Configuration introuvable.(hotel) parametre");
         }

         // on cherche sil ya une session ouverte right now on POS precis
         const activeShiftOnPos = await this.prisma.posShift.findFirst({
            where: { posId: posId, status: 'OPEN' },
            include: { user: { select: {name: true} } }
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
                     userId: userId,
                     posId: posId,
                     initialFloat: initialFloat,
                     actualAmount: 0,
                     status: 'OPEN',
                     // si un shift etait resté; on pourrqirt stocker une note ou un flqg de notificqtion ici
                 },
                 include: { 
                     user:{ select: { id: true, name: true, username: true } },
                     pos: true }
             });

    }



    async closeAndPrintShift(shiftId: number, actualAmountDeclared: number) {
        // Trouver le shift
        const shift = await this.prisma.posShift.findUnique({
            where: { id: shiftId },
            include: { orders: true, pos: true,
                user: { select: { name: true } }
            }
        });

        if(!shift) {
            throw new NotFoundException("Session de caisse introuvable");
        }
        // verification de la variable shif trouvée, on extrait le nom: ${shift.user.name}
        if(shift.status === 'CLOSED') {
            throw new BadRequestException(`Ce shift a deja ete cloturé par ${shift.user.name} et le rapport (imprimé)`)
        }

        //Calcul ventes reelles passees during ths shift(total de commandes, liees a ce shift)
        const totalSales = shift.orders.reduce((sum,order) => sum + (order.totalAmount || 0), 0);

        // montant ttendu en caisse = Fond de caisse initial + total des ventes de la journee
        const expectedAmount = shift.initialFloat + totalSales;

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
            },
            include: {
                user: { select: { name: true } },
                pos: true
            }
        });

        return {
            message: "Shift clôturé avec succès. Vous pouvez imprimer votre rapport de caisse.",
            reportData: {
                // en attente de: 
                // idInvoicePrefix: closedShift.pos.orderPrefix,
                idInvoicePrefix: closedShift.pos?.name.substring(0,3) + '-',
                caissier: closedShift.user.name,
                PointDeVente: closedShift.pos.name,
                ouverture: closedShift.openedAt,
                cloture: closedShift.closedAt,
                fondDeCaisseInitial: closedShift.initialFloat,
                ventesDuShift: totalSales,
                montantAttendu: expectedAmount,
                montantReelDeclare: actualAmountDeclared,
                ecartDeCaisse: discrepancy,  
            }
        };
    }
}
