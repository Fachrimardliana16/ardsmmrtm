# Implementation & Deployment Document (IPD)
**Project Name:** Ardson Maritime Deployment Strategy  
**Document Version:** v1.0  

---

## 1. Deployment Environment Strategy

Proyek akan dijalankan melalui 3 lingkungan kerja (*environment*):

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   DEVELOPMENT    │ ───► │     STAGING      │ ───► │    PRODUCTION    │
│ (Local / Branch) │      │ (staging.ardson) │      │(ardsonmaritime)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

1. **Development:** Lingkungan pengembangan lokal pengembang.
2. **Staging:** Lingkungan pengujian internal dan tinjauan oleh manajemen Ardson Maritime (`staging.ardsonmaritime.com`).
3. **Production:** Lingkungan publik siap pakai berkinerja tinggi (`ardsonmaritime.com`).

---

## 2. Hosting & Infrastructure Setup

* **Frontend Hosting:** Vercel / Netlify / AWS Amplify (Static Host dengan Edge CDN global untuk pemuatan cepat di berbagai port dunia).
* **Domain & DNS:** Cloudflare DNS (memanfaatkan WAF & SSL proxy gratis).
* **SSL Certificate:** Cloudflare Full (Strict) TLS 1.3 Encryption.
* **Database Hosting:** AWS RDS PostgreSQL / DigitalOcean Managed Database.

---

## 3. Deployment Checklist

### 3.1 Pre-Launch Verification
- [x] Pastikan seluruh navigasi regrouped (Pelaut, Perusahaan, Informasi) berfungsi di layar Desktop & Mobile.
- [x] Verifikasi modul modal popup (Form Pelaut & Form Principal) dapat menerima data dengan benar.
- [x] Uji keterbacaan font dan kontras warna sesuai standar aksesibilitas web.
- [x] Pastikan notifikasi Toast feedback berjalan saat pengiriman formulir.

### 3.2 Post-Launch Monitoring
- [ ] Aktivasi Google Analytics 4 (GA4) untuk memantau trafik pengunjung pelaut dan principal.
- [ ] Monitoring uptime server via UptimeRobot (Target availability 99.9%).
- [ ] Pengujian performa berkala menggunakan Google PageSpeed Insights.