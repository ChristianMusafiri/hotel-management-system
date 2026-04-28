import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth') // les routes commecent avec auth
export class AuthController {
    constructor(private readonly authService: AuthService){}
    @Post('login') // Route : POST /auth/login
    @HttpCode(HttpStatus.OK) // renvoie 200 ,on se connecte
    async login(@Body() loginDto : LoginDto){
        return this.authService.validateUser(loginDto)
    }
    @Post('register') // Route : POST /auth/register
    async register(@Body() registerDto : RegisterDto){
        return this.authService.register(registerDto);
    }
}
