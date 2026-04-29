import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';// import Service 
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt'; //import related to token

import { Prisma } from '@prisma/client'; //Prisma

// type qui inclut les roles pour rassurer Typescript
type UserWithRoles = Prisma.UserGetPayload<{
    include: { roles: { include: { role: true } } }
}>;

@Injectable()
export class AuthService {
    // NestJS injecte automatiquement PrismaService
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService, //Injecte le service JWT
    ) {}

    // ajout related to token: JwtService
    async login(loginDto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { username: loginDto.username },
            include: { roles: { include: { role: true } } }
        }) as UserWithRoles | null; // best way to make typescript in confidence that include is in the Prisma request

        if (!user) throw new UnauthorizedException('Identifiants invalides');
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) throw new UnauthorizedException('Identifiants invalides');
        //
        const userRoles = user.roles.map(ur => ur.role.name);

        //donnees badge = payload
        const payload = {
            sub: user.id,
            username: user.username,
            roles: userRoles
        };

        return {
            access_token: await this.jwtService.signAsync(payload),
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                roles: userRoles
            },
        };
    } 

    //Methode pour enregistrer l'utilisateur 
    async register(registerDto: RegisterDto){
        const { username, password, name, email } = registerDto;

        const userExists = await this.prisma.user.findUnique({
            where: { username },
        });
        if(userExists){
            throw new ConflictException("ce nom d'utilisateur existe deja")
        }

        const hashedPassword = await bcrypt.hash(password,10);
        const newUser = await this.prisma.user.create({
            data: {
                username,
                name,
                email: email || null, // flexible en cas dajout du mail apres,for now, if undefined , on stocke null
                password: hashedPassword,
            },
        });

        // si tout est bon 
        const { password: _, ...result } = newUser;
        return result;
    }

    //Methode pour verifier l'utilisateur au login
    async validateUser(loginDto: LoginDto){
        const { username, password } = loginDto;

        //on cherche lutilisateur par son username
        const user = await this.prisma.user.findUnique({
            where: { username },
        });
        // Si l'utilisateur n'existe pas, erreur 401
        if (!user) {
            throw new UnauthorizedException('Identifiants incorrects');
        }
        // comparer le mot de passe (cripter bd)
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch) {
            throw new UnauthorizedException('Identifiants incorrects');
        }

        // si tout est bon 
        const { password: _, ...result } = user;
        return result;
    }
}
