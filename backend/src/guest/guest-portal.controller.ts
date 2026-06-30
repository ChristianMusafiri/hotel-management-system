import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { GuestPortalService } from './guest-portal.service';

@Controller('portal/hotels/:hotelId/guests/:guestId')
export class GuestPortalController {
    constructor(private readonly portalService: GuestPortalService) {}

    // Mon Profil & Balance financière
    @Get('profile')
    async getProfile(
        @Param('hotelId', ParseIntPipe) hotelId: number,
        @Param('guestId', ParseIntPipe) guestId: number
    ) {
        return this.portalService.getClientProfile(guestId, hotelId);
    }

    // Ma chambre actuelle et mes consommations en direct (Restaurant / Bar / Room Service)
    @Get('current-stay')
    async getCurrentStay(
        @Param('hotelId', ParseIntPipe) hotelId: number,
        @Param('guestId', ParseIntPipe) guestId: number
    ) {
        return this.portalService.getCurrentStay(guestId, hotelId);
    }

    // Historique de mes factures et anciens séjours
    @Get('history')
    async getHistory(
        @Param('hotelId', ParseIntPipe) hotelId: number,
        @Param('guestId', ParseIntPipe) guestId: number
    ) {
        return this.portalService.getStayHistory(guestId, hotelId);
    }
}