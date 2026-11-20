# Owner checklist / چک‌لیست مدیر

Never send secrets by chat or email. Enter them only in the Vercel project settings (Environment Variables).

## 1. فارسی: چه چیزی باید فراهم یا تنظیم شود

| مورد | کار شما | کجا |
|---|---|---|
| پنل پیامک | از کاوه‌نگار یا sms.ir حساب و کلید API بگیرید و الگوی پیامک کد ورود را تأیید کنید | Vercel: `SMS_PROVIDER` و کلیدها |
| پاسخ «لغو ۱۱» | آدرس وب‌هوک دریافت پیامک را به پنل پیامک بدهید | `SMS_INBOUND_SECRET` |
| زرین‌پال | شناسه پذیرنده (merchant) بگیرید؛ اول با حالت آزمایشی تست کنید | `ZARINPAL_MERCHANT_ID`، `ZARINPAL_SANDBOX` |
| اینماد | کد نماد را در «تنظیمات» پنل مدیریت وارد کنید | مدیریت، تنظیمات |
| کلید کران (CRON_SECRET) | یک رشته تصادفی بلند بسازید؛ بدون آن کارهای زمان‌بندی‌شده اجرا نمی‌شوند | Vercel |
| رمز ورود مدیر | `AUTH_SECRET` و رمز اولیه مدیر را تنظیم و بعد از اولین ورود تغییر دهید | Vercel |
| هوش مصنوعی (اختیاری) | `ANTHROPIC_API_KEY` فقط برای پیشنهادهای هوشمند | Vercel |
| متن‌های حقوقی | قوانین، حریم خصوصی، بازگشت کالا و ارسال را بازبینی کنید | صفحات حقوقی |
| محصولات و انقضا | قیمت و موجودی را کامل کنید؛ برای هر محموله تاریخ انقضا ثبت کنید | مدیریت، موجودی و انقضا |
| کادر درمان | مجوزهای واقعی و عکس‌های واقعی | مدیریت، کادر |
| سرچ کنسول و گوگل | کدها را در تنظیمات وارد کنید؛ طبق `search-visibility-playbook.md` | مدیریت، تنظیمات |
| پشتیبان‌گیری | مشخص کنید پایگاه داده کجاست و پشتیبان بیرونی و آزمایش بازیابی دارد | با توسعه‌دهنده |

## 2. فارسی: کار روزانه در CRM

1. صبح: پیشخوان را باز کنید (کارهای امروز، سرنخ‌های جدید، پیام‌های باز، سفارش‌های نیازمند اقدام).
2. «کارها»: کارهای عقب‌افتاده را انجام یا به فردا موکول کنید.
3. «سرنخ‌ها»: برای هر سرنخ جدید مسئول و تاریخ پیگیری بگذارید؛ بعد از تماس مرحله را تغییر دهید.
4. «پیام‌ها»: به پیام‌های باز پاسخ دهید؛ سررسید پاسخ را زیر نظر بگیرید.
5. «سفارش‌ها»: سفارش‌های جدید را آماده و ارسال کنید.
6. «موجودی و انقضا»: محموله‌های رو به انقضا را ببینید؛ تخفیف بدهید یا کنار بگذارید.
7. هفتگی: «گزارش‌ها»، مشتریان در معرض ریزش، و مشتریان تکراری (ادغام فقط توسط مدیر).
8. جستجوی سریع: Ctrl+K.

## 3. English summary

What to provide: SMS provider account and keys (Kavenegar or SMS.ir) plus the OTP template; inbound STOP webhook secret; ZarinPal merchant id (test in sandbox first); eNamad snippet (Admin, Settings); a long random `CRON_SECRET`; `AUTH_SECRET` and the initial admin password (change after first login); optional `ANTHROPIC_API_KEY`; review of legal pages; prices, stock and expiry dates for all products; real vet licences and photos; confirmation of where the database lives and how it is backed up.

Daily CRM routine: open the dashboard; clear Tasks; assign and follow up new Leads; answer open Messages before SLA; process Orders; check Inventory and expiry; weekly check Reports, at-risk customers and duplicates. Use Ctrl+K for fast search.
