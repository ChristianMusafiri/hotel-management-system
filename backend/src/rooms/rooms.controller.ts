import { Controller, Get, Post, Body, Param, Request, Patch, UseGuards, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StayType } from '@prisma/client';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard) // On sécurise toutes les routes

export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get() //On affiche toutes les chambres
  @Roles('ADMIN', 'RECEPTIONIST', 'MANAGER')
  findAll() {
    return this.roomsService.getAllRooms();
  }

  // process checkin 
  @Post(':id/check-in')
  @Roles('ADMIN', 'RECEPTIONIST')
  async checkIn(
    @Param('id') id: string,
    @Body() body: { guestName: string; stayType: StayType; guestId?: number },
    //ROLE dutilisateur connecté
    @Request() req: any
  ) {
    const userRole = req.user.role //extraction du role from user injecté par JwtAuthGuard
    return this.roomsService.checkIn(+id, body, userRole);
  }

  //Process checkout
  @Patch('folios/:id/check-out')
  @Roles('ADMIN', 'RECEPTIONIST')
  async checkOut(@Param('id') id: string) {
    return this.roomsService.checkOut(+id);
  }

  //Annulation penalité facture Room (overtime client)
  @Patch('folio/:id/waive-overtime')
  @UseGuards(JwtAuthGuard)
  async waiveOvertime(
    @Param('id') id:number,
    @Body('reason') reason: string,
    @Request() req: any
  ) {
    if(req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      throw new ForbiddenException ("Acces refusé; Contactez le manager pour annuler la pénalité.")
    }

    const managerName = req.user.name
    return this.roomsService.waiveOvertime(id, managerName, reason);
  }

  //Valider le nettoyage
  @Patch(':id/clean')
  @Roles('ADMIN', 'HOUSE_KEEPER') // Seul l'admin ou le housekeeper peut valider
  async validateCleaning(@Param('id') id: string) {
    return this.roomsService.validateCleaning(+id);
  }
}