# Seed Data for Pet Boss Clinic

This file contains the initial data for the Pet Boss Clinic project.
It will be parsed by `prisma/seed.ts` to populate the database.

## Divisions
| slugFa | slugEn | nameFa | nameEn |
|---|---|---|---|
| clinic | clinic | بخش درمانی، داخلی و جراحی | Clinical / Internal Medicine & Surgery |
| grooming | grooming | بخش آرایش، شستوشو و بهداشت (گرومینگ) | Grooming & Hygiene |
| shop | shop | پت شاپ | Pet Shop |

## Services
| divisionSlug | slugFa | nameFa | durationFa | priceFrom | priceNoteFa | # VERIFY |
|---|---|---|---|---|---|---|
| clinic | vaccination | واکسیناسیون | ۱۵ دقیقه | 450000 | تماس بگیرید | |
| clinic | internal-medicine | بیماریهای داخلی | ۳۰ دقیقه | 350000 | تماس بگیرید | |
| clinic | parasite-therapy | انگلدرمانی | ۱۵ دقیقه | 250000 | | |
| clinic | soft-tissue-surgery | جراحی بافت نرم | ۲ ساعت | 5000000 | قیمت پایه | # VERIFY |
| clinic | orthopedics | ارتوپدی | ۳ ساعت | 8000000 | قیمت پایه | # VERIFY |
| grooming | dog-cat-grooming | اصلاح و آرایش سگ و گربه | ۱ ساعت | 600000 | | # VERIFY |
| grooming | washing | شستوشو و حمام | ۴۵ دقیقه | 300000 | | |
| grooming | nail-clipping | ناخنگیری و تمیز کردن گوش | ۱۵ دقیقه | 150000 | | |

## Species
| nameFa | nameEn |
|---|---|
| سگ | Dog |
| گربه | Cat |

## Breeds
| speciesName | slugFa | nameFa | nameEn | sizeFa | temperamentFa |
|---|---|---|---|---|---|
| سگ | german-shepherd | ژرمن شپرد | German Shepherd | بزرگ | وفادار، شجاع |
| سگ | golden-retriever | گلدن رتریور | Golden Retriever | بزرگ | مهربان، باهوش |
| سگ | pomeranian | پامرانین | Pomeranian | کوچک | پرانرژی، بازیگوش |
| گربه | persian-cat | گربه پرشین | Persian Cat | متوسط | آرام، دوستداشتنی |
| گربه | british-shorthair | بریتیش شورت هیر | British Shorthair | متوسط | مستقل، مهربان |
| گربه | scottish-fold | اسکاتیش فولد | Scottish Fold | متوسط | آرام، شیرین |

## Shop Categories
| slugFa | nameFa |
|---|---|
| dog-dry-food | غذای خشک سگ |
| cat-dry-food | غذای خشک گربه |
| treats | کنسرو و تشویقی |
| hygiene | شامپو و لوازم بهداشتی |
| carrier | باکس حمل و نقل |
| clothes | لباس |
| collar | قلاده |
| cat-litter | خاک گربه |

## Products (Phase 1)
| categorySlug | slugFa | nameFa | price | stockStatus | isPurchasable |
|---|---|---|---|---|---|
| dog-dry-food | royal-canin-maxi-adult | غذای خشک سگ رویال کنین مکسی ادالت | 3500000 | OUT_OF_STOCK | false |
| cat-dry-food | reflex-plus-adult-cat | غذای خشک گربه رفلکس پلاس | 1200000 | OUT_OF_STOCK | false |
| cat-litter | penty-cat-litter-10l | خاک گربه پنتی ۱۰ لیتری | 250000 | OUT_OF_STOCK | false |

## FAQs
| questionFa | answerFa |
|---|---|
| ساعات کاری کلینیک چگونه است؟ | کلینیک ما همه روزه از ساعت ۱۰ صبح تا ۱۰ شب در خدمت شماست. |
| آیا برای مراجعه نیاز به وقت قبلی است؟ | بله، برای جلوگیری از معطلی لطفا قبل از مراجعه تماس بگیرید. |
| واکسیناسیون سگ از چه سنی شروع میشود؟ | اولین واکسن معمولا در سن ۶ تا ۸ هفتگی تزریق میشود. |

## Working Hours
| dayOfWeek | openTime | closeTime | isClosed |
|---|---|---|---|
| 0 | 10:00 | 22:00 | false |
| 1 | 10:00 | 22:00 | false |
| 2 | 10:00 | 22:00 | false |
| 3 | 10:00 | 22:00 | false |
| 4 | 10:00 | 22:00 | false |
| 5 | 10:00 | 22:00 | false |
| 6 | 10:00 | 22:00 | false |

## Staff / Vets
| nameFa | nameEn | titleFa | titleEn | specialtyFa | specialtyEn | licenseNo |
|---|---|---|---|---|---|---|
| دکتر علیرضا تهرانی | Dr. Alireza Tehrani | جراح ارشد دامپزشکی | Chief Veterinary Surgeon | جراحی بافت نرم و ارتوپدی | Soft Tissue & Orthopedic Surgery | ۹۸/د/۱۴۲۰ |
| دکتر سارا مرادی | Dr. Sarah Moradi | متخصص بیماری‌های داخلی | Internal Medicine Specialist | بیماری‌های گوارشی، تنفسی و سونوگرافی | Internal Disorders & Ultrasound | ۹۹/د/۲۳۰۵ |
| مهسا راد | Mahsa Rad | متخصص ارشد گرومینگ | Senior Grooming Specialist | اصلاح و آرایش استاندارد نژادی و بهداشت | Breed-Standard Grooming & Hygiene | گرومر بین‌المللی |

### HOW TO EDIT
You can edit this Markdown file directly to add, remove, or modify seed data. Once you have made your changes, run `npx tsx prisma/seed.ts` to parse this data and populate the database.
