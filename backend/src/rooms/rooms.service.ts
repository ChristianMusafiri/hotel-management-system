import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStatus,StayType, FolioStatus } from '@prisma/client';

@Injectable()
export class RoomsService {
    constructor(private prisma: PrismaService) {}

    //dashboard Reception : Voir toutes les chambres
    async getAllRooms(){
        return this.prisma.room.findMany({
            include:{ folios:{ where:{ status: FolioStatus.CHECKED_IN } } }
        });
    }
    
    async checkIn(roomId: number, data:{ guestName: string, stayType: StayType, guestId?: number }) {
        return this.prisma.$transaction(async (tx) =>{

            const folio = await tx.folio.create({
               data: {
                roomId: roomId,
                guestName: data.guestName,
                stayType : data.stayType,
                guestId: data.guestId,
                status: FolioStatus.CHECKED_IN,
               },
            });

            await tx.room.update({
                where: { id: roomId },
                data: {
                    status: RoomStatus.OCCUPIED,
                    isReady: false
                },
            });

            return folio;
        });
    }

    async checkOut(folioId: number) {
        return this.prisma.$transaction(async (tx) => {
            const folio = await tx.folio.findUnique({
                where: { id: folioId }
            });

            if (!folio) throw new NotFoundException('Folio non trouvé');

            await tx.folio.update({
                where: { id: folioId },
                data: { status: FolioStatus.CHECK_OUT, checkOut: new Date() },
            });

            await tx.room.update({
                where: { id: folio.roomId },
                data: { status: RoomStatus.DIRTY }
            });
            return { message: 'check-out effectué avec succes, la chambre est à nettoyer.' };
        });
    }

    //VALIDATION Mènage (HK)
    async validateCleaning(roomId: number) {
        return this.prisma.room.update({
            where: { id: roomId },
            data: { status: RoomStatus.AVAILABLE, isReady: true, lastCleanedAt: new Date() },
        });
    }
}
