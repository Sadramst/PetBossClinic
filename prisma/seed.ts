import { PrismaClient } from '@prisma/client';
// import fs from 'fs';
// import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with initial data...');
  // TODO(phase-1): Parse scaffold/seed-data.md and insert into database
  
  // Create default theme preset based on brand
  await prisma.themePreset.upsert({
    where: { name: 'gold-charcoal' },
    update: {},
    create: {
      name: 'gold-charcoal',
      tokens: {
        colors: {
          primary: '#C9A227',
          secondary: '#3A3D42',
          accent: '#E4C97E',
          surface: '#F5F5F3',
          background: '#FFFFFF',
          darkBackground: '#22252A'
        }
      }
    }
  });

  console.log('Database seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
