import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static pool: Pool;

    constructor() {
        // Create : pool de connexion PostgreSQL
    const connectionString = `${process.env.DATABASE_URL}`;
    const pool = new Pool({ connectionString });
        // Create : l'adaptateur Prisma pour pg
    const adapter = new PrismaPg(pool);
    // Je passe l'adaptateur au constructeur parent
  super({ adapter });
    
    PrismaService.pool =pool;

  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('Connexion à PostgreSQL reussie !');
    } catch (error) {
      console.error(
        'Erreur de connexion à la BD:', 
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (PrismaService.pool) {
        await PrismaService.pool.end()
    }
  }
}
