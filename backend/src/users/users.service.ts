import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
        createdAt: true,
        //inclu roles
        roles: { include: { role: true } } 
      }
    });
  }
  // pour voir un user precis
  async findOne(id: number) {
    return await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true} } }
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    return await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return await this.prisma.user.delete({
      where: { id },
    });
  }
}
