# 🤖 CV Screening Automation

> **Dari 500 CV masuk → shortlist kandidat terbaik → notifikasi recruiter — semua otomatis, tanpa sentuh manual.**

Pipeline AI-driven berbasis **n8n** yang memproses CV kandidat end-to-end: intake, parsing, scoring, hingga shortlisting — dengan kecepatan dan konsistensi yang tidak mungkin dicapai secara manual.

---

## 🎯 Masalah yang Diselesaikan

Proses screening CV manual itu **lambat, subjektif, dan tidak scalable**:

- ⏳ HR menghabiskan 6–8 jam/hari hanya untuk membaca CV
- 🎲 Penilaian berbeda-beda tergantung siapa yang review
- 📉 Kandidat bagus terlewat karena volume terlalu tinggi
- 🔁 Kandidat yang sama mendaftar berkali-kali tanpa terdeteksi

Sistem ini menyelesaikan semua itu dengan **pipeline otomatis yang berjalan 24/7**.

---

## ⚡ Kemampuan Sistem

| Kapabilitas | Detail |
|---|---|
| 📥 **Multi-source Intake** | Gmail, Google Form, Career Page Webhook, Google Drive |
| 🧠 **AI-powered Parsing** | Ekstrak 10+ field dari CV PDF/DOCX/TXT via OpenAI GPT-4o-mini |
| 🔍 **Duplicate Detection** | Deteksi kandidat duplikat via email atau kombinasi nama+telepon |
| 📊 **5-Dimension Scoring** | Skill match, pengalaman, industri, seniority, keyword overlap |
| 🏆 **Auto Shortlisting** | Shortlist otomatis berdasarkan skor + mandatory skills + pengalaman |
| 📝 **AI Summary** | Ringkasan naratif kecocokan kandidat dalam Bahasa Indonesia |
| 🔔 **Real-time Notification** | Email, Slack, Discord, Telegram — notifikasi dalam < 30 detik |
| 🔒 **Security & GDPR** | Enkripsi AES-256, audit log lengkap, GDPR right to erasure |

---

## 🏗️ Arsitektur

```
Input Sources          CV_Intake_Workflow        CV_Processing_Workflow
─────────────          ──────────────────        ──────────────────────
Gmail Attachment  ──┐                            ┌─ CV_Parser (OpenAI)
Google Form       ──┤──▶ Format Validator ──┐    ├─ Duplicate_Detector
Career Page       ──┤    Size Validator    ├──▶  ├─ JD_Matcher (OpenAI)
Google Drive      ──┘    File Encryptor   │      ├─ Scoring_Engine
                         Redis Queue  ◀──┘      ├─ Summary Generator
                                                 └─ Shortlisting_Engine
                                                          │
                                                          ▼
                                              Notification_Workflow
                                         ┌────────────────────────────┐
                                         │  Email │ Slack │ Discord   │
                                         │        │       │ Telegram  │
                                         └────────────────────────────┘
```

**Tech Stack:**

```
Workflow Engine  →  n8n (self-hosted / cloud)
AI Processor     →  OpenAI API (gpt-4o-mini)
Database         →  PostgreSQL
Cache & Queue    →  Redis
File Storage     →  S3-compatible (AES-256 encrypted)
Runtime          →  Node.js ≥ 18
```

---

## 📐 Scoring Formula

Setiap kandidat mendapat skor **0–100** berdasarkan formula berbobot:

```
Final Score = (Skill Match × 40%)
            + (Pengalaman × 30%)
            + (Pendidikan × 10%)
            + (Industry Match × 10%)
            + (Sertifikasi × 10%)
```

| Skor | Rekomendasi |
|---|---|
| ≥ 80 | ✅ **Strong Fit** → Auto Shortlisted |
| 60–79 | 🟡 **Moderate Fit** → Review manual |
| < 60 | ❌ **Weak Fit** → Not shortlisted |

Kandidat masuk shortlist **hanya jika** skor ≥ 80 **AND** semua mandatory skill terpenuhi **AND** pengalaman mencukupi.

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- PostgreSQL
- Redis
- n8n instance (self-hosted atau cloud)
- OpenAI API key

### 1. Clone & Install

```bash
git clone https://github.com/your-username/cv-screening-automation.git
cd cv-screening-automation
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit `.env` dengan kredensial kamu:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cv_screening

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# S3 Storage
S3_ENDPOINT=https://your-s3-endpoint.com
S3_BUCKET=cv-screening-files
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
FILE_ENCRYPTION_KEY=your-32-char-encryption-key

# Notifications (aktifkan sesuai kebutuhan)
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
```

### 3. Jalankan Migrasi Database

```bash
npm run migrate
```

### 4. Import n8n Workflows

Import file dari folder `n8n-workflows/` ke instance n8n kamu:
- `CV_Intake_Workflow.json`
- `CV_Processing_Workflow.json`
- `Notification_Workflow.json`

### 5. Jalankan Tests

```bash
# Unit tests
npm run test:unit

# Property-based tests
npm run test:property

# Integration tests
npm run test:integration
```

---

## 📁 Struktur Project

```
cv-screening-automation/
├── src/
│   ├── cv-intake/          # Validasi, enkripsi, audit logger
│   ├── cv-parser/          # Parsing CV dengan OpenAI
│   ├── cv-processing/      # Orchestrator pipeline
│   ├── duplicate-detector/ # Deteksi kandidat duplikat
│   ├── jd-matcher/         # Job Description matching
│   ├── scoring-engine/     # Formula scoring berbobot
│   ├── shortlisting-engine/# Logika auto-shortlist
│   ├── notification/       # Multi-channel notifications
│   ├── jd-cache/           # Redis caching untuk JD
│   ├── observability/      # Health check & monitoring
│   ├── security/           # Auth & access control
│   ├── error-handler/      # Centralized error handling
│   ├── db/                 # PostgreSQL client
│   ├── cache/              # Redis client
│   └── config.js           # Konfigurasi environment
├── migrations/             # SQL schema migrations
├── n8n-workflows/          # n8n workflow JSON files
├── tests/
│   ├── unit/               # Unit tests per komponen
│   ├── property/           # Property-based tests (fast-check)
│   └── integration/        # End-to-end integration tests
└── scripts/
    └── run-migrations.js   # Database migration runner
```

---

## 🔒 Security & Compliance

- **AES-256 encryption** untuk semua file CV di storage
- **Field-level encryption** untuk data sensitif (email, phone) di database
- **Audit log** lengkap untuk setiap operasi baca/tulis
- **Input sanitization** untuk mencegah injection attack
- **GDPR compliant** — data kandidat dapat dihapus dalam 30 hari atas permintaan
- **Role-based access** — recruiter, hiring_manager, admin

---

## 📊 Performance Targets

| Metrik | Target |
|---|---|
| Throughput | 1.000+ CV/hari |
| Concurrent processing | 50 CV bersamaan |
| Intake to queue | < 5 detik |
| End-to-end parsing | < 2 menit |
| Shortlist notification | < 30 detik |
| Duplicate check | < 2 detik |

---

## 🧪 Testing Strategy

Project ini menggunakan tiga layer testing:

**Unit Tests** — validasi logika per komponen (validator, encryptor, scoring formula)

**Property-Based Tests** — menggunakan [fast-check](https://github.com/dubzzz/fast-check) untuk memverifikasi invariant sistem:
- Skor selalu dalam range [0, 100]
- Scoring bersifat idempotent (input sama → output sama)
- Recommendation selalu konsisten dengan skor
- Duplicate detection tidak pernah lolos kandidat duplikat

**Integration Tests** — end-to-end flow dengan database dan Redis nyata

---

## 🤝 Contributing

1. Fork repository ini
2. Buat branch fitur: `git checkout -b feature/nama-fitur`
3. Commit perubahan: `git commit -m 'feat: tambah fitur X'`
4. Push ke branch: `git push origin feature/nama-fitur`
5. Buat Pull Request

---

## 📄 License

MIT License — bebas digunakan dan dimodifikasi.

---

<div align="center">

**Dibangun dengan n8n + OpenAI + PostgreSQL + Redis**

*Otomasi proses rekrutmen, fokus pada keputusan yang penting.*

</div>
