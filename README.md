# Moones AI — مونِس AI

مونِس AI یک پلتفرم کامل Telegram AI Bot برای کاربران فارسی‌زبان غیر فنی است. کاربر فقط کیف پول تومانی را شارژ می‌کند، چت/عکس/ویدیو را انتخاب می‌کند و هزینه ساده به تومان می‌بیند. نام مدل، توکن، قیمت فنی و Provider در تجربه کاربر نمایش داده نمی‌شود؛ این موارد فقط در پنل ادمین قابل مشاهده است.

## ساختار

```text
apps/api      Backend REST API با Fastify + TypeScript
apps/bot      Telegram bot با Telegraf
apps/admin    پنل ادمین Next.js، RTL، سیاه و سفید
packages/db   Prisma schema/client/seed
packages/ai   Abstraction برای Mock/Venice/OpenAI-compatible
packages/billing منطق قیمت‌گذاری و کیف پول
packages/config اعتبارسنجی env با Zod
packages/shared ابزارهای مشترک
```

## راه‌اندازی محلی

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm --filter @moones/db dev:migrate
pnpm db:seed
pnpm --filter @moones/api dev
pnpm --filter @moones/admin dev
pnpm --filter @moones/bot dev
```

Admin: `http://localhost:3000/login`  
API health: `http://localhost:4000/health`

## Docker

```bash
cp .env.example .env
# TELEGRAM_BOT_TOKEN را برای اجرای واقعی بات پر کنید
docker compose up --build
```

Nginx روی پورت 80 پنل را نمایش می‌دهد و `/api` را به API وصل می‌کند.

## متغیرهای محیطی مهم

- `TELEGRAM_BOT_TOKEN`: توکن BotFather
- `DATABASE_URL`: اتصال PostgreSQL
- `REDIS_URL`: اتصال Redis
- `JWT_SECRET`: کلید امن session/JWT
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: ساخت اولین ادمین در seed
- `AI_PROVIDER_MODE`: `mock`, `venice`, `openai-compatible`
- `VENICE_API_KEY`: کلید Venice در حالت واقعی
- `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`: Provider سازگار با OpenAI
- `PAYMENT_PROVIDER`: `mock`, `manual`, `zarinpal`
- `PUBLIC_APP_URL`: `https://ai.moones.top`

## قیمت‌گذاری

فرمول داخلی:

```text
finalUserPrice = roundToNearest(fixedBaseFee + providerCostInToman * markupMultiplier, roundingStep)
```

حداقل هزینه، ضریب سود، آستانه تأیید هزینه بالا و فعال/غیرفعال بودن task از جدول `PricingConfig` و صفحه قیمت‌گذاری پنل مدیریت کنترل می‌شود.

## کیف پول و Ledger

هر تغییر موجودی با `WalletLedger` ثبت می‌شود. موجودی منفی ممنوع است و تغییرات کیف پول در transaction انجام می‌شود. برای ویدیو ابتدا رزرو ثبت می‌شود و سپس مصرف نهایی/رسید ساخته می‌شود.

## Provider های AI

`packages/ai` شامل `MockProvider`، placeholder برای Venice و OpenAI-compatible است. اگر کلید واقعی وجود نداشته باشد سیستم در mock mode کار می‌کند. برای افزودن Provider جدید interface های `AITextProvider`، `AIImageProvider` و `AIVideoProvider` را پیاده‌سازی و routing داخلی را در `AIRouteConfig` تنظیم کنید.

## جریان تست محصول

1. وارد پنل ادمین شوید.
2. یک کاربر با `/start` در تلگرام ساخته می‌شود.
3. در صفحه کاربران، با endpoint تنظیم کیف پول برای کاربر موجودی اضافه کنید.
4. کاربر در بات گزینه چت/عکس/ویدیو را انتخاب می‌کند.
5. کاربر فقط «هزینه» و «مانده» می‌بیند.
6. ادمین در صفحه مصرف AI نام provider، مدل داخلی، هزینه provider و margin را می‌بیند.

## استقرار Production روی ai.moones.top

1. یک VPS تمیز آماده کنید و Docker/Compose را نصب کنید.
2. DNS رکورد `A` برای `ai.moones.top` را به IP سرور وصل کنید.
3. repository را در مسیر دلخواه clone کنید.
4. فایل `.env` production را بسازید و secret های واقعی را قرار دهید.
5. اجرا کنید:

```bash
./deploy.sh
```

برای SSL می‌توانید Certbot یا reverse proxy خارجی مثل Cloudflare/Nginx Proxy Manager استفاده کنید. `nginx.conf` آماده proxy برای دامنه است.

## GitHub Actions

Secrets مورد نیاز در GitHub:

- `SSH_HOST`
- `SSH_USER`
- `SSH_KEY`
- `DEPLOY_PATH`

Workflow نصب، lint، test، build را اجرا می‌کند و در صورت وجود SSH secrets روی سرور deploy می‌کند.

## پرداخت

Interface پرداخت در API آماده است و provider های mock/manual پشتیبانی می‌شوند. برای Zarinpal/IDPay کلیدها را در env قرار دهید و adapter واقعی را بدون hardcode کردن credential اضافه کنید. در MVP ادمین می‌تواند پرداخت manual را approve/reject کند و کیف پول را دستی افزایش/کاهش دهد.

## عیب‌یابی

- اگر bot اجرا نشد، `TELEGRAM_BOT_TOKEN` خالی است.
- اگر login کار نکرد، `pnpm db:seed` را اجرا کنید.
- اگر Prisma خطای connection داد، PostgreSQL و `DATABASE_URL` را بررسی کنید.
- در local بدون کلید AI، `AI_PROVIDER_MODE=mock` بگذارید.
