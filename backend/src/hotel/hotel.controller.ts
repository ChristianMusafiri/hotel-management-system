import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('hotel')
@UseGuards(JwtAuthGuard) // etre connecté pour configurer

export class HotelController {
    constructor (private readonly hotelService: HotelService) {}

    // voir les parametres actuels (Nom, Taux, TVA)
    @Get('settings')
    async getSettings(@Request() req) {
        // Extraction sécurisée depuis le jeton de l'utilisateur
        const hotelId = req.user.hotelId;
        return this.hotelService.getSettings(hotelId);
    }

    @Post('settings')
    async updateSettings(@Request() req, @Body() body: any) {
        const hotelId = req.user.hotelId;
        return this.hotelService.updateSettings(hotelId, body);
    }
}
