import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // ─── Clean up (reverse dependency order) ─────────────
  await prisma.faq.deleteMany()
  await prisma.faqCategory.deleteMany()
  await prisma.testimonial.deleteMany()
  await prisma.service.deleteMany()
  await prisma.division.deleteMany()
  await prisma.staffMember.deleteMany()
  await prisma.socialLink.deleteMany()
  await prisma.contactChannel.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.workingHour.deleteMany()

  // ─── Divisions ─────────────────────────────────────────
  const divClinic = await prisma.division.create({
    data: {
      slugFa: 'بخش-درمانی',
      slugEn: 'clinical',
      nameFa: 'بخش درمانی، داخلی و جراحی',
      nameEn: 'Clinical, Internal Medicine & Surgery',
      descriptionFa: 'ارائه خدمات تخصصی درمان، جراحی بافت نرم و سخت، ارتوپدی، واکسیناسیون و بیماری‌های داخلی حیوانات خانگی.',
      descriptionEn: 'Specialized veterinary treatment services including soft and hard tissue surgery, orthopedics, vaccination and internal medicine.',
      isActive: true,
      sortOrder: 1,
    }
  })

  const divGrooming = await prisma.division.create({
    data: {
      slugFa: 'گرومینگ',
      slugEn: 'grooming',
      nameFa: 'بخش آرایش، شست‌وشو و بهداشت (گرومینگ)',
      nameEn: 'Grooming & Hygiene',
      descriptionFa: 'خدمات حرفه‌ای آرایش، شست‌وشو، ناخن‌گیری و حمام ضدانگل برای سگ و گربه.',
      descriptionEn: 'Professional grooming, bathing, nail trimming, and anti-parasite bathing for dogs and cats.',
      isActive: true,
      sortOrder: 2,
    }
  })

  const divShop = await prisma.division.create({
    data: {
      slugFa: 'پت-شاپ',
      slugEn: 'pet-shop',
      nameFa: 'پت‌شاپ',
      nameEn: 'Pet Shop',
      descriptionFa: 'فروش غذای خشک و کنسرو، لوازم بهداشتی، باکس حمل، لباس، قلاده و خاک گربه از بهترین برندها.',
      descriptionEn: 'Quality dry food, canned food, hygiene products, carriers, clothing, collars, and cat litter from top brands.',
      isActive: true,
      sortOrder: 3,
    }
  })

  // ─── Services — Clinical ──────────────────────────────
  await prisma.service.createMany({
    data: [
      {
        divisionId: divClinic.id,
        slugFa: 'واکسیناسیون',
        slugEn: 'vaccination',
        nameFa: 'واکسیناسیون سگ و گربه',
        nameEn: 'Dog & Cat Vaccination',
        descriptionFa: 'واکسیناسیون کامل سگ و گربه شامل واکسن‌های چندگانه، هاری و واکسن‌های تقویتی سالانه با استفاده از واکسن‌های وارداتی معتبر.',
        descriptionEn: 'Complete vaccination for dogs and cats including multi-valent, rabies and annual booster vaccines using trusted imported vaccines.',
        priceFrom: 500000,
        priceTo: 2500000,
        priceNoteFa: 'بسته به نوع واکسن',
        priceNoteEn: 'Depends on vaccine type',
        isActive: true,
        sortOrder: 1,
      },
      {
        divisionId: divClinic.id,
        slugFa: 'بیماری-داخلی',
        slugEn: 'internal-medicine',
        nameFa: 'بیماری‌های داخلی و درمان',
        nameEn: 'Internal Medicine & Treatment',
        descriptionFa: 'تشخیص و درمان بیماری‌های داخلی حیوانات خانگی شامل بیماری‌های گوارشی، تنفسی، کلیوی و کبدی با استفاده از تجهیزات مدرن.',
        descriptionEn: 'Diagnosis and treatment of internal diseases including gastrointestinal, respiratory, renal and hepatic disorders using modern equipment.',
        priceFrom: 800000,
        priceTo: 5000000,
        priceNoteFa: 'بسته به نوع بیماری',
        isActive: true,
        sortOrder: 2,
      },
      {
        divisionId: divClinic.id,
        slugFa: 'انگل-درمانی',
        slugEn: 'parasite-therapy',
        nameFa: 'انگل‌درمانی',
        nameEn: 'Parasite Therapy',
        descriptionFa: 'درمان انواع انگل‌های داخلی و خارجی سگ و گربه شامل کرم‌ها، کنه‌ها و شپش با داروهای مؤثر و ایمن.',
        descriptionEn: 'Treatment of internal and external parasites in dogs and cats including worms, ticks and lice with effective, safe medications.',
        priceFrom: 300000,
        priceTo: 1500000,
        isActive: true,
        sortOrder: 3,
      },
      {
        divisionId: divClinic.id,
        slugFa: 'جراحی-بافت-نرم',
        slugEn: 'soft-tissue-surgery',
        nameFa: 'جراحی بافت نرم',
        nameEn: 'Soft Tissue Surgery',
        descriptionFa: 'جراحی‌های بافت نرم شامل عقیم‌سازی، برداشت تومور، جراحی شکمی و جراحی‌های عمومی با بیهوشی ایمن.',
        descriptionEn: 'Soft tissue surgeries including spaying/neutering, tumor removal, abdominal surgery and general procedures with safe anesthesia.',
        priceFrom: 3000000,
        priceTo: 15000000,
        priceNoteFa: 'بسته به نوع جراحی — تماس بگیرید',
        isActive: true,
        sortOrder: 4,
      },
      {
        divisionId: divClinic.id,
        slugFa: 'جراحی-بافت-سخت',
        slugEn: 'hard-tissue-surgery',
        nameFa: 'جراحی بافت سخت',
        nameEn: 'Hard Tissue Surgery',
        descriptionFa: 'جراحی‌های بافت سخت شامل ترمیم شکستگی‌ها، جراحی ستون فقرات و مفاصل با استفاده از پیچ و پلاک تیتانیوم.',
        descriptionEn: 'Hard tissue surgeries including fracture repair, spinal surgery and joint procedures using titanium screws and plates.',
        priceFrom: 5000000,
        priceTo: 25000000,
        priceNoteFa: 'تماس بگیرید',
        isActive: true,
        sortOrder: 5,
      },
      {
        divisionId: divClinic.id,
        slugFa: 'ارتوپدی',
        slugEn: 'orthopedics',
        nameFa: 'ارتوپدی حیوانات',
        nameEn: 'Veterinary Orthopedics',
        descriptionFa: 'خدمات ارتوپدی شامل درمان دررفتگی کشکک، پارگی رباط صلیبی، دیسپلازی مفصل ران و بیماری‌های استخوان و مفاصل.',
        descriptionEn: 'Orthopedic services including patellar luxation, cruciate ligament tear, hip dysplasia and bone/joint diseases.',
        priceFrom: 5000000,
        priceTo: 30000000,
        priceNoteFa: 'تماس بگیرید',
        isActive: true,
        sortOrder: 6,
      },
    ]
  })

  // ─── Services — Grooming ──────────────────────────────
  await prisma.service.createMany({
    data: [
      {
        divisionId: divGrooming.id,
        slugFa: 'آرایش-سگ-گربه',
        slugEn: 'pet-grooming',
        nameFa: 'اصلاح و آرایش سگ و گربه',
        nameEn: 'Dog & Cat Grooming',
        descriptionFa: 'اصلاح و آرایش حرفه‌ای سگ و گربه با توجه به استاندارد هر نژاد، شامل کوتاه‌کردن و مدل‌دهی به مو.',
        descriptionEn: 'Professional breed-standard grooming for dogs and cats including haircut and styling.',
        priceFrom: 500000,
        priceTo: 3000000,
        priceNoteFa: 'بسته به نژاد و اندازه',
        isActive: true,
        sortOrder: 1,
      },
      {
        divisionId: divGrooming.id,
        slugFa: 'شستشو-حمام',
        slugEn: 'bathing',
        nameFa: 'شست‌وشو و حمام',
        nameEn: 'Bathing & Washing',
        descriptionFa: 'حمام و شست‌وشوی حرفه‌ای با شامپوهای تخصصی مناسب پوست و موی حیوان خانگی شما.',
        descriptionEn: 'Professional bathing with specialized shampoos suitable for your pet\'s skin and coat.',
        priceFrom: 400000,
        priceTo: 1500000,
        isActive: true,
        sortOrder: 2,
      },
      {
        divisionId: divGrooming.id,
        slugFa: 'ناخن-گوش',
        slugEn: 'nail-ear-cleaning',
        nameFa: 'ناخن‌گیری و تمیز کردن گوش',
        nameEn: 'Nail Trimming & Ear Cleaning',
        descriptionFa: 'ناخن‌گیری ایمن و تمیز کردن حرفه‌ای گوش‌ها برای جلوگیری از عفونت.',
        descriptionEn: 'Safe nail trimming and professional ear cleaning to prevent infections.',
        priceFrom: 200000,
        priceTo: 500000,
        isActive: true,
        sortOrder: 3,
      },
      {
        divisionId: divGrooming.id,
        slugFa: 'حمام-ضدانگل',
        slugEn: 'anti-parasite-bath',
        nameFa: 'حمام ضدانگل',
        nameEn: 'Anti-Parasite Bath',
        descriptionFa: 'حمام ضدانگل تخصصی برای از بین بردن کنه‌ها، کک‌ها و شپش با محلول‌های ایمن و مؤثر.',
        descriptionEn: 'Specialized anti-parasite bath to eliminate ticks, fleas and lice with safe, effective solutions.',
        priceFrom: 500000,
        priceTo: 1500000,
        isActive: true,
        sortOrder: 4,
      },
    ]
  })

  // ─── Staff — Placeholder entries (admin-addable) ──────
  await prisma.staffMember.createMany({
    data: [
      {
        nameFa: 'دکتر [نام دامپزشک]',
        nameEn: 'Dr. [Vet Name]',
        titleFa: 'دامپزشک متخصص — جراحی',
        titleEn: 'Veterinary Surgeon',
        bioFa: 'متخصص جراحی بافت نرم و سخت با بیش از ۱۰ سال تجربه در کلینیک‌های معتبر تهران.',
        bioEn: 'Specialist in soft and hard tissue surgery with over 10 years of experience in top Tehran clinics.',
        isActive: true,
        sortOrder: 1,
      },
      {
        nameFa: 'دکتر [نام دامپزشک]',
        nameEn: 'Dr. [Vet Name]',
        titleFa: 'دامپزشک متخصص — بیماری‌های داخلی',
        titleEn: 'Internal Medicine Specialist',
        bioFa: 'فارغ‌التحصیل دانشگاه تهران، متخصص بیماری‌های داخلی و تشخیص با سونوگرافی.',
        bioEn: 'Graduate of University of Tehran, specialist in internal medicine and ultrasound diagnosis.',
        isActive: true,
        sortOrder: 2,
      },
    ]
  })

  // ─── Social Links ──────────────────────────────────────
  await prisma.socialLink.createMany({
    data: [
      { platform: 'INSTAGRAM', url: 'https://instagram.com/petbossclinic', isActive: true, sortOrder: 1 },
      { platform: 'TELEGRAM', url: 'https://t.me/petbossclinic', isActive: true, sortOrder: 2 },
      { platform: 'WHATSAPP', url: 'https://wa.me/989120000000', isActive: true, sortOrder: 3 },
    ]
  })

  // ─── Contact Channels ─────────────────────────────────
  await prisma.contactChannel.createMany({
    data: [
      { type: 'PHONE', value: '+982122000000', labelFa: 'تلفن ثابت', labelEn: 'Landline', isActive: true, sortOrder: 1 },
      { type: 'MOBILE', value: '+989120000000', labelFa: 'موبایل', labelEn: 'Mobile', isActive: true, sortOrder: 2 },
      { type: 'EMAIL', value: 'info@petbossclinic.com', labelFa: 'ایمیل', labelEn: 'Email', isActive: true, sortOrder: 3 },
    ]
  })

  // ─── Working Hours ────────────────────────────────────
  const weekdays = [
    { day: 0, open: '09:00', close: '21:00', label: 'شنبه' },     // Saturday
    { day: 1, open: '09:00', close: '21:00', label: 'یکشنبه' },
    { day: 2, open: '09:00', close: '21:00', label: 'دوشنبه' },
    { day: 3, open: '09:00', close: '21:00', label: 'سه‌شنبه' },
    { day: 4, open: '09:00', close: '21:00', label: 'چهارشنبه' },
    { day: 5, open: '09:00', close: '21:00', label: 'پنج‌شنبه' },
    { day: 6, open: '10:00', close: '14:00', label: 'جمعه' },     // Friday - shorter
  ]
  await prisma.workingHour.createMany({
    data: weekdays.map(w => ({
      dayOfWeek: w.day,
      openTime: w.open,
      closeTime: w.close,
      isClosed: false,
    }))
  })

  // ─── FAQ Categories ───────────────────────────────────
  const faqCatGeneral = await prisma.faqCategory.create({
    data: { nameFa: 'عمومی', nameEn: 'General', isActive: true, sortOrder: 1 }
  })
  const faqCatVaccine = await prisma.faqCategory.create({
    data: { nameFa: 'واکسیناسیون', nameEn: 'Vaccination', isActive: true, sortOrder: 2 }
  })
  const faqCatGrooming = await prisma.faqCategory.create({
    data: { nameFa: 'گرومینگ', nameEn: 'Grooming', isActive: true, sortOrder: 3 }
  })
  const faqCatSurgery = await prisma.faqCategory.create({
    data: { nameFa: 'جراحی', nameEn: 'Surgery', isActive: true, sortOrder: 4 }
  })

  // ─── FAQs (20+) ───────────────────────────────────────
  await prisma.faq.createMany({
    data: [
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'ساعات کاری کلینیک چگونه است؟',
        questionEn: 'What are the clinic\'s working hours?',
        answerFa: 'کلینیک پت‌باس از شنبه تا پنج‌شنبه ساعت ۹ صبح تا ۹ شب و جمعه‌ها ساعت ۱۰ صبح تا ۲ بعدازظهر فعال است.',
        answerEn: 'Pet Boss Clinic is open Saturday to Thursday from 9 AM to 9 PM, and Friday from 10 AM to 2 PM.',
        isActive: true, sortOrder: 1,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'آدرس کلینیک کجاست؟',
        questionEn: 'Where is the clinic located?',
        answerFa: 'تهران، خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳.',
        answerEn: 'Shariati Street, near Gheytarieh Metro Station, No. 1733, Tehran.',
        isActive: true, sortOrder: 2,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'آیا نیاز به رزرو نوبت قبلی است؟',
        questionEn: 'Do I need to book an appointment in advance?',
        answerFa: 'توصیه می‌شود قبل از مراجعه با کلینیک تماس بگیرید، ولی پذیرش بدون نوبت هم انجام می‌شود.',
        answerEn: 'We recommend calling ahead, but walk-ins are also accepted.',
        isActive: true, sortOrder: 3,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'هزینه ویزیت چقدر است؟',
        questionEn: 'How much is the consultation fee?',
        answerFa: 'هزینه ویزیت بسته به نوع خدمات متفاوت است. لطفاً برای اطلاع از تعرفه‌ها تماس بگیرید.',
        answerEn: 'Consultation fees vary depending on the service. Please call for current rates.',
        isActive: true, sortOrder: 4,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'آیا خدمات اورژانس ارائه می‌دهید؟',
        questionEn: 'Do you offer emergency services?',
        answerFa: 'بله، در ساعات کاری کلینیک خدمات اورژانس ارائه می‌شود. لطفاً قبل از مراجعه تماس بگیرید.',
        answerEn: 'Yes, emergency services are available during clinic hours. Please call before arriving.',
        isActive: true, sortOrder: 5,
      },
      {
        categoryId: faqCatVaccine.id,
        questionFa: 'اولین واکسن توله سگ در چه سنی باید زده شود؟',
        questionEn: 'At what age should a puppy get its first vaccine?',
        answerFa: 'اولین واکسن توله سگ معمولاً در سن ۶ تا ۸ هفتگی تزریق می‌شود و سپس واکسن‌های یادآور طبق برنامه ادامه می‌یابد.',
        answerEn: 'The first puppy vaccine is typically given at 6–8 weeks of age, followed by boosters on schedule.',
        isActive: true, sortOrder: 1,
      },
      {
        categoryId: faqCatVaccine.id,
        questionFa: 'واکسن هاری چند وقت یکبار باید تزریق شود؟',
        questionEn: 'How often should the rabies vaccine be given?',
        answerFa: 'واکسن هاری در سن ۳ ماهگی برای اولین بار تزریق شده و سپس سالانه تکرار می‌شود.',
        answerEn: 'The rabies vaccine is first given at 3 months of age, then repeated annually.',
        isActive: true, sortOrder: 2,
      },
      {
        categoryId: faqCatVaccine.id,
        questionFa: 'آیا واکسیناسیون گربه هم ضروری است؟',
        questionEn: 'Is vaccination for cats also necessary?',
        answerFa: 'بله، گربه‌ها هم به واکسن‌های ضروری مانند سه‌گانه و هاری نیاز دارند، حتی اگر فقط داخل خانه باشند.',
        answerEn: 'Yes, cats also need essential vaccines like FVRCP and rabies, even if they are indoor-only.',
        isActive: true, sortOrder: 3,
      },
      {
        categoryId: faqCatVaccine.id,
        questionFa: 'قیمت واکسن سگ چقدر است؟',
        questionEn: 'How much does a dog vaccine cost?',
        answerFa: 'قیمت واکسن بسته به نوع آن از ۵۰۰ هزار تا ۲.۵ میلیون تومان متغیر است. با کلینیک تماس بگیرید.',
        answerEn: 'Vaccine prices range from 500,000 to 2,500,000 Toman depending on the type. Please contact the clinic.',
        isActive: true, sortOrder: 4,
      },
      {
        categoryId: faqCatGrooming.id,
        questionFa: 'هر چند وقت یکبار باید حیوان خانگی را حمام کنم؟',
        questionEn: 'How often should I bathe my pet?',
        answerFa: 'سگ‌ها معمولاً هر ۲ تا ۴ هفته و گربه‌ها هر ۴ تا ۶ هفته نیاز به حمام دارند، مگر اینکه کثیف شوند.',
        answerEn: 'Dogs typically need bathing every 2–4 weeks and cats every 4–6 weeks, unless they get dirty.',
        isActive: true, sortOrder: 1,
      },
      {
        categoryId: faqCatGrooming.id,
        questionFa: 'آیا اصلاح مو برای همه نژادها مناسب است؟',
        questionEn: 'Is hair trimming suitable for all breeds?',
        answerFa: 'خیر، برخی نژادها مانند هاسکی و ساموید نباید کوتاه شوند. تیم گرومینگ ما بر اساس نژاد مشاوره می‌دهد.',
        answerEn: 'No, some breeds like Husky and Samoyed should not be clipped. Our grooming team advises based on breed.',
        isActive: true, sortOrder: 2,
      },
      {
        categoryId: faqCatGrooming.id,
        questionFa: 'قیمت گرومینگ سگ چقدر است؟',
        questionEn: 'How much does dog grooming cost?',
        answerFa: 'هزینه گرومینگ سگ از ۵۰۰ هزار تومان شروع شده و بسته به نژاد و اندازه تا ۳ میلیون تومان متغیر است.',
        answerEn: 'Dog grooming starts at 500,000 Toman and varies up to 3,000,000 Toman based on breed and size.',
        isActive: true, sortOrder: 3,
      },
      {
        categoryId: faqCatSurgery.id,
        questionFa: 'آیا بیهوشی در جراحی حیوانات ایمن است؟',
        questionEn: 'Is anesthesia safe for pet surgery?',
        answerFa: 'بله، ما از داروهای بیهوشی ایمن و مدرن استفاده می‌کنیم و طی کل عمل علائم حیاتی حیوان مانیتور می‌شود.',
        answerEn: 'Yes, we use safe, modern anesthesia medications and monitor vital signs throughout the procedure.',
        isActive: true, sortOrder: 1,
      },
      {
        categoryId: faqCatSurgery.id,
        questionFa: 'بعد از جراحی چه مراقبت‌هایی لازم است؟',
        questionEn: 'What post-operative care is needed?',
        answerFa: 'پس از جراحی دستورالعمل‌های مراقبتی شامل داروها، محدودیت حرکتی و زمان مراجعه مجدد ارائه می‌شود.',
        answerEn: 'Post-surgery care instructions including medications, activity restrictions and follow-up visit schedule will be provided.',
        isActive: true, sortOrder: 2,
      },
      {
        categoryId: faqCatSurgery.id,
        questionFa: 'عقیم‌سازی حیوان خانگی چه مزایایی دارد؟',
        questionEn: 'What are the benefits of spaying/neutering?',
        answerFa: 'عقیم‌سازی علاوه بر جلوگیری از تولید مثل ناخواسته، خطر برخی سرطان‌ها و بیماری‌ها را کاهش می‌دهد.',
        answerEn: 'Spaying/neutering prevents unwanted breeding and reduces the risk of certain cancers and diseases.',
        isActive: true, sortOrder: 3,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'آیا برای حیوانات خانگی بیمه دارید؟',
        questionEn: 'Do you offer pet insurance?',
        answerFa: 'در حال حاضر بیمه‌نامه مستقیم ارائه نمی‌شود، ولی کلینیک با شرکت‌های بیمه دامپزشکی همکاری دارد.',
        answerEn: 'We don\'t currently offer direct insurance, but the clinic collaborates with veterinary insurance providers.',
        isActive: true, sortOrder: 6,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'آیا پارکینگ در نزدیکی کلینیک وجود دارد؟',
        questionEn: 'Is there parking near the clinic?',
        answerFa: 'بله، در محدوده خیابان شریعتی و کوچه‌های اطراف امکان پارک خودرو وجود دارد.',
        answerEn: 'Yes, parking is available on Shariati Street and nearby side streets.',
        isActive: true, sortOrder: 7,
      },
      {
        categoryId: faqCatGeneral.id,
        questionFa: 'چه حیواناتی را درمان می‌کنید؟',
        questionEn: 'What animals do you treat?',
        answerFa: 'در حال حاضر تمرکز ما بر سگ و گربه است. برای سایر حیوانات خانگی لطفاً تماس بگیرید.',
        answerEn: 'We currently specialize in dogs and cats. For other pets, please contact us.',
        isActive: true, sortOrder: 8,
      },
      {
        categoryId: faqCatGrooming.id,
        questionFa: 'آیا حیوان بعد از گرومینگ خشک می‌شود؟',
        questionEn: 'Is the pet dried after grooming?',
        answerFa: 'بله، حیوان بعد از حمام با سشوار حرفه‌ای کاملاً خشک شده و برس‌کشی نهایی انجام می‌شود.',
        answerEn: 'Yes, after bathing, the pet is fully dried with a professional dryer and given a final brush.',
        isActive: true, sortOrder: 4,
      },
      {
        categoryId: faqCatVaccine.id,
        questionFa: 'آیا بعد از واکسیناسیون حیوان دچار عوارض می‌شود؟',
        questionEn: 'Are there side effects after vaccination?',
        answerFa: 'عوارض واکسن معمولاً خفیف و شامل بی‌حالی مختصر است. در صورت بروز واکنش شدید با ما تماس بگیرید.',
        answerEn: 'Vaccine side effects are usually mild, including slight lethargy. Contact us if a severe reaction occurs.',
        isActive: true, sortOrder: 5,
      },
    ]
  })

  // ─── Testimonials ─────────────────────────────────────
  await prisma.testimonial.createMany({
    data: [
      {
        nameFa: 'سارا م.',
        nameEn: 'Sara M.',
        contentFa: 'بهترین کلینیک دامپزشکی تهران! دکترها فوق‌العاده مهربان و حرفه‌ای هستند. گربه من عاشق اینجاست.',
        contentEn: 'The best vet clinic in Tehran! The doctors are incredibly kind and professional. My cat loves it here.',
        rating: 5, isActive: true, sortOrder: 1,
      },
      {
        nameFa: 'علی ر.',
        nameEn: 'Ali R.',
        contentFa: 'سگم رو برای عمل جراحی آوردم و نتیجه فوق‌العاده بود. تیم پت‌باس واقعاً حرفه‌ای هستند.',
        contentEn: 'Brought my dog for surgery and the result was amazing. The Pet Boss team is truly professional.',
        rating: 5, isActive: true, sortOrder: 2,
      },
      {
        nameFa: 'مریم ک.',
        nameEn: 'Maryam K.',
        contentFa: 'قیمت‌ها منصفانه و خدمات گرومینگ عالی بود. حتماً دوباره میایم.',
        contentEn: 'Prices are fair and the grooming service was excellent. Will definitely come back.',
        rating: 5, isActive: true, sortOrder: 3,
      },
      {
        nameFa: 'رضا ف.',
        nameEn: 'Reza F.',
        contentFa: 'واکسیناسیون توله سگم رو اینجا انجام دادم. محیط تمیز و دکترها خیلی صبور بودند.',
        contentEn: 'Got my puppy vaccinated here. Clean environment and very patient doctors.',
        rating: 4, isActive: true, sortOrder: 4,
      },
      {
        nameFa: 'نازنین ش.',
        nameEn: 'Nazanin Sh.',
        contentFa: 'پت‌شاپشون هم عالیه! غذاهای برند اصل و تنوع بالا. مرسی پت‌باس!',
        contentEn: 'Their pet shop is great too! Original brand food and wide variety. Thanks Pet Boss!',
        rating: 5, isActive: true, sortOrder: 5,
      },
    ]
  })

  // ─── Announcement / Top Bar ───────────────────────────
  await prisma.announcement.create({
    data: {
      titleFa: '🐾 کلینیک پت‌باس — اکنون پذیرش فعال',
      titleEn: '🐾 Pet Boss Clinic — Now Accepting Patients',
      isActive: true,
      sortOrder: 1,
    }
  })

  console.log('Seeding finished successfully! ✅')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
