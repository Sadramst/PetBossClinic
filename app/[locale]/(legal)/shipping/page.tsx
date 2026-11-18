import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Bullets, LegalPage, type LegalSection } from '@/components/content/legal-page';
import { getClinicNAP } from '@/lib/clinic/nap';
import { zarinpalConfigured } from '@/lib/payments/zarinpal';
import { pageMetadata } from '@/lib/seo/metadata';
import { SHIPPING } from '@/lib/shop/shipping';

export const revalidate = 3600;

export function generateStaticParams() {
  return [{ locale: 'fa' }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  return pageMetadata({
    title: 'راهنمای خرید و ارسال سفارش | پت‌شاپ پت‌باس',
    description:
      'مراحل ثبت سفارش، هزینه و روش ارسال به تهران و سراسر ایران، پرداخت آنلاین و پرداخت در محل، و نحوه پیگیری سفارش در پت‌شاپ کلینیک دامپزشکی پت‌باس.',
    path: '/shipping',
    image: '/images/petshop.jpg',
  });
}

const fa = (n: number) => n.toLocaleString('fa-IR');

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const nap = await getClinicNAP();
  const online = zarinpalConfigured();

  const sections: LegalSection[] = [
    {
      id: 'order',
      title: 'مراحل ثبت سفارش',
      content: (
        <>
          <Bullets
            items={[
              'کالاهای مورد نظر را به سبد خرید اضافه کنید.',
              'با شماره موبایل و رمز عبور وارد شوید یا ثبت‌نام کنید.',
              'نشانی تحویل را انتخاب یا اضافه کنید و روش پرداخت را برگزینید.',
              'سفارش را ثبت کنید؛ شماره سفارش (مثل PB-۱۴۰۵-۰۰۰۰۰۱) نمایش داده می‌شود.',
            ]}
          />
          <p>
            وضعیت سفارش را هر زمان از «حساب من ← سفارش‌های من» می‌بینید. اگر ترجیح می‌دهید ثبت‌نام نکنید، می‌توانید سفارش را
            تلفنی یا از طریق واتس‌اپ به کلینیک اعلام کنید.
          </p>
        </>
      ),
    },
    {
      id: 'fees',
      title: 'روش و هزینه ارسال',
      content: (
        <>
          <Bullets
            items={[
              <>
                <b>تهران (محدوده پوشش پیک):</b> ارسال با پیک ویژه، هزینه {fa(SHIPPING.tehranFee)} تومان. محدوده پوشش هنگام ثبت
                نشانی مشخص می‌شود.
              </>,
              <>
                <b>سایر شهرها:</b> ارسال با پست پیشتاز، هزینه {fa(SHIPPING.postFee)} تومان.
              </>,
              <>
                <b>ارسال رایگان</b> برای سفارش‌های {fa(SHIPPING.freeOver)} تومان و بیشتر.
              </>,
            ]}
          />
          <p>هزینه ارسال پیش از پرداخت و در خلاصه سفارش نمایش داده می‌شود؛ هزینه پنهانی وجود ندارد.</p>
        </>
      ),
    },
    {
      id: 'time',
      title: 'آماده‌سازی و زمان تحویل',
      content: (
        <>
          <p>
            پس از ثبت (و در پرداخت آنلاین، پس از تأیید پرداخت)، سفارش توسط همکاران ما آماده می‌شود. زمان تحویل به نشانی و
            موجودی بستگی دارد و هنگام هماهنگی تلفنی اعلام می‌شود. برای ارسال با پست، کد رهگیری در صفحه سفارش شما ثبت می‌شود.
          </p>
          <p>در صورت تأخیر یا نیاز به هماهنگی، همکاران ما با شماره‌ای که ثبت کرده‌اید تماس می‌گیرند؛ لطفاً شماره تماس را دقیق وارد کنید.</p>
        </>
      ),
    },
    {
      id: 'payment',
      title: 'روش‌های پرداخت',
      content: (
        <Bullets
          items={[
            <>
              <b>پرداخت آنلاین:</b>{' '}
              {online
                ? 'با همه کارت‌های بانکی عضو شتاب از طریق درگاه امن پرداخت. اطلاعات کارت فقط در صفحه بانک وارد می‌شود.'
                : 'به‌زودی فعال می‌شود. تا آن زمان از پرداخت در محل (برای تهران) یا ثبت سفارش تلفنی استفاده کنید.'}
            </>,
            <>
              <b>پرداخت در محل:</b> فقط برای نشانی‌های داخل محدوده پیک تهران؛ مبلغ را هنگام تحویل با کارتخوان یا نقد به پیک
              پرداخت می‌کنید.
            </>,
          ]}
        />
      ),
    },
    {
      id: 'expiry',
      title: 'تاریخ انقضا و کیفیت کالا',
      content: (
        <>
          <p>
            برای کالاهای خوراکی و دارویی، تاریخ انقضای کالایی که برای شما ارسال می‌شود در صفحه محصول دیده می‌شود. از میان موجودی
            معتبر، کالایی ارسال می‌شود که زودتر منقضی می‌شود اما هنوز مدت مصرف دارد؛ کالای منقضی‌شده هرگز فروخته نمی‌شود.
          </p>
          <p>تاریخ انقضا پیش از ارسال توسط همکاران ما کنترل می‌شود.</p>
        </>
      ),
    },
    {
      id: 'receive',
      title: 'تحویل گرفتن مرسوله',
      content: (
        <Bullets
          items={[
            'هنگام تحویل، سلامت بسته‌بندی را بررسی کنید.',
            'اگر بسته آسیب‌دیده یا باز شده بود، تحویل نگیرید یا همان لحظه با کلینیک تماس بگیرید.',
            'هر مغایرت (کالای اشتباه، کسری، ایراد ظاهری) را حداکثر ظرف ۴۸ ساعت با عکس اطلاع دهید تا پیگیری شود.',
          ]}
        />
      ),
    },
  ];

  return (
    <LegalPage
      path="/shipping"
      title="راهنمای خرید و ارسال"
      subtitle="از ثبت سفارش تا تحویل در کمتر از چند دقیقه بخوانید و با خیال راحت خرید کنید."
      sections={sections}
      nap={nap}
    />
  );
}
