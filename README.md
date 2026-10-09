<div align="center">

<img src="logo.png" alt="Neo AI Bot Logo" width="150" height="150" />

# 🤖 Neo AI Bot

**ربات هوش مصنوعی پیشرفته تلگرام؛ پایدار، رایگان و بهینه‌سازی‌شده برای Cloudflare Workers + Upstash Redis**

[![Developer Channel](https://img.shields.io/badge/Telegram-Channel-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/NeoTenet)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Upstash Redis](https://img.shields.io/badge/Upstash-Redis-00E599?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![License](https://img.shields.io/badge/License-MIT-2ea44f?style=for-the-badge)](LICENSE)

**[پیش‌نمایش](#-پیشنمایش-محیط-ربات-و-پنل) • [ویژگی‌ها](#-ویژگیهای-کلیدی) • [امنیت گروه‌ها](#-امنیت-و-مدیریت-پیشرفته-گروهها) • [پیش‌نیازها](#-پیشنیازها) • [راه‌اندازی](#-راهنمای-گامبهگام-راهاندازی) • [Secrets](#-تنظیمات-و-کلیدهای-امنیتی-secrets) • [Webhook](#-تنظیم-webhook) • [عیبیابی](#-عیبیابی-و-نکات-مهم)**

</div>

---

<div dir="rtl">

## 📖 درباره پروژه

**Neo AI Bot** یک ربات هوش مصنوعی چندمنظوره برای تلگرام است که روی زیرساخت Serverless سرویس **Cloudflare Workers** به همراه دیتابیس ابری **Upstash Redis REST API** اجرا می‌شود.

این پروژه برای پردازش‌های پس‌زمینه از `ctx.waitUntil` استفاده می‌کند تا درخواست وب‌هوک تلگرام سریع تأیید شود. همچنین با اعمال لایه‌های امنیتی دقیق روی دستورات گروه‌ها، از دسترسی غیرمجاز کاربران عادی جلوگیری می‌کند.

> 💡 **هدف پروژه:** راه‌اندازی یک ربات هوش مصنوعی تلگرامی با زیرساخت Serverless، امنیت بالا و مدیریت کامل در گروه‌ها و چت خصوصی.

---

## 📸 پیش‌نمایش محیط ربات و پنل

<div align="center">

<img src="panel-screenshot.jpg" alt="Neo AI Bot Panel Preview" width="100%" />

<sub>نمای پنل مدیریت، انتخاب مدل‌ها و پاسخ‌دهی ربات Neo AI Bot</sub>

</div>

---

## ✨ ویژگی‌های کلیدی

- ⚡ **پاسخ سریع به وب‌هوک** — امکان تأیید سریع درخواست تلگرام و پردازش پایدار.
- 🗃️ **دیتابیس Upstash Redis REST API** — ذخیره تاریخچه چت، جلسات و تنظیمات در Redis.
- 🧠 **پشتیبانی از چندین مدل AI** — مدیریت مدل‌های متنی، کدنویسی، Vision و تولید تصویر.
- 👥 **امنیت پیشرفته گروه‌ها** — تفکیک دقیق دسترسی ادمین‌ها و کاربران عادی در گروه.
- 🛠️ **پنل مدیریت ادمین** — مدیریت مدل‌ها، کاربران، مسدودسازی و اسپانسرینگ.
- 📢 **قفل عضویت کانال اسپانسر** — الزام کاربر به عضویت در کانال‌های مشخص‌شده در پیوی.

---

## 🛡️ امنیت و مدیریت پیشرفته گروه‌ها

در این نسخه، باگ‌های امنیتی مهم مربوط به تعاملات گروهی برطرف شده است:

1. **دستور مدیریت گروه‌ها (`/bot`):** تمام دستورات مدیریتی و کنترلی ربات در گروه (مانند سکوت، صحبت، تست و راهنما) **منحصراً در اختیار ادمین‌های گروه** است. اگر کاربر عادی این دستورات را ارسال کند، ربات به‌طور کامل و بی‌صدا پیام را نادیده می‌گیرد.
2. **دستور شروع (`/start`) در گروه:** اگر کاربری دستور `/start` را در گروه ارسال کند، ربات از نمایش منوی خصوصی جلوگیری کرده و با یک دکمه شیشه‌ای ایمن، کاربر را به چت خصوصی (پیوی) هدایت می‌کند.
3. **دستور تغییر مدل (`/models`) در گروه:** تغییر مدل هوش مصنوعی ربات در محیط گروه صرفاً توسط ادمین‌های گروه مجاز است تا از تغییرات ناخواسته تنظیمات توسط سایر کاربران جلوگیری شود.

---

## 🧰 پیش‌نیازها

| مورد | توضیح |
|---|---|
| 🤖 Telegram Bot | دریافت Token از [@BotFather](https://t.me/BotFather) (در صورت نیاز به دریافت منشن‌ها، تنظیمات Group Privacy را بررسی کنید) |
| 🗃️ Upstash Redis | ساخت دیتابیس در [Upstash](https://upstash.com/) و دریافت REST URL و Token |
| 👤 Admin ID | شناسه عددی ادمین ربات |
| ☁️ Cloudflare Account | حساب Cloudflare برای ساخت Worker |

---

## 🚀 راهنمای گام‌به‌گام راه‌اندازی

### ۱. ساخت دیتابیس Upstash Redis

یک دیتابیس Redis در پنل Upstash بسازید و مقادیر زیر را دریافت کنید:

- `UPSTASH_URL`
- `UPSTASH_TOKEN`

### ۲. ساخت Cloudflare Worker

1. وارد داشبورد Cloudflare شوید.
2. یک Worker جدید ایجاد کنید.
3. محتوای فایل `worker.js` را در ویرایشگر Worker قرار دهید.
4. Worker را Deploy کنید.

> نام فایل اصلی در مخزن شما ممکن است متفاوت باشد؛ در این صورت، کد فایل Worker اصلی پروژه را قرار دهید.

### ۳. تنظیم متغیرها و کلیدهای امنیتی (Secrets)

در داشبورد Cloudflare، به بخش **Workers & Pages → Worker → Settings → Variables and Secrets** بروید و متغیرهای زیر را تنظیم کنید:

| نام متغیر | مقدار |
|---|---|
| `BOT_TOKEN` | توکن ربات از BotFather |
| `ADMIN_ID` | شناسه عددی ادمین ربات |
| `UPSTASH_URL` | آدرس REST دیتابیس Upstash |
| `UPSTASH_TOKEN` | توکن دسترسی REST دیتابیس Upstash |

مقادیر محرمانه را در مخزن عمومی GitHub یا داخل کد منتشر نکنید. برای توکن‌ها از بخش Secrets داشبورد Cloudflare استفاده کنید.

---

## 🔗 تنظیم Webhook

پس از Deploy کردن Worker، آدرس آن را به‌عنوان Webhook ربات تلگرام ثبت کنید. نشانی زیر را با مقادیر واقعی جایگزین کنید:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev/
```

- `<YOUR_BOT_TOKEN>`: توکن ربات تلگرام
- `<YOUR_WORKER_NAME>`: نام Worker
- `<YOUR_SUBDOMAIN>`: زیردامنه حساب Cloudflare

پس از اجرای نشانی، پاسخ تلگرام را بررسی کنید تا از ثبت موفق Webhook مطمئن شوید. توکن ربات را در اختیار دیگران قرار ندهید.

---

## 🩺 عیب‌یابی و نکات مهم

- **ربات در گروه پاسخ نمی‌دهد:** دسترسی‌های ربات و تنظیمات حریم خصوصی گروه را در BotFather بررسی کنید. برای دریافت پیام‌های معمولی گروه ممکن است لازم باشد تنظیمات `/setprivacy` را متناسب با نیاز تغییر دهید.
- **ربات منشن‌ها را دریافت نمی‌کند:** مطمئن شوید منشن به نام کاربری صحیح ربات اشاره می‌کند و تنظیمات گروه و BotFather اجازه دریافت پیام موردنظر را می‌دهند.
- **خطا در اتصال Redis:** مقدارهای `UPSTASH_URL` و `UPSTASH_TOKEN` را بررسی کنید و مطمئن شوید از REST URL و توکن صحیح استفاده شده است.
- **Webhook کار نمی‌کند:** آدرس Worker را بررسی کنید، مطمئن شوید Deploy موفق بوده و Webhook به آدرس صحیح اشاره می‌کند.
- **خطا در متغیرهای محیطی:** نام متغیرها باید دقیقاً با نام‌هایی که کد Worker استفاده می‌کند مطابقت داشته باشد.
- **تایم‌اوت یا پردازش طولانی:** محدودیت‌های اجرای Cloudflare Workers به پلن و نوع درخواست بستگی دارد. لاگ‌های Worker را برای تشخیص خطا بررسی کنید.

---

## 📜 مجوز (License)

این پروژه تحت مجوز **MIT** منتشر شده است. برای جزئیات، فایل [`LICENSE`](LICENSE) را ببینید.

---

## 👤 سازنده و کانال توسعه‌دهنده

توسعه‌یافته توسط **NeoTenet**

[📢 کانال تلگرام NeoTenet](https://t.me/NeoTenet)

</div>
