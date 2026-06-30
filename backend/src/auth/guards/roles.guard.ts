// ici on facilite la lecture de badge et la verification de grade employé

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate{
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        // role definis via deco @Roles
        const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles) 
            return true; // sans restriction on laisse passer

        // utilisateur injecté via JwtAuthGuard
        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.roles) return false;

        // Extraction flexible des rôles (gère ['ADMIN'] ou [{ role: { name: 'ADMIN' } }])
        const userRoleNames: string[] = user.roles.map((r: any) => {
            if (typeof r === 'string') return r;
            if (r?.role?.name) return r.role.name; // Format Prisma relation
            if (r?.name) return r.name;
            return '';
        });

        // verification if user a un des roles requis
        const hasRole = userRoleNames.some(roleName => requiredRoles.includes(roleName));
        
        if (!hasRole){
            throw new ForbiddenException("Accès refusé : contactez l'administrateur pour y acceder");
        }

        return true;
    }
}