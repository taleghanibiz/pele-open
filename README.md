<div dir="rtl">

# پله

مدیریت کارِ تیمی، فارسی و رایگان. مثل Trello، بدون VPN، با اعلان Telegram.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftaleghanibiz%2Fpele-open&env=SUPABASE_URL,SUPABASE_ANON_KEY&envDescription=From%20Supabase%20%E2%86%92%20Project%20Settings%20%E2%86%92%20API&project-name=pele)

## امکانات

- **بورد** کارها با ستون‌های دلخواه، کشیدن و رها کردن، اولویت، موعد، پیوست فایل
- **نمای فهرست و تقویم**، فیلتر (کارهای من، امروز، عقب‌افتاده، فوری)، جستجو با <kbd>Ctrl K</kbd>
- **جلسه‌ها** با یادآوری ۲۴ ساعت، ۱۲ ساعت و یک ساعت قبل
- **یادداشت جلسه**؛ هر خط با یک کلیک تبدیل به کار می‌شود
- **فرایندها**: کار چندمرحله‌ای که هر مرحله تمام شود، نفر بعدی خبردار می‌شود
- **مشتریان**: شرکت‌ها، افراد و همهٔ کارهایی که برایشان انجام شده
- **Telegram** (اختیاری): اعلان کار و پیام، خلاصهٔ روزانه، ثبت کار از داخل ربات
- همه‌چیز زنده (realtime)، تاریخ شمسی، راست‌به‌چپ

## راه‌اندازی (حدود ۱۵ دقیقه، رایگان)

نسخهٔ خودت را روی حساب‌های رایگان Supabase و Vercel بالا می‌آوری؛ داده‌ها مال خودت است.

### ۱. پایگاه داده — Supabase

1. در [supabase.com](https://supabase.com) یک پروژهٔ رایگان بساز.
2. **SQL Editor** → محتوای فایل [`setup.sql`](setup.sql) را بچسبان → **Run**.
   اگر Supabase هشدار RLS داد، **Run without RLS** را بزن؛ خودِ فایل RLS را برای همهٔ جدول‌ها روشن می‌کند.
3. از **Project Settings → API** دو مقدار را بردار: `Project URL` و کلید `publishable` (یا `anon`).

### ۲. ورود با Google

1. در [Google Cloud Console](https://console.cloud.google.com/apis/credentials) یک **OAuth client ID** از نوع *Web application* بساز.
   - Authorized redirect URI: `https://<پروژه‌ات>.supabase.co/auth/v1/callback`
2. در Supabase: **Authentication → Sign In / Providers → Google** → کلید **Enable Sign in with Google** را روشن کن (فراموشش نکن!)، Client ID و Secret را بچسبان و **Save** بزن. در فهرست باید «Google · Enabled» ببینی.
3. در **OAuth consent screen** اپ را **Publish** کن؛ وگرنه فقط کاربرهای تستی می‌توانند وارد شوند.

### ۳. انتشار — Vercel

1. دکمهٔ **Deploy with Vercel** بالای همین صفحه را بزن و `SUPABASE_URL` و `SUPABASE_ANON_KEY` را وارد کن.
2. در Supabase: **Authentication → URL Configuration** → آدرس سایتت (مثلاً `https://pele-xxx.vercel.app`) را در **Site URL** و **Redirect URLs** بگذار.

### ۴. شروع

سایت را باز کن و با Google وارد شو. **اولین نفری که وارد شود مدیر می‌شود** و یک بورد آماده می‌گیرد.
از دکمهٔ «اعضا» هم‌تیمی‌ها را با Gmail دعوت کن و بورد جدید بساز.

### ۵. Telegram (اختیاری)

1. از [@BotFather](https://t.me/BotFather) یک ربات بساز و توکنش را بگیر.
2. در Vercel → Settings → Environment Variables این‌ها را اضافه کن (نمونه در [`.env.example`](.env.example)):
   `TELEGRAM_BOT` (نام کاربری ربات، بدون @)، `TELEGRAM_TOKEN`، `SUPABASE_SERVICE_KEY` (کلید secret از Supabase)، `WEBHOOK_SECRET` و `CRON_SECRET` (دو رشتهٔ تصادفی بلند). بعد دوباره Deploy کن.
3. وب‌هوک ربات را وصل کن:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<سایتت>/api/telegram&secret_token=<WEBHOOK_SECRET>"
   ```
4. در Supabase → SQL Editor:
   ```sql
   insert into private.config values
     ('notify_url', 'https://<سایتت>/api/notify'),
     ('webhook_secret', '<WEBHOOK_SECRET>');
   ```
5. در پله دکمهٔ «اتصال تلگرام» را بزن.

## نکته‌ها

- زمان جلسه‌ها و یادآوری‌ها به وقت تهران است.
- تست‌ها: `npm test`. تست پایگاه داده: [`test/setup_test.sql`](test/setup_test.sql) را بعد از `setup.sql` روی یک پروژهٔ تازه اجرا کن.

## مجوز

[MIT](LICENSE) — رایگان برای استفادهٔ شخصی و تجاری.

</div>

---

## English

**Pele** is a free, Persian (RTL) team task manager: Trello-style boards, list and calendar views, meetings with reminders, meeting notes, multi-step processes, a small customer CRM, and optional Telegram notifications. Static frontend + Vercel functions + Supabase (Postgres, Auth, Realtime, Storage).

**Self-host in ~15 minutes, on free tiers:**

1. **Supabase**: create a project, run [`setup.sql`](setup.sql) in the SQL Editor (choose *Run without RLS* if warned; the script enables RLS itself), copy the Project URL and publishable/anon key.
2. **Google sign-in**: create a Web OAuth client (redirect URI `https://<project>.supabase.co/auth/v1/callback`), turn on **Enable Sign in with Google** in Supabase and paste the ID + secret, and publish the consent screen.
3. **Vercel**: click *Deploy with Vercel* above, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then add your site URL to Supabase → Authentication → URL Configuration.
4. **Sign in**: the first account to sign in becomes admin and gets a starter board. Invite teammates by Gmail from «اعضا».
5. **Telegram (optional)**: see step 5 above; the env vars are listed in [`.env.example`](.env.example).

Times are Asia/Tehran. Tests: `npm test`. License: [MIT](LICENSE).
