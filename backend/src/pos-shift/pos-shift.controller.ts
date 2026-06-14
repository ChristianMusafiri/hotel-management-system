import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { PosShiftService } from './pos-shift.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pos-shift')
export class PosShiftController {
    constructor(private readonly posShiftService: PosShiftService) {}


    @UseGuards(JwtAuthGuard)  // securise la route via Jwt
    @Post('open')
    async open(@Body() createShiftDto: CreateShiftDto, @Request() req) {
        // extraction securisée de userId connected via token JWT
        const userId = req.user.id;

        return this.posShiftService.OpenShift(userId, createShiftDto);
    }
}


//💡 Conseil de pro pour ton ERP
//Si tu veux un code encore plus propre et éviter d'utiliser req: any, 
// tu peux créer un décorateur personnalisé @GetUser() plus tard. 
// Mais pour l'instant, assure-toi juste que l'import vient bien de @nestjs/common.
//Est-ce que l'erreur disparaît après avoir corrigé l'import ?
