import { Controller, Post, Get, Body, Param, ParseIntPipe, UseGuards, Patch } from '@nestjs/common';
import { GuestService } from './guest.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('hotels/:hotelId/guests')
export class GuestController {
    constructor(private readonly guestService: GuestService) {}

    //📱 ROUTE PUBLIQUE : Soumission du formulaire QR Code par le client
    // POST /hotels/:hotelId/guests/self-register
    @Post('self-register')
    async clientSelfRegistration(
        @Param('hotelId', ParseIntPipe) hotelId: number,
        @Body() guestData: any   // on remplace plus tard 'any' par un DTO précis (CreateGuestDto)
    ) {
        const newGuest = await this.guestService.createSelfRegisteredGuest(hotelId, guestData);
        return {
            success: true,
            message: "Votre fiche d'enregistrement a été envoyée avec succès à la réception",
            guestId: newGuest.id
        }
    }

    // ROUTE : Récupérer toutes les fiches en attente (Le flux d'alerte)
    // GET /hotels/:hotelId/guests/pending

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('RECEPTIONIST', 'MANAGER', 'ADMIN')
    @Get('pending')
    async getPendingRegistrations(@Param('hotelId', ParseIntPipe) hotelId: number) {
        const pendingGuests = await this.guestService.getPendingGuests(hotelId);
        return {
            count: pendingGuests.length,
            results: pendingGuests
        };
    }

    // ROUTE: Validation d'une fiche client et liaison avec le Folio de la chambre
    // PATCH /hotels/:hotelId/guests/:guestId/validate-and-assign

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('RECEPTIONIST', 'ADMIN')
    @Patch(':guestId/validate-and-assign')
    async validateAndAssignGuest(
        @Param('hotelId', ParseIntPipe) hotelId: number,
        @Param('guestId', ParseIntPipe) guestId: number,
        @Body('folioId', ParseIntPipe) folioId: number,
        @Body('receptionistName') receptionistName: string  // Idéalement extrait de req.user via ton JWT Guard
    ) {
        //(authentification JWT) à remplacer 'receptionistName' reçu du body par req.user.username 
        // pour plus de sécurité
        return await this.guestService.ValidateGuestAndAssignToFolio(
            guestId,
            folioId,
            receptionistName || 'Agent Réception',
            hotelId
        );
    }
}
