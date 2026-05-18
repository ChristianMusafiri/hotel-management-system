import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { HotelService } from './hotel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('hotel')
@UseGuards(JwtAuthGuard) // etre connecté pour configurer

export class HotelController {
    constructor (private readonly hotelService: HotelService) {}

    // voir les parametres actuels (Nom, Taux, TVA)
    @Get('settings')
    async getSettings() {
        return this.hotelService.getSettings();
    }

    @Post('settings')
    async updateSettings(@Body() body: any) {
        return this.hotelService.updateSettings(body);
    }
}
