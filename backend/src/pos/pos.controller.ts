import { Controller, Get, Post, Body, Param, ParseIntPipe, Patch, UseGuards, Request } from '@nestjs/common';
import { PosService } from './pos.service';
import { CreatePosDto } from './dto/create-pos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pos')
@UseGuards(JwtAuthGuard)
export class PosController {
    constructor(private readonly posService: PosService) {}

    @Post()
    async create(@Request() req, @Body() createPosDto: CreatePosDto) {
        return this.posService.create(req.user.hotelId, createPosDto);
    }

    @Get()
    async findAll(@Request() req) {
        return this.posService.findAll(req.user.hotelId);
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.posService.findOne(id, req.user.hotelId);
    }

    @Patch(':id/toggle')
    async toggleStatus(
        @Param('id', ParseIntPipe) id: number,
        @Request() req,
        @Body('isActive') isActive: boolean
    ) {
        return this.posService.toggleStatus(id, req.user.hotelId, isActive);
    }
}