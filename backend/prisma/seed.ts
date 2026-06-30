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

    const TARGET_HOTEL_ID = 1;

  // CONFIG HOTEL : LIGNE UNIQUE : ID: 1
  const hotel = await prisma.hotel.upsert({
    where: { id: TARGET_HOTEL_ID },
    update: {}, //si lhotel existe deja on est touche pas à ses config modifiées par l'Admin
    create : {
      id: TARGET_HOTEL_ID,
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
  console.log(`Hôtel validé : ${hotel.name}`)

  // 1. Création des Rôles de base
  const roles = ['ADMIN', 'CASHIER', 'GENERALCASHIER', 'RECEPTIONIST', 'WAITER', 'STORE_MANAGER','HOUSE_KEEPER','MANAGER', 'CEO']
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    })
  }

  // 2. Création des Catégories de points de vente
  const categories = ['BAR', 'BOUTIQUE / DIVERS', 'COFFEE-SHOP', 'HEBERGEMENT', 'PATISSERIE & BOULANGERIE', 'RESTAURANT', 'SERVICES']
  for (const catName of categories) {
    await prisma.category.upsert({
      where: { hotelId_name: { hotelId: TARGET_HOTEL_ID, name: catName } },
      update: {},
      create: { name: catName, hotelId: TARGET_HOTEL_ID, isActive: true },
    })
  }

  // 3. Création des Modes de Paiement (Ta Solution Dynamique !)
  const payments = [
    { name: 'CASH', category: 'CASH' },
    { name: 'AIRTEL MONEY', category: 'MOBILE' },
    { name: 'ORANGE MONEY', category: 'MOBILE' },
    { name: 'M-PESA', category: 'MOBILE' },
    { name: 'VISA', category: 'CARD' },
    { name: 'MASTERCARD', category: 'CARD' },

    { name: 'CREDIT', category: 'DEBT' },
    { name: 'MANAGEMENT', category: 'OFFICER' }
  ];
  for (const p of payments) {
    await prisma.paymentMethod.upsert({
      where: { hotelId_name: { hotelId: TARGET_HOTEL_ID, name: p.name } },
      update: { category: p.category },
      create: { name: p.name, category: p.category, hotelId: TARGET_HOTEL_ID },
    })
  }

  console.log('Bien! Données de base (Rôles, Catégories, Paiements) insérées avec succes!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  })