import { Module } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

import { HotelService } from '../hotel/hotel.service';
@Module({
  imports: [PrismaModule, JwtModule],

  controllers: [RoomsController],
  providers: [RoomsService, HotelService]
})
export class RoomsModule {}
