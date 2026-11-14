# Application Flow Document (AFD)
**Project Name:** Ardson Maritime Career Center Flow Map  
**Document Version:** v1.0  

---

## 1. User Journey Overview

Aplikasi memiliki dua alur utama berdasarkan persona pengguna yang masuk ke landing page:
1. **Seafarer Journey (Pelaut)**
2. **Principal Journey (Perusahaan Pelayaran)**

---

## 2. Detailed Flow Diagrams

### 2.1 Alur Pengguna: Pelaut (Seafarer Flow)

```
[ Landing Page (#home) ]
          │
          ├───────────► [ Klik Menu "Cari Lowongan" (#jobs) ]
          │                         │
          │                         ▼
          │             [ Filter Departemen (Deck/Engine/Hotel) ]
          │                         │
          │                         ▼
          │             [ Pilih Kartu Lowongan Kapal ]
          │                         │
          │                         ▼
          ├───────────► [ Klik Button "Apply For Position" ]
          │                         │
          │                         ▼
          │             [ Pop-up Modal: Register Profile ]
          │                         │
          │             - Isi Data Diri & Contact
          │             - Pilih Rank Target & Pengalaman
          │             - Checklist Sertifikat STCW
          │             - Upload Berkas CV (PDF)
          │                         │
          │                         ▼
          │             [ Submit Form Registrasi ]
          │                         │
          └─────────────────────────┼──────────────────────────┐
                                    ▼                          ▼
                        [ Toast: Success Message ]   [ Kirim Data ke DB & Email Admin ]
```

---

### 2.2 Alur Pengguna: Perusahaan (Principal Crew Request Flow)

```
[ Landing Page (#home) ]
          │
          ├───────────► [ Klik Button "Cari Kru / Hire Crew" / CTA Hero ]
          │                         │
          │                         ▼
          │             [ Pop-up Modal: Principal Crew Request ]
          │                         │
          │             - Nama Perusahaan & Contact Email
          │             - Pilih Tipe Kapal & Target Joining Date
          │             - Rincian Kebutuhan Rank & Jumlah Kru
          │             - Contract Duration & Flag State
          │                         │
          │                         ▼
          │             [ Submit Crew Requirement ]
          │                         │
          └─────────────────────────┼──────────────────────────┐
                                    ▼                          ▼
                        [ Toast: Success Notification ] [ Alert WhatsApp/Email ke Crewing Manager ]
```

---

## 3. Layout Navigation Map

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HEADER / NAVIGATION (Glassmorphism Sticky)                                       │
│ [Logo Ardson Maritime] | Home | Pelaut ▾ | Perusahaan ▾ | Informasi ▾ | [Portal] [Hire Crew] │
└──────────────────────────────────────────────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 1: HERO SECTION (Headline + Search + Dual Primary Buttons + Live Stats) │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 2: DUAL-PATH AUDIENCE CARDS (For Seafarers vs For Principals)           │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┘
 │ SECTION 3: TRUST & COMPLIANCE BADGES (100% Verified, STCW/MLC, Global Network)  │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 4: LIVE JOB BOARD (Category Tabs: Deck, Engine, Hotel + Apply Trigger) │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 5: MARITIME TRAINING & STCW GUIDANCE                                    │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 6: MARITIME INSIGHTS (Blog & Articles)                                  │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ SECTION 7: ABOUT US & LOCATION + CONTACT FORM                                   │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
 ┌───────────────────────────────────────┴─────────────────────────────────────────┐
 │ FOOTER (Quick Links, Legal Statements, Newsletter Subscription)                 │
 └─────────────────────────────────────────────────────────────────────────────────┘
```