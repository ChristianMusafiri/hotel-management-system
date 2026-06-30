import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GuestStatus, FolioStatus, PortalStatus } from '@prisma/client'

@Injectable()
export class GuestService {
    constructor(private prisma: PrismaService) {}
    // FLUX CLIENT (QR CODE)
    // Auto-enregistrement par le client depuis son smartphone lors du check-in

    async createSelfRegisteredGuest(hotelId: number, guestData: any) {
        // Validation minimale coté Server
        if(!guestData.firstName || !guestData.lastName || !guestData.email) {
            throw new BadRequestException("Le Nom, PostNom et l'address mail sont obligatoires");
        }

        // On lance la vérification des risques de recouvrement
        const riskAnalysis = await this.checkCollectionRisk(
            hotelId, 
            guestData.email, 
            guestData.phone, 
            guestData.idCardNumber
        );

        return this.prisma.guest.create({
            data: {
                hotelId: hotelId,
                title: guestData.title || '-', // Obligatoire dans ton schéma
                name: guestData.name || `${guestData.firstName} ${guestData.lastName}`,
                firstName: guestData.firstName,
                lastName: guestData.lastName,
                dob: guestData.dob ? new Date(guestData.dob) : null,
                nationality: guestData.nationality,
                idCardNumber: guestData.idCardNumber,
                placeOfIssue: guestData.placeOfIssue,
                dateOfIssue: guestData.dateOfIssue ? new Date(guestData.dateOfIssue) : null,
                dateOfExpiry: guestData.dateOfExpiry ? new Date(guestData.dateOfExpiry) : null,
                address: guestData.address,
                city: guestData.city,
                country: guestData.country,
                phone:guestData.phone,
                email:guestData.email,
                password: guestData.password || 'CM212123456789', // Requis par ton schéma
                portalStatus: PortalStatus.PENDING_VALIDATION,

                // SI UN RISQUE EST DÉTECTÉ : On lève le drapeau de sécurité
                isMatchPerfect: riskAnalysis.isRisk,
                creditStatus: riskAnalysis.isRisk ? 'DEBTOR' : 'GOOD'
            }
        });
    }

    // FLUX RÉCEPTION / RECOUVREMENT
    // Validation manuelle de la fiche client et liaison avec le Folio de la chambre
    async ValidateGuestAndAssignToFolio(guestId: number,folioId: number, receptionistName: string, hotelId: number) {
        return this.prisma.$transaction(async (tx) => {
            // verification si la fiche clien existe et sil f aprti de l'hotel
            const guest = await tx.guest.findFirst({ where: { id: guestId, hotelId } });
            if(!guest) throw new ForbiddenException("fiche client introuvable.");

            // Verification si le Folio existe, est ouvert (CHECKED_IN) et sil f parti de l'hotel
            const folio = await tx.folio.findFirst({
                where: { id: folioId, hotelId, status: FolioStatus.CHECKED_IN }
            });
            if(!folio) throw new NotFoundException("Folio actif introuvable pour cette chambre.");

            // Mettre à jour la fiche du client : Statut passe à VALIDATED + Signature de l'agent
            const validatedGuest = await tx.guest.update({
                where: { id: guestId },
                data: { 
                    portalStatus: PortalStatus.ACTIVE,
                    validatedBy: receptionistName,
                    validatedAt: new Date()
                }
            });

            // Rattachement officiel du Guest validé au Folio de la chambre
            const updatedFolio = await tx.folio.update({
                where: { id: folioId },
                data: {
                    guestId: validatedGuest.id,
                    // Optionnel : On peut aussi synchroniser le guestName du folio avec le vrai nom nettoyé
                    guestName: `${validatedGuest.firstName} ${validatedGuest.lastName.toUpperCase()}`
                }
            });

            return {
                message: "Fiche client vérifiée et rattachée au séjour avec succès.",
                guest: validatedGuest,
                folio: updatedFolio
            };
        });
    }

    // LOGIQUE TABLEAU DE BORD (ALERTE RÉCEPTION)
    // Récupération de toutes les fiches en attente de validation pour l'établissement
    
    async getPendingGuests(hotelId: number) {
        return this.prisma.guest.findMany({
            where: {
                hotelId,
                portalStatus: PortalStatus.PENDING_VALIDATION
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // LOGIQUE DE RAPPROCHEMENT (ANTI-DETTES)
    //Analyse les données soumises par le QR code pour détecter un client débiteur connu
    async checkCollectionRisk(
        hotelId: number,
        email: string, 
        phone: string, 
        idCardNumber: string
    ) : Promise<{ isRisk: boolean; reason: string | null }> {

        // Recherche d'un doublon sur les critères uniques ou semi-uniques
        const existingGuest = await this.prisma.guest.findFirst({
            where: {
                hotelId,
                OR: [
                    { email: email },
                    phone ? { phone: phone } : {},
                    idCardNumber ? { idCardNumber: idCardNumber } : {}
                ]
            }
        });

        // Si aucun client trouvé, aucun risque détecté
        if(!existingGuest) {
            return { isRisk: false, reason: null };
        }

        // Si un client existe, on vérifie sa santé financière dans ton système
        const isDebtor = existingGuest.creditStatus === 'DEBTOR'  || Number(existingGuest.accountBalance) < 0;

        if(isDebtor) {
            return {
                isRisk: true,
                reason: `ATTENTION : Ce client possède déjà un compte débiteur (Solde : ${existingGuest.accountBalance} USD). Statut : ${existingGuest.creditStatus}.`
            };
        }

        return { isRisk: false, reason: "Client existant trouvé, dossier financier en règle." };
    }

    //FUSION DE COMPTES DE RECOUVREMENT (PROFILE MERGING)
    //Permettre de lier un faux compte créé par ruse au vrai compte débiteur
    async mergeDuplicateGuests(
        masterGuestId: number,
        duplicateGuestId: number,
        collectorName: string,
        reason: string,
        hotelId: number
    ) {
        if(!reason || reason.trim().length < 15) { throw new BadRequestException("Une justification détaillée d'au moins 15 caractères est obligatoire pour l'audit de recouvrement."); }

        return this.prisma.$transaction(async (tx) => {
            // on récupere le vrai compte (Master)
            const masterGuest = await tx.guest.findFirst({
                where: { id: masterGuestId, hotelId }
            });

            // on récupere le compte doublon (Duplicate)
            const duplicateGuest = await tx.guest.findFirst({
                where: { id: duplicateGuestId, hotelId }
            });

            if (!masterGuest || !duplicateGuest) {
                throw new NotFoundException("L'un des profils clients (ou les deux) n'existe pas dans cet établissement.");
            }

            if (masterGuestId === duplicateGuestId) {
                throw new BadRequestException("Impossible de fusionner un profil avec lui-même.");
            }

            // on récuperer tous les folios liés au faux compte
            const duplicateFolios = await tx.folio.findMany({
                where: { guestId: duplicateGuestId }
            });

            // TRANSFER = folios du faux compte vers le vrai compte
            if (duplicateFolios.length > 0) {
                await tx.folio.updateMany({
                    where: { guestId: duplicateGuestId },
                    data: { 
                        guestId: masterGuestId,
                        // On harmonise le nom affiché sur le folio avec le vrai nom officiel
                        guestName: `${masterGuest.firstName} ${masterGuest.lastName.toUpperCase()}`
                    }
                });
            }

            // 5. AJUSTEMENT = BALANCES (Si le faux compte avait laissé un acompte ou une autre dette)
            const newBalance = Number(masterGuest.accountBalance) + Number(duplicateGuest.accountBalance);

            await tx.guest.update({
                where: { id: masterGuestId },
                data: {
                    accountBalance: newBalance,
                    creditStatus: 'DEBTOR', // On s'assure qu'il reste marqué comme débiteur si la balance est négative
                    // On peut optionnellement stocker les anciennes fausses infos dans un champ note pour l'historique
                    contractNumber: masterGuest.contractNumber || duplicateGuest.contractNumber
                }
            });

            // DÉSACTIVATION = FAUX COMPTE pour qu'il ne puisse plus se connecter ou être utilisé
            await tx.guest.update({
                where: { id: duplicateGuestId },
                data: {
                    portalStatus: PortalStatus.SUSPENDED,
                    creditStatus: GuestStatus.SUSPENDED,
                    accountBalance: 0 // Vidé car transféré au master
                }
            });

            // RENVOIE = RAPPORT D'AUDIT (Pour le Boss)
            return {
                success: true,
                message: "Fusion et rapprochement de sécurité effectués avec succès.",
                auditLog: {
                    action: "GUEST_PROFILE_MERGE(FUSION)",
                    executeBy: collectorName,
                    executedAt: new Date(),
                    justification: reason,
                    impact: {
                        foliosMigratedCount: duplicateFolios.length,
                        masterProfile: {
                            id: masterGuest.id,
                            name: `${masterGuest.firstName} ${masterGuest.lastName}`,
                            previousBalance: masterGuest.accountBalance,
                            finalBalance: newBalance
                        },
                        fraudulentProfileHandled: {
                            id: duplicateGuest.id,
                            name: `${duplicateGuest.firstName} ${duplicateGuest.lastName}`,
                            usedEmail: duplicateGuest.email,
                            usedPhone: duplicateGuest.phone,
                            previousBalance: duplicateGuest.accountBalance
                        }
                    }
                }
            }
        });
    }

    //DÉFUSION DE COMPTES (UNMERGE PROFILE)
    //Annule une fusion erronée en réassignant les folios et les balances d'origine
    async unmergeGuests(
        masterGuestId: number, 
        duplicateGuestId: number, 
        collectorName: string, 
        reason: string,
        hotelId: number
    ){
        if (!reason || reason.trim().length < 15) {
            throw new BadRequestException("Une justification d'au moins 15 caractères est obligatoire pour annuler une fusion.");
        }

        return this.prisma.$transaction(async (tx) => {
        // on récuperer les deux profils
            const masterGuest = await tx.guest.findFirst({where: { id: masterGuestId, hotelId } });

            const duplicateGuest = await tx.guest.findFirst({ where: { id: duplicateGuestId, hotelId } });

            if (!masterGuest || !duplicateGuest) { throw new NotFoundException("Profils introuvables."); }

            // on trouve les folios qui appartenaient au duplicateGuest d'origine.
            // Pour être ultra-précis, on cherche les folios dont le 'guestName' correspondait au nom du duplicate
            const foliosToRestore = await tx.folio.findMany({
                where: {
                    guestId: masterGuestId,
                    guestName: {
                        contains: duplicateGuest.firstName,
                        mode: 'insensitive'
                    }
                }
            });

            // on réassigne ces folios au compte d'origine (Duplicate)
            if (foliosToRestore.length > 0) {
                await tx.folio.updateMany({
                    where: {
                        id: { in: foliosToRestore.map(f => f.id) }
                    },
                    data: {
                        guestId: duplicateGuestId,
                        guestName: `${duplicateGuest.firstName} ${duplicateGuest.lastName.toUpperCase()}`
                    }
                });
            }

            // on fait sortir le compte doublon de son état suspendu
            await tx.guest.update({
                where: { id: duplicateGuestId },
                data: {
                    portalStatus: PortalStatus.PENDING_VALIDATION,
                    creditStatus: GuestStatus.GOOD,
                    // Si la balance exacte à détacher est connue, on la soustraire du master et la remettre ici
                }
            });

            // on génere le rapport d'audit pour le Boss
            return {
                success: true,
                message: "Annulation de fusion (Défusion) validée.",
                auditLog: {
                    action: "GUEST_PROFILE_UNMERGE(DEFUSION)",
                    executedBy: collectorName,
                    executedAt: new Date(),
                    justification: reason,
                    impact: {
                        foliosRestoredCount: foliosToRestore.length,
                        masterProfileRestored: { id: masterGuestId, name: masterGuest.name },
                        duplicateProfileReactivated: { id: duplicateGuestId, name: duplicateGuest.name }
                    }
                }
            };
        });
    }
}
