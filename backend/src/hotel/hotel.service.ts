import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HotelService {
    constructor(private prisma: PrismaService) {}

    // on recupere la config unique (on part du fait quil ya quun hotel par instance )
    async getSettings() {
        return this.prisma.hotel.findFirst();
    }

    // creer ou mttre à jour le parametre
    async updateSettings(data: any) {
        const config = await this.prisma.hotel.findFirst();
        if (config) {
            return this.prisma.hotel.update({
                where: { id: config.id },
                data,
            });
        }

        return this.prisma.hotel.create({ data });
    }
}
