import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Si une clé spécifique est demandée (ex: @GetUser('hotelId')), on retourne uniquement cette propriété
    if (data) {
      return user ? user[data] : undefined;
    }

    // Sinon, on retourne l'objet user complet
    return user;
  },
);