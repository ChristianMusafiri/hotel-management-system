import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend le module iper accessible partout sans limporter à chaque fois( canal important)

@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
