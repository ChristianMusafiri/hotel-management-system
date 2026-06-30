import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { StockService } from '../stock/stock.service';
import { StockModule } from '../stock/stock.module';

import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { PrinterModule } from '../printer/printer.module';

@Module({
  imports: [PrismaModule, PrinterModule, StockModule],
  providers: [OrderService, StockService, JwtAuthGuard],
  controllers: [OrderController],
  exports: [OrderService]
})
export class OrderModule {}
