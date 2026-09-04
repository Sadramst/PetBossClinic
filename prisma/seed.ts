import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Clean up
  await prisma.service.deleteMany()
  await prisma.division.deleteMany()
  await prisma.staffMember.deleteMany()

  // Seed Division
  const clinicDiv = await prisma.division.create({
    data: {
      slugFa: 'clinic',
      slugEn: 'clinic',
      nameFa: 'کلینیک دامپزشکی',
      nameEn: 'Veterinary Clinic',
      descriptionFa: 'بخش اصلی خدمات درمانی حیوانات',
      isActive: true,
      sortOrder: 1,
    }
  })

  // Seed Staff
  const drAhmadi = await prisma.staffMember.create({
    data: {
      nameFa: 'دکتر احمدی',
      nameEn: 'Dr. Ahmadi',
      titleFa: 'دامپزشک ارشد',
      titleEn: 'Senior Veterinarian',
      bioFa: 'دکتر احمدی با بیش از ۱۰ سال سابقه در زمینه جراحی حیوانات خانگی.',
      bioEn: 'Dr. Ahmadi has over 10 years of experience in pet surgery.',
      isActive: true,
      sortOrder: 1,
    }
  })

  // Seed Services
  await prisma.service.createMany({
    data: [
      {
        divisionId: clinicDiv.id,
        slugFa: 'veterinary-checkup',
        slugEn: 'veterinary-checkup',
        nameFa: 'معاینه عمومی',
        nameEn: 'General Checkup',
        descriptionFa: 'در این سرویس حیوان شما به طور کامل معاینه می‌شود...',
        descriptionEn: 'In this service, your pet gets a full medical checkup...',
        isActive: true,
        sortOrder: 1,
      },
      {
        divisionId: clinicDiv.id,
        slugFa: 'pet-grooming',
        slugEn: 'pet-grooming',
        nameFa: 'آرایش و شستشو',
        nameEn: 'Pet Grooming',
        descriptionFa: 'استفاده از بهترین شامپوها برای سلامت پوست و مو...',
        descriptionEn: 'Using the best shampoos for skin and hair health...',
        isActive: true,
        sortOrder: 2,
      },
      {
        divisionId: clinicDiv.id,
        slugFa: 'dental-care',
        slugEn: 'dental-care',
        nameFa: 'خدمات دندانپزشکی',
        nameEn: 'Dental Care',
        descriptionFa: 'جرم‌گیری دندان حیوانات با دستگاه‌های پیشرفته و بیهوشی ایمن.',
        descriptionEn: 'Pet dental scaling with advanced devices and safe anesthesia.',
        isActive: true,
        sortOrder: 3,
      }
    ]
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
