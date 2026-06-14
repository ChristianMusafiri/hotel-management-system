import { Module } from '@nestjs/common';
import { PosShiftService } from './pos-shift.service';
import { PosShiftController } from './pos-shift.controller';

import { PrismaModule } from '../prisma/prisma.module'; //
import { JwtModule } from '@nestjs/jwt'; //Indispensable pour le JwtAuthGuard

@Module({
  imports: [ PrismaModule, JwtModule],
  providers: [PosShiftService],
  controllers: [PosShiftController]
})
export class PosShiftModule {}
