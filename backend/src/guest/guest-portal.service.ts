import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FolioStatus } from '@prisma/client';

@Injectable()
export class GuestPortalService {
    constructor(private prisma: PrismaService) {}

    // GET /portal/profile
    // Renvoie le profil complet du client connecté, sa balance et sa réputation

    async getClientProfile(guestId: number, hotelId: number) {
        const guest = await this.prisma.guest.findFirst({
            where: { id: guestId, hotelId },
            select: {
                id: true,
                title: true,
                name: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                creditStatus: true,
                portalStatus: true,
                accountBalance: true,
                companyName: true,
                contractNumber: true,
                paymentPromiseDate: true
            }
        });

        if (!guest) {
            throw new NotFoundException("Profil client introuvable sur ce portail.");
        }

        return guest;
    }

    // GET /portal/current-stay
    // Permet au client de voir en temps réel sa chambre et ses consommations (Bar, Resto, Room Service)
    async getCurrentStay(guestId: number, hotelId: number) {
        // On cherche le folio actuellement ouvert (CHECKED_IN) pour ce client
        const currentFolio = await this.prisma.folio.findFirst({
            where: {
                guestId: guestId,
                hotelId: hotelId,
                status: FolioStatus.CHECKED_IN
            },
            
        });

        if (!currentFolio) {
            return {
                hasActiveStay: false,
                message: "Vous n'avez aucun séjour actif en chambre actuellement."
            };
        }

        return {
            hasActiveStay: true,
            folioId: currentFolio.id,
            roomId: currentFolio.roomId,
            vheckIn: currentFolio.checkIn,
            checkOut: currentFolio.checkOut,
            message: "Aperçu de votre séjour actuel."
        };
    }

    // GET /portal/history
    // Historique complet des anciens séjours fermés et factures réglées
    async getStayHistory(guestId: number, hotelId: number) {
        const history = await this.prisma.folio.findMany({
            where: {
                guestId: guestId,
                hotelId: hotelId,
                status: FolioStatus.CHECK_OUT // Uniquement les séjours archivés/clôturés
            },
            select: {
                id: true,
                roomId: true,
                checkIn: true,
                checkOut: true,
                totalBill: true,
                guestName: true
            },
            orderBy: { checkIn: 'desc' }
        });

        return {
            totalStays: history.length,
            history: history
        };
    }
}