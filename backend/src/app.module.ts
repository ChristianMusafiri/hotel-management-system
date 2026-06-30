import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoomsModule } from './rooms/rooms.module';
import { HotelModule } from './hotel/hotel.module';
import { PosModule } from './pos/pos.module';
import { PosShiftModule } from './pos-shift/pos-shift.module';
import { OrderModule } from './order/order.module';
import { PrinterModule } from './printer/printer.module';
import { StockModule } from './stock/stock.module';
import { GuestModule } from './guest/guest.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true,}),
    AuthModule, PrismaModule, UsersModule, RoomsModule, HotelModule, PosModule, PosShiftModule, OrderModule, PrinterModule, StockModule, GuestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
