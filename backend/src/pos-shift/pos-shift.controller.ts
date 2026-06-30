import { Body, Controller,Patch, Get, Param, ParseIntPipe , Post, Request, UseGuards } from '@nestjs/common';
import { PosShiftService } from './pos-shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('pos-shift')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosShiftController {
    constructor(private readonly posShiftService: PosShiftService) {}


    @UseGuards(JwtAuthGuard)  // securise la route via Jwt
    @Post('open')
    @Roles('ADMIN', 'MANAGER', 'CASHIER')
    async open(@Body() createShiftDto: CreateShiftDto, @Request() req) {
        // extraction securisée de userId connected via token JWT
        const userId = req.user.id;
        const hotelId= req.user.hotelId;

        return this.posShiftService.OpenShift(userId, hotelId, createShiftDto);
    }
    // 
    // Clôture le shift avec le montant réel, le nombre de couverts et un correctif textuel.
    @UseGuards(JwtAuthGuard)
    @Roles('ADMIN', 'MANAGER', 'CASHIER')
    //PATCH /pos-shift/:id/close
    @Patch(':id/close')
    async close(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
        @Body() body: { actualAmountDeclared: number; totalCovers: number; closureComment?: string }
    ) {
        return this.posShiftService.closeAndPrintShift(
            id,
            req.user.hotelId,
            body.actualAmountDeclared,
            body.totalCovers,
            body.closureComment,
        );
    }

    // Retourne le Grand Journal complet (format A4) pour archivage PDF.
    @UseGuards(JwtAuthGuard)
    @Roles('ADMIN', 'MANAGER')
    // GET /pos-shift/:id/audit-report
    @Get(':id/audit-report')
    async getAuditReport(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.posShiftService.getShiftAuditJournal(id, req.user.hotelId);
    }
}
