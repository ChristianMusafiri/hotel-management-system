import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomStatus,StayType, FolioStatus } from '@prisma/client';
import { HotelService } from '../hotel/hotel.service';
import { DateTime } from 'luxon';
import { Decimal } from '@prisma/client/runtime/client';

@Injectable()
export class RoomsService {
    constructor(private prisma: PrismaService,
                private hotelService: HotelService
    ) {}

    //type de nuitee (calculation),fonctions de verification d'heures (async best)
    private async calculateTotal(checkIn: Date, checkOut: Date, type: StayType, roomPriceUsd: Decimal, hotelId: number, hasManagerWaived: boolean = false) {
        const hotelConfig = await this.hotelService.getSettings(hotelId) ;

        //Valeurs de secours si la config est (not found)
        const tz = hotelConfig?.timezone || 'Africa/Lubumbashi';
        const checkOutLimit = hotelConfig?.checkOutHour || 10;
        const dayUseMax = hotelConfig?.dayUseMaxHours || 6;
        const rate = hotelConfig?.currencyExchangeRate ? new Decimal(hotelConfig.currencyExchangeRate).toNumber() : 2300;
        const taxPercent = hotelConfig?.taxeRate ? new Decimal(hotelConfig.taxeRate).toNumber():  16;

        //recuperation du feat Toggle (day_use :overtime)
        const isOverTimeEnabled = hotelConfig?.isOvertimeDayuseFeeEnabled || false;
        const overtimeRate = hotelConfig?.dayUseOvertimeRate ? new Decimal(hotelConfig.dayUseOvertimeRate).toNumber(): 8;
        const gracePeriodMins = hotelConfig?.dayUseGracePeriodMins || 15;

        // Conversion du prix de la chambre Decimal -> number pour les calculs internes
        const priceAsNumber = new Decimal(roomPriceUsd).toNumber();

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
            totalUsd = priceAsNumber * 0.5;
            
            // if labonnement de overtime client day_use est payee
            if(isOverTimeEnabled && diffHours > dayUseMax) { 
                const minutesEnTrop = diffInMins - (dayUseMax * 60);

                //(confort client: hospitality) si depassement periode de grace
                if(minutesEnTrop > gracePeriodMins) {
                    // declenchement facturation : penalité
                    overtimeHoursCharged = Math.ceil(minutesEnTrop / 60);
                
                    // VERROU DE SÉCURITÉ : Si le manager a annulé, la pénalité vaut STRICTEMENT 0
                    if(!hasManagerWaived) {
                        //Aplication de la pen sur montant initial passage
                        overtimePenaltyUsd = totalUsd * (overtimeRate / 100) * overtimeHoursCharged;
                        totalUsd += overtimePenaltyUsd
                    }
                }
            }
            
            // si loption nest pas activé lancien comportement s'applique plein tarif apres 6h
            else if(!isOverTimeEnabled && diffHours > dayUseMax) {
                totalUsd = priceAsNumber;
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
            totalUsd = nights * priceAsNumber;
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
    
    //dashboard Reception : Voir toutes les chambres
    async getAllRooms(hotelId: number){
        return this.prisma.room.findMany({
            where: { hotelId },   // filtrage strict par hotel
            include:{ folios:{ where:{ status: FolioStatus.CHECKED_IN } } }
        });
    }
    // action included after 18h(DAY_USE)
    async checkIn(roomId: number, 
                  data:{ guestName: string, 
                         stayType: StayType, 
                         guestId?: number },
                  // restriction userRole added
                  userRoles: string[],
                  hotelId: number
        ) {
        // Vérification: la chambre appartient bien à l'hôtel de l'utilisateur connecté
        const room = await this.prisma.room.findFirst({
            where: { id: roomId, hotelId }
        });
        if (!room) throw new NotFoundException("Chambre introuvable dans votre établissement.");

        // logique restriction after 18h(DAY_USE)
        const now = new Date();
        const currentHour = now.getHours();

            if(data.stayType === StayType.DAY_USE){
                //&& userRole !== 'SUPER_ADMIN' later
                const isAdminOrManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');
                if((currentHour <8 || currentHour >= 18) && !isAdminOrManager) {
                    throw new ForbiddenException("(passage) Accès verouillé après 18h ,contactez le Manager pour approbation");
                }
            }

        return this.prisma.$transaction(async (tx) =>{

            const folio = await tx.folio.create({
               data: {
                hotelId: hotelId,
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

    async checkOut(folioId: number, hotelId: number) {
        return this.prisma.$transaction(async (tx) => {
            const folio = await tx.folio.findFirst({
                where: { id: folioId, room: { hotelId } },
                include: { room: true } // prix de la chambre (we need price)
            });

            if (!folio) throw new NotFoundException('Folio non trouvé');
            if (folio.status === FolioStatus.CHECK_OUT) throw new ForbiddenException('Ce check-out a déjà été effectué.');

            const now = new Date(); 
            const billDetails = await this.calculateTotal(folio.checkIn, now, folio.stayType, folio.room.price, hotelId, folio.isOverTimeWaived);

            const updatedFolio = await tx.folio.update({
                where: { id: folioId },
                data: { status: FolioStatus.CHECK_OUT,
                        checkOut: now,
                        totalBill: new Decimal (billDetails.totalToPayUsd) // stockage de devise de reference Usd
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

    // Annulation Penalité
    async waiveOvertime(folioId: number, managerName: string, reason: string, hotelId: number) {
        // on utilise une transaction globale
        return this.prisma.$transaction(async (tx) => {
            const folio = await this.prisma.folio.findFirst({
                where: { id: folioId, room: { hotelId }},
                include: { room: true }
            });

            if(!folio) throw new NotFoundException('FOLIO non touvé');
            if(!reason || reason.trim().length < 4) {
                throw new ForbiddenException("Une justification d'au moins 4 caractères est obligatoire pour l'audit comptable.")
            }

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

            // 2. Calculer le montant basé sur l'état de clôture (déjà check-out ou non)
            const targetCheckOutTime = folio.status === FolioStatus.CHECK_OUT ? folio.checkOut! : new Date();

            const newBillDetails = await this.calculateTotal(
                updatedFolio.checkIn,
                targetCheckOutTime,
                updatedFolio.stayType,
                folio.room.price,
                hotelId,
                true // Forcé à true car on vient de le valider
            );

            //3. on ecrit un nouveau montant corrigé et gelé
            const finalFolio = await tx.folio.update({
                where: { id: folioId },
                data: { totalBill: new Decimal (newBillDetails.totalToPayUsd) }
            });

            return {
                message: folio.status === FolioStatus.CHECK_OUT 
                    ? "Pénalité annulée après clôture par le Manager. Montant gelé mis à jour."
                    : "Pénalité annulée avant clôture. Le montant au check-out n'inclura pas d'overtime.",
                ancienMontantUSD: folio.totalBill,
                nouveauMontantUSD: newBillDetails.totalToPayUsd,
                justification: reason,
                auditSignature: managerName,
                details: finalFolio
            };
        });
    }

    //VALIDATION Mènage (HK)
    async validateCleaning(roomId: number, hotelId: number) {
        // Validation d'existence et de propriété avant la modification
        const room = await this.prisma.room.findFirst({
            where: { id: roomId, hotelId }
        });
        if (!room) throw new NotFoundException("Chambre introuvable dans votre établissement.");
        return this.prisma.room.update({
            where: { id: roomId },
            data: { status: RoomStatus.AVAILABLE, 
                    isReady: true, 
                    lastCleanedAt: new Date() },
        });
    }
}
