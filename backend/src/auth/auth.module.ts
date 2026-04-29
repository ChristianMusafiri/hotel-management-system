import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
// import et ajout jwt et pass pour le token
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import 'dotenv/config';
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'SECRET_HOTEL_M_2026',
      signOptions: { expiresIn: '24h' }
    })
  ],
  providers: [AuthService],
  controllers: [AuthController]
})
export class AuthModule {}
