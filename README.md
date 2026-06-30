# 3X-UI Manager v1.1

پنل مدیریت متمرکز برای چندین سرور 3x-ui با رابط کاربری فارسی (RTL).

## امکانات

### مدیریت پنل‌ها
- افزودن، ویرایش و حذف پنل‌های 3x-ui
- نمایش وضعیت سرور (CPU, RAM, Disk, Uptime, سرعت شبکه)
- اتصال با URL و API Token
- آدرس سابسکریپشن جداگانه برای مشتریان

### مدیریت مشتریان
- ایجاد و مدیریت حساب مشتریان
- اختصاص اینباند به مشتریان
- نمایش آمار و مصرف هر مشتری
- لینک‌های اختصاصی مشتریان

### سیستم مالی
- کیف پول اختصاصی هر مشتری (تومان)
- قیمت‌گذاری اختصاصی مشتری و پنل
- تاریخچه کامل تراکنش‌ها
- درخواست شارژ با آپلود رسید بانکی
- کارت بانکی چندتایی
- کسر خودکار از کیف پول (بر اساس مصرف اینباند)

### بکاپ و بازیابی
- بکاپ دیتابیس کامل پنل‌ها
- بکاپ سیستم (ZIP) شامل تمام فایل‌های داده
- بازیابی از فایل ZIP یا JSON
- بکاپ خودکار با تنظیم فاصله زمانی
- بکاپ فایل‌های پنل‌های راه دور

### امنیت
- احراز هویت JWT با سشن ۱۰ دقیقه‌ای
- نقش‌های سوپرادمین و مشتری
- محدودیت نرخ درخواست (Rate Limiting)
- CSRF Protection
- هشدار Caps Lock در صفحه لاگین

### رابط کاربری
- تم روشن/تاریک
- طراحی واکنش‌گرا (موبایل + دسکتاپ)
- تاریخ و زمان شمسی
- اعداد انگلیسی در نمایش مالی
- کلیدهای میانبر (R = بروزرسانی, Ctrl+F = جستجو, Esc = بستن)

## نصب خودکار (Ubuntu)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/mahdibprogram/3xui-manager/main/install.sh)"
```

> **توجه:** دانلود و نصب کدها بسته به سرعت اینترنت ممکن است چند دقیقه زمان ببرد. لطفاً صبور باشید.

## نصب دستی

### پیش‌نیازها

- Node.js 18+
- npm 9+

### مراحل

```bash
# کلون کردن پروژه
git clone https://github.com/mahdibprogram/3xui-manager.git
cd 3xui-manager

# نصب وابستگی‌ها
npm install

# اجرای سرور توسعه
npm run dev

# یا بیلد و اجرای سرور تولید
npm run build
npm start
```

سرور روی پورت 3000 اجرا می‌شود: `http://your-server:3000`

### تنظیم به عنوان سرویس Systemd

```bash
sudo nano /etc/systemd/system/3xui-manager.service
```

محتوا:

```ini
[Unit]
Description=3X-UI Manager
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/3xui-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable 3xui-manager
sudo systemctl start 3xui-manager
```

## تنظیمات

### متغیرهای محیطی (.env.local)

| متغیر | پیش‌فرض | توضیح |
|--------|---------|-------|
| `JWT_SECRET` | (خودکار) | کلید رمزنگاری JWT |
| `ADMIN_USER` | `admin` | نام کاربری اولیه |
| `ADMIN_PASS` | `admin123` | رمز عبور اولیه |
| `SSL_ENABLED` | `false` | فعال‌سازی SSL |

### نقش‌ها

| نقش | دسترسی |
|------|--------|
| سوپرادمین | مدیریت کامل: پنل‌ها، مشتریان، مالی، بکاپ، تنظیمات |
| مشتری | مشاهده اینباندهای اختصاصی، کیف پول، درخواست شارژ |

### افزودن پنل

1. به صفحه **پنل‌ها** بروید
2. روی **+ پنل جدید** کلیک کنید
3. اطلاعات پنل 3x-ui را وارد کنید:
   - نام پنل
   - آدرس اتصال (مثلاً `https://panel.example.com:54321`)
   - آدرس سابسکریپشن (برای لینک‌های مشتری)
   - نام کاربری و رمز عبور یا API Token

## ساختار پروژه

```
├── app/                        # صفحات Next.js
│   ├── admin/                  # بخش مدیریت (سوپرادمین)
│   │   ├── dashboard/          # داشبورد اصلی
│   │   ├── panels/             # مدیریت پنل‌ها
│   │   ├── admins/             # مدیریت مشتریان + کیف پول
│   │   ├── finance/            # بخش مالی (قیمت‌ها، تراکنش‌ها، کسر خودکار)
│   │   ├── settings/           # تنظیمات عمومی + پشتیبان‌گیری
│   │   └── logs/               # سابقه عملیات
│   ├── user/                   # بخش مشتری
│   │   ├── page.tsx            # داشبورد مشتری
│   │   └── wallet/             # کیف پول و درخواست شارژ
│   ├── api/                    # API Routes
│   │   ├── auth/               # احراز هویت
│   │   ├── panels/             # مدیریت پنل‌ها
│   │   ├── finance/            # تراکنش‌ها، قیمت‌گذاری، کسر خودکار
│   │   ├── backup/             # بکاپ سیستم و پنل‌ها
│   │   ├── wallet/             # درخواست شارژ
│   │   └── logs/               # لاگ عملیات
│   ├── login/                  # صفحه ورود
│   └── backup/                 # صفحه بکاپ (legacy)
├── lib/                        # کتابخانه‌ها
│   ├── admin-store.ts          # ذخیره مشتریان و نقش‌ها
│   ├── auto-deduct-store.ts    # کسر خودکار
│   ├── backup-store.ts         # ذخیره بکاپ
│   ├── bank-card-store.ts      # کارت‌های بانکی
│   ├── client-pricing-store.ts # قیمت‌گذاری مشتریان
│   ├── finance-store.ts        # تراکنش‌ها
│   ├── inbound-ownership-store.ts # اختصاص اینباند
│   ├── navbar.tsx              # نوار پیمایش
│   ├── panel-store.ts          # ذخیره پنل‌ها
│   ├── persian-date.ts         # تاریخ شمسی
│   ├── settings-store.ts       # تنظیمات
│   ├── types.ts                # تعریف تایپ‌ها
│   ├── wallet-request-store.ts # درخواست‌های شارژ
│   └── xui-api.ts              # کلاینت API 3x-ui
├── data/                       # داده‌های JSON
│   ├── admins.json             # مشتریان
│   ├── panels.json             # پنل‌ها
│   ├── transactions.json       # تراکنش‌ها
│   ├── client-pricing.json     # قیمت‌های اختصاصی
│   ├── inbound-ownership.json  # اختصاص اینباندها
│   ├── wallet-requests.json    # درخواست‌های شارژ
│   ├── bank-card.json          # کارت‌های بانکی
│   └── ...                     # سایر فایل‌های داده
└── public/                     # فایل‌های استاتیک
```

## کلیدهای میانبر

| کلید | عمل |
|------|-----|
| `R` | بروزرسانی داشبورد |
| `Ctrl+F` | جستجو |
| `Esc` | بستن مودال / بازگشت به داشبورد |

## فناوری‌ها

- **Framework:** Next.js 16 (App Router)
- **زبان:** TypeScript
- **استایل:** Tailwind CSS v4
- **تاریخ:** jalali-moment (شمسی)
- **بکاپ:** jszip
- **احراز هویت:** JWT + Cookie
- **ذخیره‌سازی:** فایل‌های JSON

## لایسنس

MIT License

## انتقاد و پیشنهاد

برای انتقاد و پیشنهادها ایمیل بزنید: [admin@free-internet.me](mailto:admin@free-internet.me)
