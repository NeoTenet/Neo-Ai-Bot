<div align="center">

<img src="logo.png" alt="Neo AI Bot Logo" width="150" height="150" />

# 🤖 Neo AI Bot

**ربات هوش مصنوعی پیشرفته تلگرام؛ سریع، رایگان و بهینه‌سازی‌شده برای Cloudflare Workers**

[![Developer Channel](https://img.shields.io/badge/Telegram-Channel-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/NeoTenet)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![License](https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge)](LICENSE)

**[پیش‌نمایش](#-پیشنمایش-محیط-ربات-و-پنل) • [ویژگی‌ها](#-ویژگیهای-کلیدی) • [پیش‌نیازها](#-پیشنیازها) • [راه‌اندازی](#-راهنمای-گامبهگام-راهاندازی) • [Secrets](#-تنظیمات-و-کلیدهای-امنیتی-secrets) • [Webhook](#-تنظیم-webhook) • [عیبیابی](#-عیبیابی-و-نکات-مهم) • [سازنده](#-سازنده-و-کانال-توسعهدهنده)**

</div>

---

<div dir="rtl">

## 📖 درباره پروژه

**Neo AI Bot** یک ربات هوش مصنوعی برای تلگرام است که روی زیرساخت Serverless سرویس **Cloudflare Workers** اجرا می‌شود.

این پروژه برای اجرای سبک، سریع و کم‌هزینه طراحی شده و می‌تواند بدون خرید VPS یا سرور اختصاصی اجرا شود. برای نگهداری داده‌های موقت و وضعیت‌های موردنیاز ربات نیز می‌توان از **Cloudflare KV** استفاده کرد.

ساختار پروژه با تمرکز بر پایداری در Free Tier، مدیریت خطا و کاهش مصرف منابع طراحی شده است.

> 💡 **هدف پروژه:** راه‌اندازی یک ربات AI تلگرامی سریع و قابل‌استفاده با حداقل زیرساخت و بدون نیاز به سرور اختصاصی.

---

## 📸 پیش‌نمایش محیط ربات و پنل

<div align="center">

<img src="panel-screenshot.jpg" alt="Neo AI Bot Panel Preview" width="100%" />

<sub>نمای پنل Cloudflare و محیط پاسخ‌دهی ربات Neo AI Bot</sub>

</div>

> 🖼️ برای نمایش تصویر بالا، فایل `panel-screenshot.jpg` را در ریشه Repository قرار دهید.
>
> 💡 اگر تصویر دیگری دارید، کافی است مقدار `src` را با نام فایل تصویر خودتان جایگزین کنید.

---

## ✨ ویژگی‌های کلیدی

- ⚡ **پاسخ‌دهی سریع** — ارتباط مستقیم با API هوش مصنوعی.
- ☁️ **Serverless** — اجرا روی Cloudflare Workers بدون نیاز به VPS.
- 💰 **کم‌هزینه و مناسب Free Tier** — مناسب پروژه‌های شخصی و آزمایشی.
- 🛡️ **مدیریت خطا** — استفاده از ساختارهای `try/catch` برای جلوگیری از Crash شدن Worker.
- 🗃️ **Cloudflare KV** — امکان نگهداری وضعیت‌ها و داده‌های موقت.
- ⏳ **Auto-TTL** — امکان انقضای خودکار داده‌های موقت برای کنترل مصرف KV.
- 🔐 **Secrets** — نگهداری Token و API Keyها در Environment Variables به‌جای قرار دادن مستقیم در سورس.
- 🌐 **Webhook** — اتصال مستقیم Telegram Bot API به Worker.
- 📱 **سازگار با Telegram** — قابل استفاده از موبایل، دسکتاپ و Web.
- 🧩 **قابل توسعه** — ساختار مناسب برای اضافه‌کردن مدل‌ها، دستورات و قابلیت‌های جدید.

---

## 🧰 پیش‌نیازها

قبل از راه‌اندازی، موارد زیر را آماده کنید:

| مورد | توضیح |
|---|---|
| 🤖 Telegram Bot | دریافت Token از [@BotFather](https://t.me/BotFather) |
| 🧠 AI API Key | کلید API سرویس هوش مصنوعی مورد استفاده |
| 👤 Admin ID | شناسه عددی ادمین ربات |
| ☁️ Cloudflare Account | حساب رایگان Cloudflare |
| 🗃️ KV Namespace | برای ذخیره‌سازی داده‌های موردنیاز ربات |

---

## 🚀 راهنمای گام‌به‌گام راه‌اندازی

### روش اول — راه‌اندازی از طریق Cloudflare Dashboard

این روش برای کاربران عادی و کسانی که نمی‌خواهند با Wrangler کار کنند، ساده‌تر است.

### 1️⃣ ساخت KV Namespace

1. وارد [Cloudflare Dashboard](https://dash.cloudflare.com/) شوید.
2. به بخش **Workers & Pages** بروید.
3. بخش **KV** را باز کنید.
4. روی **Create a Namespace** کلیک کنید.
5. نام پیشنهادی زیر را وارد کنید:

```text
TG_BOT_KV
```

6. Namespace را ایجاد کنید.

---

### 2️⃣ ساخت Worker

1. وارد **Workers & Pages** شوید.
2. روی **Create application** کلیک کنید.
3. گزینه ساخت Worker را انتخاب کنید.
4. یک نام دلخواه برای Worker انتخاب کنید.
5. Worker را Deploy کنید.
6. وارد **Edit code** شوید.
7. کد پروژه را جایگزین کد پیش‌فرض کنید.
8. روی **Save and Deploy** بزنید.

---

### 3️⃣ اتصال KV به Worker

در Worker خود:

```text
Settings
   ↓
Variables
   ↓
KV Namespace Bindings
   ↓
Add binding
```

مقادیر را به این شکل قرار دهید:

| گزینه | مقدار |
|---|---|
| Variable name | `DB` |
| KV Namespace | `TG_BOT_KV` |

سپس **Save and deploy** را بزنید.

> ⚠️ نام Binding باید دقیقاً `DB` باشد، مگر اینکه در سورس پروژه نام دیگری برای KV تعریف شده باشد.

---

## 🧑‍💻 روش دوم — راه‌اندازی با Wrangler

برای توسعه‌دهندگان، استفاده از Wrangler سریع‌تر و قابل‌تکرارتر است.

### 1. کلون کردن Repository

```bash
git clone https://github.com/YOUR_USERNAME/Neo-AI-Bot.git
cd Neo-AI-Bot
```

### 2. ورود به Cloudflare

```bash
npx wrangler login
```

### 3. ساخت KV Namespace

```bash
npx wrangler kv namespace create "TG_BOT_KV"
```

### 4. تنظیم Binding

شناسه Namespace ایجادشده را در تنظیمات Wrangler قرار دهید.

نمونه:

```toml
[[kv_namespaces]]
binding = "DB"
id = "YOUR_KV_NAMESPACE_ID"
```

### 5. Deploy

```bash
npx wrangler deploy
```

پس از Deploy، آدرس Worker معمولاً چیزی شبیه این خواهد بود:

```text
https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev
```

---

## 🔐 تنظیمات و کلیدهای امنیتی (Secrets)

**هیچ‌وقت Token یا API Key را مستقیماً داخل `worker.js`، README یا Repository عمومی قرار ندهید.**

در Cloudflare Worker به مسیر زیر بروید:

```text
Workers & Pages
   ↓
Your Worker
   ↓
Settings
   ↓
Variables
   ↓
Environment Variables
```

کلیدهای زیر را اضافه کنید:

| Variable | توضیحات | نمونه |
|---|---|---|
| `BOT_TOKEN` | توکن ربات دریافت‌شده از BotFather | `123456789:ABC...` |
| `AI_API_KEY` | کلید API سرویس هوش مصنوعی | `AIzaSy...` |
| `ADMIN_ID` | شناسه عددی ادمین | `123456789` |

### 🔒 جدول کلیدهای امنیتی

| کلید | سطح حساسیت | محل نگهداری | داخل Git؟ |
|---|---|---|---|
| `BOT_TOKEN` | 🔴 بسیار حساس | Cloudflare Secrets | ❌ هرگز |
| `AI_API_KEY` | 🔴 بسیار حساس | Cloudflare Secrets | ❌ هرگز |
| `ADMIN_ID` | 🟠 حساس | Environment Variable | ⚠️ ترجیحاً Secret |
| `DB` | 🟡 Binding | KV Binding | ❌ نیازی به قرار دادن در کد ندارد |
| `YOUR_WORKER_URL` | 🟢 عمومی | Webhook Config | ✅ مشکلی ندارد |

> 🚨 اگر Token یا API Key به‌صورت عمومی منتشر شد، آن را فوراً در سرویس مربوطه **Revoke/Rotate** کنید و یک کلید جدید بسازید.

---

## 🔗 تنظیم Webhook

پس از Deploy شدن Worker و ثبت Secretها، باید Telegram را به Worker متصل کنید.

ساختار درخواست:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
```

### نمونه

```text
https://api.telegram.org/bot123456789:YOUR_TOKEN/setWebhook?url=https://neo-ai-bot.example.workers.dev
```

> ⚠️ در Repository عمومی هرگز نمونه واقعی Token را قرار ندهید.

اگر درخواست موفق باشد، Telegram پاسخی شبیه این برمی‌گرداند:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### بررسی وضعیت Webhook

برای بررسی Webhook فعلی:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

نمونه خروجی:

```json
{
  "ok": true,
  "result": {
    "url": "https://YOUR-WORKER.workers.dev/",
    "pending_update_count": 0
  }
}
```

---

## 🧹 حذف Webhook

اگر لازم شد Webhook فعلی را حذف کنید:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
```

سپس می‌توانید Webhook جدید را دوباره تنظیم کنید.

---

## 🩺 عیب‌یابی و نکات مهم

### ❌ ربات هیچ پاسخی نمی‌دهد

ابتدا وضعیت Webhook را بررسی کنید:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

موارد زیر را بررسی کنید:

- URL مربوط به Worker درست باشد.
- Worker واقعاً Deploy شده باشد.
- `BOT_TOKEN` صحیح باشد.
- Webhook روی همان Worker تنظیم شده باشد.
- خطای Runtime در Cloudflare وجود نداشته باشد.

---

### ❌ خطای `Unauthorized`

معمولاً Token ربات اشتباه است.

راه‌حل:

1. وارد [@BotFather](https://t.me/BotFather) شوید.
2. Token جدید دریافت یا Token فعلی را بررسی کنید.
3. مقدار `BOT_TOKEN` را در Cloudflare به‌روزرسانی کنید.
4. Worker را دوباره Deploy کنید.

---

### ❌ خطای API هوش مصنوعی

اگر Telegram پیام را دریافت می‌کند ولی پاسخ AI نمی‌آید:

- مقدار `AI_API_KEY` را بررسی کنید.
- فعال بودن API سرویس موردنظر را بررسی کنید.
- محدودیت درخواست یا Quota را بررسی کنید.
- نام مدل و Endpoint را با کد پروژه تطبیق دهید.

---

### ❌ خطای KV یا Binding

اگر خطایی مرتبط با `DB` یا KV مشاهده می‌کنید:

```text
Settings
   ↓
Variables
   ↓
KV Namespace Bindings
```

بررسی کنید:

```text
Variable name = DB
```

و Namespace صحیح انتخاب شده باشد.

---

### ❌ Webhook تنظیم شده اما Update دریافت نمی‌شود

این موارد را بررسی کنید:

```text
1. Worker deployed?
2. Webhook URL correct?
3. BOT_TOKEN correct?
4. getWebhookInfo چه خطایی نشان می‌دهد؟
5. Worker Logs چه خطایی ثبت کرده؟
```

برای تست سریع، ابتدا:

```text
getWebhookInfo
```

را اجرا کنید و مقدار `last_error_message` را بررسی کنید.

---

### ❌ ربات بعد از مدتی از کار می‌افتد

در Free Tier ممکن است محدودیت‌های سرویس باعث بروز خطا شوند.

پیشنهاد:

- داده‌های موقت را با TTL مدیریت کنید.
- درخواست‌های غیرضروری KV را کاهش دهید.
- API Callهای تکراری را کنترل کنید.
- خطاهای `429` و `5xx` را مدیریت کنید.
- Logs مربوط به Worker را بررسی کنید.

---

## 🗂️ ساختار پیشنهادی Repository

```text
Neo-AI-Bot/
├── worker.js
├── wrangler.toml
├── README.md
├── LICENSE
├── logo.png
├── panel-screenshot.jpg
└── .gitignore
```

> فایل‌های `logo.png` و `panel-screenshot.jpg` فقط برای نمایش بهتر README هستند و می‌توانید نام آن‌ها را تغییر دهید.

---

## 🛡️ امنیت

برای حفظ امنیت پروژه:

- ❌ `BOT_TOKEN` را در GitHub قرار ندهید.
- ❌ `AI_API_KEY` را داخل `worker.js` هاردکد نکنید.
- ❌ Secrets را داخل Screenshot منتشر نکنید.
- ❌ Token را داخل Issue یا Pull Request قرار ندهید.
- ✅ از Cloudflare Environment Variables / Secrets استفاده کنید.
- ✅ در صورت افشای Token، آن را فوراً Rotate کنید.
- ✅ Repository را قبل از Public کردن برای کلیدهای حساس بررسی کنید.

### نمونه `.gitignore`

```gitignore
.env
.env.*
.dev.vars
wrangler.local.toml
secrets.json
*.secret
```

---

## 📊 معماری ساده پروژه

```text
                 ┌──────────────────┐
                 │     Telegram     │
                 │      Bot API     │
                 └────────┬─────────┘
                          │
                       Webhook
                          │
                          ▼
                 ┌──────────────────┐
                 │ Cloudflare       │
                 │ Worker           │
                 │                  │
                 │  Neo AI Bot      │
                 └───────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
      ┌──────────────┐      ┌──────────────┐
      │ Cloudflare   │      │   AI API     │
      │ KV / DB      │      │ Provider     │
      └──────────────┘      └──────────────┘
```

---

## 🧪 تست سریع بعد از نصب

پس از تنظیم Webhook:

1. وارد ربات شوید.
2. `/start` را ارسال کنید.
3. یک پیام آزمایشی ارسال کنید.
4. پاسخ AI را بررسی کنید.
5. در صورت عدم پاسخ، `getWebhookInfo` و Worker Logs را بررسی کنید.

---

## 📌 نکات مربوط به Cloudflare Free Tier

این پروژه برای استفاده کم‌هزینه و آزمایشی طراحی شده است؛ با این حال، محدودیت‌های Cloudflare و سرویس AI مورد استفاده ممکن است در طول زمان تغییر کنند.

بنابراین:

- محدودیت‌های روزانه را در نظر بگیرید.
- از Loopهای ناخواسته جلوگیری کنید.
- KV را بی‌دلیل زیاد صدا نزنید.
- برای پروژه‌های پرترافیک، محدودیت‌های فعلی سرویس‌ها را بررسی کنید.

> ℹ️ رایگان بودن Worker به معنی رایگان بودن API سرویس هوش مصنوعی متصل‌شده نیست.

---

## 🤝 مشارکت

Pull Request و Issue برای بهبود پروژه استقبال می‌شود.

قبل از ارسال Pull Request:

```text
✓ کد را تست کنید
✓ Secret واقعی داخل Commit نباشد
✓ تغییرات را واضح توضیح دهید
✓ ساختار اصلی Worker را حفظ کنید
```

---

## 📜 License

این پروژه تحت مجوز **MIT License** منتشر شده است.

برای جزئیات کامل به فایل [`LICENSE`](LICENSE) مراجعه کنید.

---

## 👤 سازنده و کانال توسعه‌دهنده

این پروژه توسط **NeoTenet** توسعه داده شده است.

برای دریافت پروژه‌ها، آموزش‌ها، آپدیت‌ها و سورس‌کدهای جدید:

<div align="center">

[![Telegram](https://img.shields.io/badge/Telegram-@NeoTenet-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/NeoTenet)

**📢 کانال توسعه‌دهنده:** [t.me/NeoTenet](https://t.me/NeoTenet)

</div>

---

<div align="center">

### ⭐ اگر پروژه برای شما مفید بود، یک Star به Repository بدهید!

**Made with ❤️ by NeoTenet**

</div>

</div>
