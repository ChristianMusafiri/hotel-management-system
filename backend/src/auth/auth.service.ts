import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';// import Service 
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
    // NestJS injecte automatiquement PrismaService
    constructor(private prisma: PrismaService) {}

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
