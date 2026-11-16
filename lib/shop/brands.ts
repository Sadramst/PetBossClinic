/**
 * Brand dictionary for the pet shop. Product names in the inventory mostly start
 * with the Latin brand name ("royal canin ...", "gigwi ..."), while Iranian shoppers
 * search in Persian ("رویال کنین"). This table links both, powers brand pages and
 * lets search understand Persian brand names.
 */
export interface BrandDef {
  slug: string;
  nameEn: string;
  nameFa: string;
  /** Lower-case prefixes / words that identify the brand inside a product name. */
  match: string[];
  /** Persian spellings people type. */
  aliasesFa: string[];
}

export const BRANDS: BrandDef[] = [
  { slug: 'royal-canin', nameEn: 'Royal Canin', nameFa: 'رویال کنین', match: ['royal canin', 'royal'], aliasesFa: ['رویال کنین', 'رویال کانین', 'رویال'] },
  { slug: 'josera', nameEn: 'Josera', nameFa: 'جوسرا', match: ['josera'], aliasesFa: ['جوسرا', 'جوزرا'] },
  { slug: 'hills', nameEn: "Hill's", nameFa: 'هیلز', match: ['hills', "hill's"], aliasesFa: ['هیلز'] },
  { slug: 'babin', nameEn: 'Babin', nameFa: 'بابین', match: ['babin'], aliasesFa: ['بابین'] },
  { slug: 'gigwi', nameEn: 'GiGwi', nameFa: 'جیگوی', match: ['gigwi'], aliasesFa: ['جیگوی', 'گیگوی', 'جی گوی'] },
  { slug: 'nina', nameEn: 'Nina', nameFa: 'نینا', match: ['nina'], aliasesFa: ['نینا'] },
  { slug: 'wau', nameEn: 'Wau', nameFa: 'واو', match: ['wau'], aliasesFa: ['واو'] },
  { slug: 'afp', nameEn: 'AFP', nameFa: 'ای اف پی', match: ['afp'], aliasesFa: ['ای اف پی', 'ای‌اف‌پی'] },
  { slug: 'bioline', nameEn: 'Bioline', nameFa: 'بایولاین', match: ['bioline'], aliasesFa: ['بایولاین', 'بیولاین'] },
  { slug: 'shawn', nameEn: 'Shawn', nameFa: 'شاون', match: ['shawn'], aliasesFa: ['شاون'] },
  { slug: 'nobby', nameEn: 'Nobby', nameFa: 'نابی', match: ['nobby'], aliasesFa: ['نابی', 'نوبی'] },
  { slug: 'trixie', nameEn: 'Trixie', nameFa: 'تریکسی', match: ['trixie'], aliasesFa: ['تریکسی'] },
  { slug: 'merryland', nameEn: 'Merryland', nameFa: 'مری لند', match: ['merryland'], aliasesFa: ['مری لند', 'مریلند'] },
  { slug: 'jerhigh', nameEn: 'JerHigh', nameFa: 'جرهای', match: ['jerhigh'], aliasesFa: ['جرهای', 'جرهای'] },
  { slug: 'endi', nameEn: 'Endi', nameFa: 'اندی', match: ['endi'], aliasesFa: ['اندی'] },
  { slug: 'm-pets', nameEn: 'M-Pets', nameFa: 'ام پتس', match: ['m-pets', 'm pets', 'mpets'], aliasesFa: ['ام پتس', 'ام‌پتس'] },
  { slug: 'dr-clauders', nameEn: "Dr. Clauder's", nameFa: 'دکتر کلادرز', match: ['dr.clauders', 'dr.clouders', 'dr clauders', 'dr. clauders'], aliasesFa: ['دکتر کلادرز', 'دکتر کلادر'] },
  { slug: 'mr-panguin', nameEn: 'Mr. Panguin', nameFa: 'مستر پنگوئن', match: ['mr.panguin', 'mr panguin'], aliasesFa: ['مستر پنگوئن'] },
  { slug: 'dodoti', nameEn: 'Dodoti', nameFa: 'دودوتی', match: ['dodoti'], aliasesFa: ['دودوتی'] },
  { slug: 'dreamies', nameEn: 'Dreamies', nameFa: 'دریمیز', match: ['dreamies'], aliasesFa: ['دریمیز'] },
  { slug: 'wanpy', nameEn: 'Wanpy', nameFa: 'ونپی', match: ['wanpy'], aliasesFa: ['ونپی', 'وانپی'] },
  { slug: 'taste-of-the-wild', nameEn: 'Taste of the Wild', nameFa: 'تیست آو د وایلد', match: ['taste of the wild', 'taste'], aliasesFa: ['تیست آو د وایلد', 'تیست'] },
  { slug: 'leonardo', nameEn: 'Leonardo', nameFa: 'لئوناردو', match: ['leonardo'], aliasesFa: ['لئوناردو'] },
  { slug: 'winston', nameEn: 'Winston', nameFa: 'وینستون', match: ['winston'], aliasesFa: ['وینستون'] },
  { slug: 'vima', nameEn: 'Vima', nameFa: 'ویما', match: ['vima'], aliasesFa: ['ویما'] },
  { slug: 'boss', nameEn: 'Boss', nameFa: 'باس', match: ['boss'], aliasesFa: [] },
];

/** Brand of a product from its name: a match must be the first word(s) of the name. */
export function detectBrand(productName: string): BrandDef | null {
  const name = productName.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const b of BRANDS) {
    for (const m of b.match) {
      if (name === m || name.startsWith(`${m} `) || name.startsWith(`${m}-`)) return b;
    }
  }
  return null;
}

/** Generic Persian <-> English product words so either language finds the product. */
const WORD_SYNONYMS: Record<string, string[]> = {
  'گربه': ['cat', 'گربه'],
  'سگ': ['dog', 'سگ'],
  'cat': ['cat', 'گربه'],
  'dog': ['dog', 'سگ'],
  'بچه‌گربه': ['kitten'],
  'کیتن': ['kitten'],
  'توله': ['puppy', 'junior', 'توله'],
  'پاپی': ['puppy'],
  'عقیم': ['steril', 'عقیم'],
  'استریل': ['steril'],
  'خشک': ['dry', 'خشک'],
  'پوچ': ['pouch', 'پوچ'],
  'کنسرو': ['can', 'کنسرو'],
  'تشویقی': ['treat', 'snack', 'تشویقی'],
  'اسنک': ['snack', 'treat'],
  'اسباب‌بازی': ['toy', 'اسباب', 'عروسک', 'توپ'],
  'شامپو': ['shampoo', 'شامپو'],
};

/**
 * Turns a free-text query into AND-ed token groups; each group is a list of
 * alternatives that may match (Persian brand names become their Latin form).
 */
export function expandSearchQuery(query: string): string[][] {
  let q = ` ${query.toLowerCase().replace(/‌/g, ' ').replace(/\s+/g, ' ').trim()} `;
  const groups: string[][] = [];

  // Multi-word Persian brand aliases first (longest first so "رویال کنین" beats "رویال").
  const aliases = BRANDS.flatMap((b) => b.aliasesFa.map((a) => ({ a: a.replace(/‌/g, ' '), b })))
    .sort((x, y) => y.a.length - x.a.length);
  for (const { a, b } of aliases) {
    if (q.includes(` ${a} `)) {
      groups.push([b.match[0], b.nameFa]);
      q = q.replace(` ${a} `, ' ');
    }
  }

  for (const token of q.trim().split(' ')) {
    if (token.length < 2) continue;
    const syn = WORD_SYNONYMS[token];
    groups.push(syn ? Array.from(new Set(syn)) : [token]);
  }
  return groups;
}
