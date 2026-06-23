# 3X-UI Manager

پنل مدیریت متمرکز برای چندین سرور 3x-ui با رابط کاربری فارسی (RTL).

## امکانات

- مدیریت چند پنل 3x-ui از یک مکان
- نمایش وضعیت سرور (CPU, RAM, Disk, Uptime, سرعت شبکه)
- مدیریت کاربران (افزودن، ویرایش، حذف، ریست ترافیک)
- جستجو و فیلتر کاربران (فعال/غیرفعال/منقضی/در حال انقضا)
- مرتب‌سازی و صفحه‌بندی کاربران
- نمایش لینک کانفیگ و سابسکریپشن با QR Code
- بکاپ و بازیابی دیتابیس پنل‌ها
- بکاپ خودکار
- تم روشن/تاریک
- طراحی ریسپانسیو (موبایل + دسکتاپ)
- کلیدهای میانبر (R = بروزرسانی, Ctrl+F = جستجو)

## نصب خودکار (Ubuntu)

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/hasan1808/3xui-manager/main/install.sh)"
```

## نصب دستی

### پیش‌نیازها

- Node.js 18+
- npm 9+

### مراحل

```bash
# کلون کردن پروژه
git clone https://github.com/hasan1808/3xui-manager.git
cd 3xui-manager

# نصب وابستگی‌ها
npm install

# تنظیم متغیرهای محیطی
cp .env.example .env.local
# ویرایش .env.local با مقادیر دلخواه

# بیلد پروژه
npm run build

# اجرای سرور
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
| `JWT_SECRET` | (随机) | کلید رمزنگاری JWT |
| `ADMIN_USER` | `admin` | نام کاربری ادمین |
| `ADMIN_PASS` | `admin123` | رمز عبور ادمین |

### افزودن پنل

1. به صفحه **پنل‌ها** بروید
2. روی **+ پنل جدید** کلیک کنید
3. اطلاعات پنل 3x-ui را وارد کنید:
   - نام پنل
   - آدرس (مثلاً `https://panel.example.com:54321`)
   - نام کاربری و رمز عبور یا API Token
   - آدرس سابسکریپشن (اختیاری)

## ساختار پروژه

```
├── app/                    # صفحات Next.js
│   ├── api/                # API routes
│   ├── admin/              # صفحه تنظیمات
│   ├── backup/             # صفحه بکاپ
│   ├── dashboard/          # داشبورد
│   ├── logs/               # لاگ عملیات
│   ├── login/              # صفحه ورود
│   └── panels/             # مدیریت پنل‌ها
├── lib/                    # کتابخانه‌ها
│   ├── backup-store.ts     # ذخیره بکاپ
│   ├── confirm-dialog.tsx  # دیالوگ تایید
│   ├── focus-trap.tsx      # مدیریت فوکوس
│   ├── keyboard.ts         # کلیدهای میانبر
│   ├── log-store.ts        # ذخیره لاگ
│   ├── navbar.tsx          # نوار پیمایش
│   ├── panel-store.ts      # ذخیره پنل‌ها
│   ├── spinner.tsx         # اسپینر و Skeleton
│   ├── theme-context.tsx   # تم روشن/تاریک
│   ├── toast-context.tsx   # نوتیفیکیشن
│   ├── types.ts            # تایپ‌ها
│   ├── use-settings.ts     # تنظیمات
│   └── xui-api.ts          # کلاینت API 3x-ui
├── data/                   # داده‌ها (JSON)
└── public/                 # فایل‌های استاتیک
```

## کلیدهای میانبر

| کلید | عمل |
|------|-----|
| `R` | بروزرسانی داشبورد |
| `Ctrl+F` | جستجو |
| `Esc` | بستن مودال |

## لایسنس

MIT License
