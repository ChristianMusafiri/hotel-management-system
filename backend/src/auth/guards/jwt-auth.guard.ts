import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if(!token) {
            throw new UnauthorizedException('Badge non reconnu -tkn-')
        }

        try {
            // verification token, decodage payload
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET
            });

            // attache les infos user pour les utiliser apres
            request['user'] = payload;
        }  
        catch{
            throw new UnauthorizedException('Badge invalide ou expiré');
        }
        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const authHeader = request.headers.authorization;
        if (!authHeader) 
            return undefined;

        // On sépare explicitement pour rassurer TypeScript
        const parts = authHeader.split(' ');
        if (parts.length !== 2) 
            return undefined;

        const [type, token] = parts;
        return type === 'Bearer' ? token : undefined;
}
}