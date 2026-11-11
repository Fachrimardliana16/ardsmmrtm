# Product Requirement Document (PRD)
**Project Name:** Ardson Maritime Career Center Platform Redesign  
**Document Version:** v1.0  
**Target Audience:** Seafarers (Pelaut), Principals (Shipping Companies), Admin/Crewing Team  
**Compliance Standard:** STCW 2010 Manila Amendments & MLC 2006  

---

## 1. Executive Summary & Vision
Ardson Maritime Career Center adalah agensi penyalur tenaga kerja pelayaran (*manning agency*) di Indonesia. Redesign platform ini bertujuan untuk mentransformasi platform web dari sekadar tampilan dasar menjadi portal rekrutmen maritim modern, profesional, dan tepercaya yang menghubungkan dua pihak utama:
1. **Pelaut (Seafarers):** Mendaftar, membuat profil profesional, mengunggah sertifikat STCW, dan melamar posisi kapal secara gratis.
2. **Perusahaan (Principals/Shipowners):** Mengajukan kebutuhan awak kapal (*crew request*) secara cepat dan mendapatkan kandidat yang sudah diverifikasi legalitas dan kualifikasinya.

---

## 2. User Personas & Target Audience

### 2.1 Persona 1: Pelaut / Awam Kapal (Seafarer Candidate)
* **Kategori:** Perwira (Officer) & Rating (Deck, Engine, Hotel/Catering).
* **Kebutuhan:** Informasi lowongan kerja yang jelas (gaji, tipe kapal, durasi kontrak), formulir pendaftaran yang mudah diakses dari ponsel, tanpa biaya rekrutmen tersembunyi.
* **Pain Point:** Kesulitan melamar kerja pelayaran secara terstruktur, maraknya penipuan agensi bodong.

### 2.2 Persona 2: Shipowner / Principal (Klien Perusahaan)
* **Kategori:** Perusahaan Pelayaran Internasional / Ship Manager (Container, Tanker, Bulk, Offshore, Cruise).
* **Kebutuhan:** Pengadaan kru kapal yang cepat, jaminan keaslian dokumen sertifikasi STCW & MCU medical fit, kualifikasi bahasa Inggris (Marlins).
* **Pain Point:** Proses penyediaan kru yang lambat dan kandidat yang tidak memenuhi standar flag state.

### 2.3 Persona 3: Internal Crewing Officer (Admin Agensi)
* **Kebutuhan:** Dashboard untuk mengelola pelamar, memverifikasi dokumen pelaut, serta menindaklanjuti permintaan kru dari principal.

---

## 3. Product Features & Requirements

### 3.1 Feature Breakdown

| ID | Fitur | Prioritas | Deskripsi |
|---|---|---|---|
| **F-01** | Hero Section & Dual CTA | **P0** | Banner utama bertema maritim dengan tombol pilihan jelas: "Explore Vacancies" (Pelaut) & "Submit Crew Requirement" (Principal). |
| **F-02** | Live Job Board & Filter | **P0** | Listing lowongan kapal yang dapat difilter berdasarkan kualifikasi (Deck, Engine, Hotel/Catering). |
| **F-03** | Portal Registrasi Pelaut (Modal) | **P0** | Form pendaftaran kandidat: Data diri, pilihan rank, checklist sertifikat (BST, MCU, Seaman Book), dan unggah CV. |
| **F-04** | Form Crew Request Principal (Modal) | **P0** | Form permintaan kru dari perusahaan: Nama perusahaan, tipe kapal, jumlah & rank kru yang dibutuhkan, target joining, flag state. |
| **F-05** | Regrouped Responsive Navigation | **P1** | Navigasi ringkas dengan dropdown: Pelaut, Perusahaan, Informasi & Kontak, serta menu mobile drawer. |
| **F-06** | Modul Pelatihan & Guidance | **P1** | Informasi panduan sertifikasi STCW 2010, perpanjangan buku pelaut, dan persiapan Marlins Test. |
| **F-07** | Toast Notification System | **P1** | Umpan balik visual langsung saat form berhasil dikirim tanpa perlu reload halaman. |

---

## 4. Non-Functional Requirements (NFR)

* **Performance:** Waktu muat halaman pertama (*First Contentful Paint*) < 2.0 detik pada koneksi 4G.
* **Security & Privacy:** Enkripsi data dokumen pelaut (CV, sertifikat) dan kepatuhan terhadap UU Perlindungan Data Pribadi.
* **Regulatory Compliance:** Wajib memenuhi standar **MLC 2006 (Maritime Labour Convention)** yaitu *Zero Fee Policy for Seafarers* (tidak memungut biaya pendaftaran dari pelaut).
* **Usability & Accessibility:** Antarmuka responsif (Mobile-first ready), rasio kontras warna memadai (Navy & Oceanic Blue palette).