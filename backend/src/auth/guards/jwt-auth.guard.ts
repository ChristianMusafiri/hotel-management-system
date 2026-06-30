import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {

    canActivate(context: ExecutionContext) {

        return super.canActivate(context);
    }

    handleRequest<TUser = any>(err: any, user: TUser): TUser {
        // Si le token est invalide, expiré ou absent, Passport lève une erreur
        if (err || !user) {
            throw err || new UnauthorizedException('Badge invalide, expiré ou non reconnu');
        }
        return user;
    }
}