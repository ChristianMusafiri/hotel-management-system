import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){
    constructor(private configService: ConfigService){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            //ici on recupere la cle via ConfigService
            secretOrKey: configService.get<string> ('JWT_SECRET') as string, 
        });
    }
    async validate(payload: any){
        // return mis dans request.user
        return {
            id: payload.sub,
            username: payload.username,
            name: payload.name || payload.username,
            hotelId: payload.hotelId,
            roles: payload.roles // role transmis au guard
        }
    }
}