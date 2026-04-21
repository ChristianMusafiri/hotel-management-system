import { PrismaClient } from '@prisma/client'
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient(
  { adapter }
);

async function main() {
    console.log('Connexion établie ! Début du remplissage...')
  // 1. Création des Rôles de base
  const roles = ['ADMIN', 'CASHIER', 'RECEPTIONIST', 'WAITER', 'STORE_MANAGER']
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
  }

  // 2. Création des Catégories de points de vente
  const categories = ['BAR', 'RESTAURANT', 'HEBERGEMENT', 'DIVERS']
  for (const catName of categories) {
    await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName },
    })
  }

  // 3. Création des Modes de Paiement (Ta Solution Dynamique !)
  const payments = [
    { name: 'CASH', category: 'CASH' },
    { name: 'AIRTEL MONEY', category: 'MOBILE' },
    { name: 'ORANGE MONEY', category: 'MOBILE' },
    { name: 'M-PESA', category: 'MOBILE' },
    { name: 'VISA', category: 'CARD' },
    { name: 'MASTERCARD', category: 'CARD' }
  ];
  for (const p of payments) {
    await prisma.paymentMethod.upsert({
      where: { name: p.name },
      update: { category: p.category },
      create: { name: p.name, category: p.category },
    })
  }

  console.log('Bien!   Données de base (Rôles, Catégories, Paiements) insérées avec succes!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  })