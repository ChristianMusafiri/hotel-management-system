import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HotelService {
    constructor(private prisma: PrismaService) {}

    // on recupere la config unique (par etablissement)
    async getSettings(hotelId: number) {
        const hotel =  this.prisma.hotel.findUnique({
            where: { id: hotelId }
        });
        if (!hotel) throw new NotFoundException("Hôtel introuvable.");
        return hotel;
    }

    // creer ou mttre à jour le parametre
    async updateSettings(hotelId: number, data: any) {
        // Sécurité : On s'assure que l'ID de l'hôtel ne soit pas écrasé par le body
        delete data.id;

        return this.prisma.hotel.update({
            where: { id: hotelId },
            data,
            });
    }

    async createNewHotel(hotelData: any) {
        // Création de l'hôtel (ex: génère l'ID 2)
        const newHotel = await this.prisma.hotel.create({ data: hotelData });

        // Génération automatique des catégories par défaut pour CET hôtel
        const defaultCategories = ['BAR', 'RESTAURANT', 'HEBERGEMENT', 'SERVICE', 'DIVERS'];
  
        for (const catName of defaultCategories) {
            await this.prisma.category.create({
                data: {
                name: catName,
                hotelId: newHotel.id // Prend dynamiquement l'id 2, 3, 4...
                }
            });
        }     

        return newHotel;
    }   
}
