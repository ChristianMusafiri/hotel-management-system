import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosDto } from './dto/create-pos.dto';

@Injectable()
export class PosService {
    constructor (private readonly prisma: PrismaService) {}

    // creer nouveau POS
    async create(hotelId: number, createPosDto: CreatePosDto) {
        // first: on recupere le contrat de lhotel nbr pos
        const hotel = await this.prisma.hotel.findUnique({ where: { id: hotelId } });
        
        if (!hotel) {
            throw new NotFoundException(
                "Configuration de votre établissement(hotel) introuvable"
            );
        }

        // module pos (activé ou desactivé)
        if(!hotel.isPosEnabled) {
            throw new BadRequestException(
                "Le module POS n'est pas activé dans votre abonnement actuel. Veuillez contacter l'administrateur."
            )
        }

        //Vérification du nombre maximal de POS autorisés
        const currentPosCount = await this.prisma.pointOfSale.count({ where: { hotelId } });
        const maxAllowed = hotel.maxPosAllowed ?? 2;

        if (currentPosCount >= maxAllowed) {
            throw new BadRequestException (`Limite de contrat atteinte ! Votre abonnement est limité à ${maxAllowed} point(s) de vente. Veuillez migrer vers une formule supérieure.(plus d'info, contacter ce numero: +234 993233514)`);
        }

        // meilleur vadidation normale anti-doublon
        const normalizedName = createPosDto.name.trim().toUpperCase();
        const existingPos = await this.prisma.pointOfSale.findUnique({
            where: { hotelId_name: {hotelId, name: normalizedName} },
        });

        if(existingPos) {
            throw new ConflictException(`Le point de vente "${normalizedName}" existe déjà.`)
        }

        //creation pos 
        return await this.prisma.pointOfSale.create({
            data: {
                name: normalizedName,
                type: createPosDto.type?createPosDto.type.toUpperCase() : 'STANDARD',
                      hotelId    // injection by force
            },
        });
    }

    // lister tous les POS
    async findAll(hotelId: number) {
        return await this.prisma.pointOfSale.findMany({
            where: { hotelId },
            orderBy: { name: 'asc' },
        });
    }

    // Trouver un pos par son ID avec appartenance à lhotel
    async findOne(id: number, hotelId: number) {
        const pos = await this.prisma.pointOfSale.findUnique({
            where: { id },
        });
        if(!pos || pos.hotelId !== hotelId) {
            throw new NotFoundException(`Point de vente avec l'ID ${id} introuvable ou n'existe pas`)
        }
        return pos;
    }

    // Activer ou Désactiver un point de vente 
    async toggleStatus(id: number, hotelId: number, isActive: boolean) {
        await this.findOne(id, hotelId); // verifie sil existe et leve une erreur si ce nest pas le bon hotel

        return this.prisma.pointOfSale.update({
            where: {id},
            data: { isActive },
        });
    }
}
