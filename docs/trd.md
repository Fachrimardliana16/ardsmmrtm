# Technical Requirement Document (TRD)
**Project Name:** Ardson Maritime Platform  
**Document Version:** v1.0  
**Stack Overview:** Modern Jamstack / SPA Ready (HTML5, Tailwind CSS, JS, REST API Target)  

---

## 1. System Architecture Overview

Platform dirancang dengan arsitektur frontend terpisah dari backend API (*Decoupled Architecture*) untuk memastikan skalabilitas dan performa maksimal saat diakses dari jaringan maritim/port.

```
[ Frontend Client (Single File / React SPA) ]
                    │
                    ▼ (HTTPS / JSON REST API)
┌──────────────────────────────────────────────┐
│           Backend API Gateway                │
├──────────────────────┬───────────────────────┤
│ Seafarer Module      │ Principal Module      │
│ Job Board Engine     │ Notification Service  │
└──────────┬───────────┴───────────┬───────────┘
           │                       │
           ▼                       ▼
   ┌───────────────┐       ┌───────────────┐
   │ Relational DB │       │ Cloud Storage │
   │ (PostgreSQL)  │       │ (S3 / CV Docs)│
   └───────────────┘       └───────────────┘
```

---

## 2. Technology Stack Specifications

* **Frontend Framework/UI:** HTML5, Tailwind CSS (v3.x CDN/Build), Vanilla JavaScript ES6+.
* **Typography & Icons:** Google Fonts (Inter), Inline Vector SVG Icons (Heroicons pattern).
* **Backend Target (Recommended):** Node.js (Express.js) atau Laravel PHP (v10+).
* **Database:** PostgreSQL (Production) / MySQL 8.0+.
* **File Storage:** AWS S3 / Cloudinary (untuk penyimpanan PDF CV & sertifikat pelaut).
* **Notification & Mailer:** SMTP Service (SendGrid/Mailgun) & Integration WhatsApp Business API (Twilio/WABA).

---

## 3. Technical Specifications & Endpoints (API Interface)

### 3.1 Candidate (Seafarer) Endpoints
* `GET /api/v1/jobs` — Mengambil daftar lowongan kapal aktif (mendukung parameter `?category=deck|engine|hotel`).
* `POST /api/v1/seafarers/register` — Mengirimkan formulir pendaftaran pelaut dan berkas CV.
  * **Payload:** `name`, `email`, `phone`, `applied_rank`, `vessel_experience`, `certifications[]`, `cv_file`.

### 3.2 Principal (Shipowner) Endpoints
* `POST /api/v1/principals/crew-request` — Mengirimkan pengajuan kebutuhan awak kapal.
  * **Payload:** `company_name`, `email`, `vessel_type`, `joining_date`, `required_ranks`, `contract_duration`, `flag_state`.

### 3.3 Public & Contact Endpoints
* `POST /api/v1/contact` — Mengirimkan pesan umum dari form kontak.
* `POST /api/v1/newsletter` — Berlangganan newsletter pembaruan lowongan.

---

## 4. Security & Compliance Requirements

1. **HTTPS & TLS 1.3:** Seluruh komunikasi data wajib terenkripsi.
2. **Form Sanitization & Validation:** Mencegah serangan XSS dan SQL Injection pada input form registrasi.
3. **CORS Policy:** Membatasi akses API hanya dari domain resmi `ardsonmaritime.com`.
4. **File Upload Security:** Batasi jenis berkas unggahan hanya `.pdf`, `.doc`, `.docx` dengan ukuran maksimum 5MB. Virus scanning otomatis pada berkas yang diunggah.