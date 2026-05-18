import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStatus,StayType, FolioStatus } from '@prisma/client';
import { HotelService } from '../hotel/hotel.service';
import { DateTime } from 'luxon';

@Injectable()
export class RoomsService {
    constructor(private prisma: PrismaService,
                private hotelService: HotelService
    ) {}

    //type de nuitee (calculation),fonctions de verification d'heures (async best)
    private async calculateTotal(checkIn: Date, checkOut: Date, type: StayType, roomPriceUsd: number, folioId: number) {
        const hotelConfig = await this.hotelService.getSettings() ;

        //Valeurs de secours si la config est (not found)
        const tz = hotelConfig?.timezone || 'Africa/Lubumbashi';
        const checkOutLimit = hotelConfig?.checkOutHour || 10;
        const dayUseMax = hotelConfig?.dayUseMaxHours || 6;
        const rate = hotelConfig?.currencyExchangeRate || 2300;
        const taxPercent = hotelConfig?.taxeRate || 16;

        //recuperation du feat Toggle (day_use :overtime)
        const isOverTimeEnabled = hotelConfig?.isOvertimeDayuseFeeEnabled || false;
        const overtimeRate = hotelConfig?.dayUseOvertimeRate || 8;
        const gracePeriodMins = hotelConfig?.dayUseGracePeriodMins || 15;

        // Conversion dates avec luxon
        const start = DateTime.fromJSDate(checkIn).setZone(tz);
        const end = DateTime.fromJSDate(checkOut).setZone(tz);

        let totalUsd = 0;
        let overtimeHoursCharged = 0;
        let overtimePenaltyUsd = 0;

        if(type === StayType.DAY_USE) {
            const diffInMins = end.diff(start, 'minutes').minutes;
            const diffHours = diffInMins / 60;
            
            // if passage > 6 , 100% tarif room
            //totalUsd = diffHours <= dayUseMax ? roomPriceUsd * 0.5 : roomPriceUsd;
            //tarif de base (50% prix nuitee)
            totalUsd = roomPriceUsd * 0.5;
            
            // if labonnement de overtime client day_use est payee
            if(isOverTimeEnabled && diffHours > dayUseMax) { 
                const minutesEnTrop = diffInMins - (dayUseMax * 60);

                //(confort client: hospitality) si depassement periode de grace
                if(minutesEnTrop > gracePeriodMins) {
                    // declenchement facturation : penalité
                    overtimeHoursCharged = Math.ceil(minutesEnTrop / 60);
                
                    let hasManagerWaived = false;
                    if(folioId) {
                        const currentFolio = await this.prisma.folio.findUnique({where: { id: folioId } });
                        hasManagerWaived = currentFolio?.isOverTimeWaived || false;
                    }

                    if(!hasManagerWaived) {
                        //Aplication de la pen sur montant initial passage
                        overtimePenaltyUsd = totalUsd * (overtimeRate / 100) * overtimeHoursCharged;
                        totalUsd += overtimePenaltyUsd
                    }
                }
            }
            
            // si loption nest pas activé lancien comportement s'applique plein tarif apres 6h
            else if(!isOverTimeEnabled && diffHours > dayUseMax) {
                totalUsd = roomPriceUsd;
            }
        }

        else if(type === StayType.NIGHT){
            // logique check out 10h
            let nights = 0;

            let firstCutoff = start.set({ hour: checkOutLimit, minute: 0, second: 0, millisecond: 0 });
            if(start >= firstCutoff) {
                firstCutoff = firstCutoff.plus({ days: 1 })
            }

            let temp = firstCutoff;
            // on avance jour/jour à 10h
            while (temp <= end) {
                nights++;
                temp = temp.plus({ days: 1 });
            }

            nights = Math.max(1, nights);
            totalUsd = nights * roomPriceUsd;
        }

        // lOGIQUE Fiscalite 
        const taxAmountUsd = totalUsd * (taxPercent / 100);
        const finalTotalUsd = totalUsd + taxAmountUsd;
        // Conversion MULTI-DEVISES start with default HConfig
        const finalTotalFc = finalTotalUsd * rate;

        //logique(CALCUL) depassement 6h DAY_USE
        const hoursDiff = Math.round(end.diff(start, 'hours').hours)
        const daysDiff = Math.round(end.diff(start, 'days').days)


        return {
            stayDuration: type === StayType.DAY_USE ? `${hoursDiff} heures` : `${daysDiff} nuitées`,
            priceBeforeTaxUsd: totalUsd,
            taxApplied: `${taxPercent}%`,
            taxAmountUsd: taxAmountUsd,
            totalToPayUsd: finalTotalUsd,
            totalToPayFc: finalTotalFc,
            exchangeRateUsed: rate
        }
    }

    async waiveOvertime(folioId: number, managerName: string, reason: string) {
        const folio = await this.prisma.folio.findUnique({
            where: { id: folioId},
            include: { room: true }
        });

        if(!folio) throw new NotFoundException('FOLIO non touvé');
        if(!reason || reason.trim().length < 4) {
            throw new ForbiddenException("Une justification d'au moins 4 caractères est obligatoire pour l'audit comptable.")
        }

        if(folio.status === FolioStatus.CHECK_OUT) {
            return this.prisma.$transaction( async(tx) =>{
                //1.signature de l'annulation dans l'historique
                const updatedFolio = await tx.folio.update({
                    where: { id: folioId },
                    data: { 
                        isOverTimeWaived: true,
                        overtimeWaivedBy: managerName,
                        waivedAt: new Date(),
                        reasonForWaive: reason
                     }
                });
                //2.calcul de la fact sans penalité
                const newBillDetails = await this.calculateTotal(
                    updatedFolio.checkIn,
                    updatedFolio.checkOut!,
                    updatedFolio.stayType,
                    folio.room.price,
                    updatedFolio.id
                );

                //3. on ecrit un nouveau montant corrigé et gelé
                await tx.folio.update( {
                    where: { id: folioId },
                    data: { totalBill: newBillDetails.totalToPayUsd }
                });

                return {
                    message: "Pénalité annulée après clôture par le Manager. Log d'audit mis à jour.",
                    ancienMontantUSD: folio.totalBill,
                    nouveauMontantUSD: newBillDetails.totalToPayUsd,
                    justification: reason,
                    auditSignature: managerName
                };
            });
        }
        // Si le client est encore devant la réception (Cas classique avant validation finale)
        return this.prisma.folio.update({
            where: { id: folioId },
            data: {
                isOverTimeWaived: true,
                overtimeWaivedBy: managerName,
                waivedAt: new Date(),
                reasonForWaive: reason
            }
        });
    }

    //dashboard Reception : Voir toutes les chambres
    async getAllRooms(){
        return this.prisma.room.findMany({
            include:{ folios:{ where:{ status: FolioStatus.CHECKED_IN } } }
        });
    }
    // action included after 18h(DAY_USE)
    async checkIn(roomId: number, 
                  data:{ guestName: string, 
                         stayType: StayType, 
                         guestId?: number },
                  // restriction userRole added
                  userRole: string) {
        // logique restriction after 18h(DAY_USE)
        const now = new Date();
        const currentHour = now.getHours();

            if(data.stayType === StayType.DAY_USE){
                //&& userRole !== 'SUPER_ADMIN' later
                if((currentHour <8 || currentHour >= 18) && userRole !== 'ADMIN' && userRole !== 'MANAGER') {
                    throw new ForbiddenException("(passage) Acces verouillé apres 18h ,contactez le Manager pour approbation");
                }
            }

        return this.prisma.$transaction(async (tx) =>{

            const folio = await tx.folio.create({
               data: {
                roomId: roomId,
                guestName: data.guestName,
                stayType : data.stayType,
                guestId: data.guestId,
                status: FolioStatus.CHECKED_IN,
                checkIn: now,
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
                where: { id: folioId },
                include: { room: true } // prix de la chambre (we need price)
            });

            if (!folio) throw new NotFoundException('Folio non trouvé');

            const now = new Date();
            
            const billDetails = await this.calculateTotal(folio.checkIn, now, folio.stayType, folio.room.price, folio.id);

            const updatedFolio = await tx.folio.update({
                where: { id: folioId },
                data: { status: FolioStatus.CHECK_OUT,
                        checkOut: now,
                        totalBill: billDetails.totalToPayUsd // stockage de devise de reference Usd
                    },
            });
           
            // DIRTY status
            await tx.room.update({
                where: { id: folio.roomId },
                data: { status: RoomStatus.DIRTY }
            });

            return { message: 'check-out effectué avec succès, la chambre est à nettoyer.',
                     totalAPayer_USD: billDetails.totalToPayUsd,
                     totalAPayer_FC: billDetails.totalToPayFc,
                     tauxApplique: billDetails.exchangeRateUsed,
                     details: updatedFolio
             };
        });
    }

    //VALIDATION Mènage (HK)
    async validateCleaning(roomId: number) {
        return this.prisma.room.update({
            where: { id: roomId },
            data: { status: RoomStatus.AVAILABLE, 
                    isReady: true, 
                    lastCleanedAt: new Date() },
        });
    }
}
