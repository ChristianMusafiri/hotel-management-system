import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; //import ValidationPipe

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    //activation de la validation automatique
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // supprime les donnees qui ne sont pas dans le DTO
    forbidNonWhitelisted: true, //Rejet de la requete de donnees inconnues
    transform: true, // transform les types automatiqument
  })
  );

  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
