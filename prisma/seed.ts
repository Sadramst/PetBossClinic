import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Clean up
  await prisma.service.deleteMany()
  await prisma.staff.deleteMany()

  // Seed Staff
  const drAhmadi = await prisma.staff.create({
    data: {
      nameFa: 'دکتر احمدی',
      nameEn: 'Dr. Ahmadi',
      titleFa: 'دامپزشک ارشد',
      titleEn: 'Senior Veterinarian',
      bioFa: 'دکتر احمدی با بیش از ۱۰ سال سابقه در زمینه جراحی حیوانات خانگی.',
      bioEn: 'Dr. Ahmadi has over 10 years of experience in pet surgery.',
      role: 'VET',
      isActive: true,
      sortOrder: 1,
    }
  })

  // Seed Services
  await prisma.service.createMany({
    data: [
      {
        slugFa: 'veterinary-checkup',
        slugEn: 'veterinary-checkup',
        titleFa: 'معاینه عمومی',
        titleEn: 'General Checkup',
        shortDescFa: 'معاینه کامل سلامت حیوان خانگی شما',
        shortDescEn: 'Complete health checkup for your pet',
        contentFa: 'در این سرویس حیوان شما به طور کامل معاینه می‌شود...',
        contentEn: 'In this service, your pet gets a full medical checkup...',
        isActive: true,
        sortOrder: 1,
      },
      {
        slugFa: 'pet-grooming',
        slugEn: 'pet-grooming',
        titleFa: 'آرایش و شستشو',
        titleEn: 'Pet Grooming',
        shortDescFa: 'شستشو و کوتاهی موی سگ و گربه',
        shortDescEn: 'Washing and haircut for dogs and cats',
        contentFa: 'استفاده از بهترین شامپوها برای سلامت پوست و مو...',
        contentEn: 'Using the best shampoos for skin and hair health...',
        isActive: true,
        sortOrder: 2,
      },
      {
        slugFa: 'dental-care',
        slugEn: 'dental-care',
        titleFa: 'خدمات دندانپزشکی',
        titleEn: 'Dental Care',
        shortDescFa: 'جرم‌گیری و کشیدن دندان',
        shortDescEn: 'Teeth cleaning and extraction',
        contentFa: 'جرم‌گیری دندان حیوانات با دستگاه‌های پیشرفته و بیهوشی ایمن.',
        contentEn: 'Pet dental scaling with advanced devices and safe anesthesia.',
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
