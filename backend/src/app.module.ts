import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoomsModule } from './rooms/rooms.module';
import { HotelModule } from './hotel/hotel.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true,}),
    AuthModule, PrismaModule, UsersModule, RoomsModule, HotelModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
