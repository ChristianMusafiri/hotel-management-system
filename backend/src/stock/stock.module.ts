import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

import { PurchaseRequestService } from './purchase-request.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [StockService, PurchaseRequestService, PrismaService],
  controllers: [StockController],
  exports: [StockService, PurchaseRequestService]
})
export class StockModule {}
