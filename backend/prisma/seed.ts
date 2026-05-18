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

  // CONFIG HOTEL : LIGNE UNIQUE : ID: 1
  await prisma.hotel.upsert({
    where: { id: 1 },
    update: {}, //si lhotel existe deja on est touche pas à ses config modifiées par l'Admin
    create : {
      id: 1,
      name: "MON HOTEL - CONFIGURATION GLOBALE",
      timezone: "Africa/Lubumbashi",
      baseCurrency: "USD",
      localCurrency: "CDF",
      currencyExchangeRate: 2300,
      taxeRate: 16,
      checkInHour: 14,
      checkOutHour: 10,
      dayUseMaxHours: 6,
      isPosEnabled: true,
      isStockEnabled: true,
      isHousekeepingEnabled: true,
      isOvertimeDayuseFeeEnabled: true,
      dayUseOvertimeRate: 8,
      dayUseGracePeriodMins: 15,
    },
  });

  // 1. Création des Rôles de base
  const roles = ['ADMIN', 'CASHIER', 'RECEPTIONIST', 'WAITER', 'STORE_MANAGER','HOUSE_KEEPER','MANAGER']
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