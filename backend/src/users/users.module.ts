import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module'; //import lié à lautorisation de usersService
import { JwtModule } from '@nestjs/jwt'; //import Module JWT
@Module({
  imports: [PrismaModule,
            JwtModule.register({
              secret: process.env.JWT_SECRET,
              signOptions: { expiresIn: '24h' },
            })
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
