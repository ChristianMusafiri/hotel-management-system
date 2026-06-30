import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdjustStaffBalanceDto } from './dto/adjust-credit.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService){} // injecte prisma ds le constructeur
  
  create(createUserDto: CreateUserDto) {
    return 'Utilisez la route auth/register';
  }
  //methode ASSIGNROLE
  async assignRole(userId: number, roleName: string) {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName },
    });

    if(!role) {
      throw new Error(`Le role ${roleName} n'existe pas. Crees-le d'abord.`);
    }

    return await this.prisma.userRole.create({
      data: {
        userId: userId,
        roleId: role.id,
      },
      include:{ role: true }
    })
  }
 // findAll : voir tous les users
  async findAll() {
    return await this.prisma.user.findMany({
      select: {
        // tout ce qui est selectionné est affiché; ici on ignore password
        id: true, 
        name: true, 
        username: true, 
        email: true, 
        staffCreditLimit: true,       // Affiché sur le tableau de bord Manager
        staffBalance: true,           // Affiché sur le tableau de bord Manager
        createdAt: true,
        //inclu roles
        roles: { include: { role: true } } 
      }
    });
  }
  // pour voir un user precis
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        staffCreditLimit: true,
        staffBalance: true,
        createdAt: true,
        roles: { include: { role: true } }
      }
    });
    if (!user) throw new NotFoundException(`Utilisateur #${id} introuvable`);
    return user;
  }

  // Mettre à jour le profil ou le crédit d'un agent
  async update(id: number, updateUserDto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  // ROUTE COMPTABLE : Apurement ou Ajustement de la dette d'un agent
  // Génère un rapport d'audit obligatoire pour le Boss
  async settleStaffBalance(userId: number, dto: AdjustStaffBalanceDto) {
    return await this.prisma.$transaction(async (tx) => {
      // on récupere l'état actuel de l'agent
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(`Employé #${userId} introuvable`);

      const currentBalance = Number(user.staffBalance);
      
      if (currentBalance <= 0) {
        throw new Error("Cet employé n'a aucune dette active à rembourser.");
      }

      // on calcule la nouvelle balance après paiement
      let newBalance = currentBalance - dto.amount;
      if (newBalance < 0) {
        throw new Error(`Montant trop élevé. L'agent ne doit que ${currentBalance} USD.`);
      }

      // Application de la modification en base de données
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { staffBalance: newBalance }
      });

      // on renvoye le rapport d'audit pour le Boss
      return {
        success: true,
        message: "Opération financière comptabilisée avec succès.",
        auditLog: {
          action: "STAFF_BALANCE_SETTLEMENT",
          executedBy: dto.validatedBy,
          executedAt: new Date(),
          justification: dto.reason,
          financialImpact: {
            employee: user.name,
            username: user.username,
            previousDebt: currentBalance,
            amountPaid: dto.amount,
            remainingDebt: newBalance,
          }
        }
      };
    });
  }

  // RH / SÉCURITÉ : Activer, Suspendre ou Désactiver un employé
  // Génère un rapport d'audit pour la direction
  async updateStatus(userId: number, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED', changedBy: string, reason: string) {
    if (!reason || reason.trim().length < 10) {
      throw new Error("Une justification d'au moins 10 caractères est obligatoire pour modifier le statut d'un agent.");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`Employé #${userId} introuvable`);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: status },
      select: {
        id: true,
        name: true,
        username: true,
        status: true,
        staffBalance: true
      }
    });

    // Rapport d'audit généré instantanément pour le Boss
    return {
      success: true,
      message: `Le statut de l'employé a été modifié avec succès vers [${status}].`,
      auditLog: {
        action: "STAFF_STATUS_CHANGE",
        executedBy: changedBy,
        executedAt: new Date(),
        justification: reason,
        impact: {
          employee: updatedUser.name,
          username: updatedUser.username,
          newStatus: updatedUser.status,
          currentDebtToClear: updatedUser.staffBalance // Le boss voit directement s'il part avec une dette !
        }
      }
    };
  }
}
