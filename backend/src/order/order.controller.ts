import { Controller, Post, Body, UseGuards, Request, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)  // ajout important (car cest global)
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @Roles('ADMIN', 'CASHIER', 'WAITER', 'BARMAN') 
    async create(@Request() req, @Body() dto: CreateOrderDto) {
        return this.orderService.createOrder(req.user.id, req.user.hotelId, dto);
    }

    @Patch(':id/print-bill')
    @Roles('ADMIN', 'SUPERVISOR', 'CASHIER', 'WAITER')
    async printBill(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.orderService.requestBillPrint(id, req.user.hotelId);
    }

    @Patch(':id/validate-payment')
    @Roles('ADMIN', 'CASHIER')
    async validatePayment(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.orderService.validationPayment(id, req.user.id, req.user.hotelId);
    }

    @Post(':id/correction')
    @Roles('ADMIN', 'SUPERVISOR')
    async correction(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
        @Body() body: { reason: string; action: 'CANCEL_TOTAL' | 'CANCEL_ITEM' | 'CORRECT-ROOM'; orderItemId?: number; quantityToWithdraw?: number; newFolioId?: number; }
    ) {
        return this.orderService.supervisorcorrection(id, req.user.id, req.user.hotelId, body);
    }
}