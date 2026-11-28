# CampusX 🎓🛒

> **AI-Powered University Marketplace**  
> A trusted, student-verified peer-to-peer commerce and resource exchange platform built for campus communities.

---

## 📌 Project Overview

**CampusX** solves the fragmentation, security, and trust deficits of general public marketplaces (Facebook Marketplace, Craigslist, Reddit) by restricting commerce and exchange to verified university students, faculty, and campus organizations. Students can securely buy, sell, rent, and trade textbooks, electronics, dorm essentials, lab equipment, and subleases within their verified campus network.

### Key Pillars
- **Campus Trust Boundary**: University email (.edu) authentication and student verification.
- **AI-Powered Intelligence**: Automatic item categorization, pricing recommendations based on condition, AI-driven visual similarity search, and automated fraud/content moderation.
- **Modular Monolith Backend**: Clean Node.js + Express backend modularized by domain with Prisma ORM and PostgreSQL.
- **Dedicated AI Microservice**: Fast, isolated Python FastAPI microservice handling vector embeddings, pricing intelligence, and vision tasks.
- **Production-Ready Foundation**: Containerized via Docker Compose, strict security middlewares (CORS whitelisting, Helmet, rate limiting, XSS sanitization, request validation), and continuous integration via GitHub Actions.

---

## 🗺️ 20-Day Engineering Roadmap

| Day | Focus Area | Status | Key Deliverables |
|:---:|:---|:---:|:---|
| **Day 1** | **Project Foundation & Architecture** | ✅ Done | Monorepo layout, Express modular monolith, Prisma + PostgreSQL, React + Vite + Tailwind frontend, FastAPI AI skeleton, Docker containerization, GitHub Actions CI, and `/health` endpoints. |
| **Day 2** | **Authentication & Role-Based Access Control** | ✅ Done | JWT access tokens (15m), opaque refresh tokens (SHA-256 hashed, 7d) in httpOnly cookie with rotation + reuse detection, bcrypt (12 rounds), RBAC (`STUDENT`, `MODERATOR`, `ADMIN`), admin role management, seed script, Zustand in-memory auth store & Axios refresh interceptor. |
| **Day 3** | **Student Verification & User Profiles** | ✅ Done | College email domain whitelist + 6-digit SHA-256 OTP verification (`Nodemailer` / dev console), `requireVerifiedStudent` middleware, profile CRUD with bio XSS sanitization, avatar upload (`multer` + magic-byte validation), public profile endpoint, verified badge UI. |
| **Day 4** | **Marketplace Core: Listings, Categories, Conditions & Lifecycle** | ✅ Done | `Category` & `Product` Prisma models + idempotent category seed, Draft/Publish workflow (`requireVerifiedStudent`), central lifecycle state machine (`DRAFT`, `ACTIVE`, `RESERVED`, `SOLD`, `EXPIRED`, `UNDER_REVIEW`), soft-delete, view counting, moderator review hook, hourly expiry cron (`node-cron`), and Marketplace/Sell/Detail/My Listings UI. |
| **Day 5** | **Product Images & Cloud Storage (+ Day 5B Verification Restriction)** | ✅ Done | S3-compatible storage abstraction (`MinIO` / AWS S3 / R2), `sharp` optimization pipeline (magic bytes, EXIF/GPS strip, 3 WebP variants + blur placeholder), `ProductImage` & `avatarKey` migration, presigned/CDN URLs, multi-image uploader, gallery & lightbox UI, and `@chitkara.edu.in` strict student email enforcement. |
| **Day 6** | **Search Engine, Filters, Sorting & Redis Caching** | ✅ Done | PostgreSQL `tsvector` (`A`/`B`/`C`) + `pg_trgm` GIN search & typo fallback, multi-facet filters, stable `id` tie-broken sorting, Redis (`ioredis`) fail-open cache (`SCAN`, stampede lock, versioned invalidation), Redis-backed rate limiting, 60s auth cache with immediate invalidation, autocomplete & `search:popular` tracking, responsive Client search/filter UI. |
| **Day 7B** | **Google Sign-In & UI Animation System** | ✅ Done | Google Identity Services ID-token auth, account linking security, `@chitkara.edu.in` auto-student verification, Framer Motion (`LazyMotion` + `domAnimation`), route transitions, staggered grid, card hover lift, sliding tab underline (`layoutId`), modal springs, notification bell badge pop & animated dropdown, wishlist heart pop & fill transition, first-load stagger, count-up stats, `prefers-reduced-motion`. |
| **Day 7** | **AI Service: Auto-Categorization & Tagging** | ⏳ Planned | FastAPI text processing, zero-shot/embedding-based category prediction, auto-tagging of item condition and academic course codes. |
| **Day 8** | **AI Service: Price Recommendation Engine** | ⏳ Planned | Pricing algorithms analyzing historical campus transactions, MSRP depreciation models, fair-market price badges. |
| **Day 9** | **Real-Time Buyer-Seller Messaging** | ⏳ Planned | WebSocket / Socket.io architecture, instant direct messaging, chat history persistence, unread badge counts. |
| **Day 10** | **In-App & Email Notifications** | ⏳ Planned | Event-based notifications for new messages, price drops on saved items, offer updates, and university email alerts. |
| **Day 11** | **Offer Negotiation & Escrow/Hold System** | ⏳ Planned | Formal offer workflow (Make Offer, Counter, Accept, Decline), campus meeting-point suggestions, hold timer before re-listing. |
| **Day 12** | **Trust, Reviews & Reputation Scores** | ⏳ Planned | Post-transaction review system, 5-star ratings, verified transaction badges, anti-fraud community reporting flags. |
| **Day 13** | **Redis Caching & Performance Layer** | ⏳ Planned | Redis caching for hot marketplace listings, user session storage, distributed rate limiting with Redis store. |
| **Day 14** | **Event-Driven Architecture with Kafka** | ⏳ Planned | Kafka event bus for async events: `listing.created`, `offer.accepted`, `user.registered`, audit logging, and search index updates. |
| **Day 15** | **AI Service: Visual Search & Duplicate Detection** | ⏳ Planned | Vector search using CLIP image embeddings, "find similar items" visual search, duplicate listing prevention. |
| **Day 16** | **Content Safety & Moderation Pipeline** | ⏳ Planned | Automated scanning for prohibited items (weapons, drugs, unauthorized exam materials), profanity masking, admin moderation dashboard. |
| **Day 17** | **Observability, Telemetry & Logging** | ⏳ Planned | Prometheus metrics exporter (`/metrics`), Grafana dashboard provisioning, structured Pino logging with trace IDs. |
| **Day 18** | **Testing & Performance Benchmarking** | ⏳ Planned | End-to-end integration test suites (Supertest, Jest, Playwright), k6 load testing for peak campus back-to-school traffic. |
| **Day 19** | **Hardening & Security Audits** | ⏳ Planned | OWASP Top 10 compliance audit, database connection pooling tuning, secrets rotation strategy, production Docker builds. |
| **Day 20** | **Campus Launch Readiness & Demo** | ⏳ Planned | Staging dry-run, seed data generator for university campuses, API documentation (Swagger/OpenAPI), launch checklist. |

---

## 📂 Folder Structure

The repository is organized as a clean, decoupled monorepo:

```text
campusx/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI (lint, build, test for all services)
├── ai-service/                  # Python FastAPI microservice
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # Pydantic environment configuration
│   │   └── main.py              # FastAPI app definition with /health endpoint
│   ├── .env.example             # AI Service environment sample
│   ├── .gitignore
│   └── requirements.txt         # FastAPI, Uvicorn, Pydantic dependencies
├── client/                      # React + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/          # Reusable UI (Navbar, Badges, ProtectedRoute, RoleRoute, HealthCard)
│   │   ├── hooks/               # Custom React hooks (useHealth)
│   │   ├── pages/               # Views (Landing, Login, Signup, Dashboard, Verify, Profile, PublicProfile, Marketplace, ProductDetail, Sell, MyListings)
│   │   ├── services/            # Axios client + 401 refresh interceptor + API wrappers
│   │   ├── store/               # Zustand auth store (in-memory accessToken)
│   │   ├── App.jsx              # Routes & silent refresh bootstrap
│   │   ├── index.css            # Tailwind directives and global styles
│   │   └── main.jsx             # React DOM entrypoint
│   ├── .env.example             # Client environment sample
│   ├── .gitignore
│   ├── index.html               # Vite HTML template
│   ├── package.json             # Frontend dependencies & build scripts
│   ├── postcss.config.js        # PostCSS configuration
│   ├── tailwind.config.js       # Tailwind CSS theme configuration
│   └── vite.config.js           # Vite dev server configuration
├── docker/
│   ├── Dockerfile.ai-service    # Python 3.11 slim container build
│   ├── Dockerfile.client        # Node.js build + Vite preview server
│   └── Dockerfile.server        # Node.js alpine build (runs prisma migrate deploy + seed)
├── server/                      # Node.js + Express Modular Monolith
│   ├── prisma/
│   │   ├── migrations/          # Committed PostgreSQL migrations (Days 2–4)
│   │   ├── schema.prisma        # User, RefreshToken, EmailOtp, Category, Product models
│   │   └── seed.js              # Idempotent ADMIN user & 10 marketplace categories seed
│   ├── src/
│   │   ├── config/              # Environment loader & Prisma DB client singleton
│   │   ├── jobs/                # Hourly listing expiry cron job (node-cron)
│   │   ├── middleware/          # Auth/RBAC, requireVerifiedStudent, Security (Helmet, CORS, Rate Limit, XSS), Validator, Error handler
│   │   ├── modules/             # Domain modules:
│   │   │   ├── admin/           # Admin user management & product moderation hook
│   │   │   ├── auth/            # Signup, login, refresh rotation + reuse detection, logout
│   │   │   ├── categories/      # Public categories endpoint
│   │   │   ├── health/          # Service & DB healthcheck
│   │   │   ├── products/        # Draft/Publish CRUD, lifecycle transitions, soft-delete, views
│   │   │   ├── users/           # Profiles, XSS bio sanitization, magic-byte avatar upload
│   │   │   └── verification/    # College domain check + 6-digit SHA-256 OTP flow
│   │   ├── utils/               # Logger (Pino), Mailer (Nodemailer), XSS sanitizer, AppError, responses
│   │   ├── app.js               # Express application setup (exported for tests)
│   │   └── index.js             # Server bootstrap, expiry cron & graceful shutdown
│   ├── tests/                   # Jest + Supertest suites (health, auth, verification, users, products)
│   ├── .env.example             # Server environment sample
│   ├── .gitignore
│   └── package.json             # Express dependencies, Prisma, Jest scripts
├── scripts/
│   ├── create-issues.ps1        # PowerShell script to automate Day 1 GitHub issues
│   └── create-issues.sh         # Bash script to automate Day 1 GitHub issues
├── .env.example                 # Root environment template for Docker Compose
├── .gitignore                   # Root gitignore
├── docker-compose.yml           # Multi-container orchestration (PostgreSQL, Server, Client, AI)
└── README.md                    # Project documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) (recommended)
- [Node.js](https://nodejs.org/) (v20+ or v24+) & npm (v10+)
- [Python](https://www.python.org/) (3.11+)

### Option A: Run with Docker Compose (Recommended)

1. **Clone the repository and switch to the branch:**
   ```bash
   git clone https://github.com/SARTHAK-KAPOOR17/CampusX.git
   cd CampusX
   git checkout feature/day-1-foundation
   ```

2. **Copy the root environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Start all services in Docker:**
   ```bash
   docker compose up --build
   ```

4. **Verify running containers:**
   | Service | URL | Health Check Endpoint |
   |:---|:---|:---|
   | **Client** | `http://localhost:5173` | UI loads and queries Server Health |
   | **Server API** | `http://localhost:5000` | `http://localhost:5000/api/health` |
   | **AI Microservice** | `http://localhost:8000` | `http://localhost:8000/health` |
   | **PostgreSQL DB** | `localhost:5432` | `pg_isready -U campusx_user -d campusx_db` |

---

### Option B: Run Locally for Development

#### 1. Database (PostgreSQL)
Start PostgreSQL locally on port 5432, or launch just the DB via docker:
```bash
docker compose up -d postgres
```

#### 2. Backend Server
```bash
cd server
cp .env.example .env
npm install
npx prisma generate
npm run dev
```
Runs on `http://localhost:5000`. Test health: `curl http://localhost:5000/api/health`.

#### 3. Frontend Client
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Runs on `http://localhost:5173`. Open in your browser.

#### 4. AI Microservice
```bash
cd ai-service
cp .env.example .env
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Runs on `http://localhost:8000`. Test health: `curl http://localhost:8000/health`.

---

## 🧪 Testing

Run backend tests using Jest & Supertest:
```bash
cd server
npm test
```

---

## 🔐 Auth API

All authentication endpoints are mounted under `/api/auth` (and RBAC admin endpoints under `/api/admin`). Refresh tokens are issued as `httpOnly`, `SameSite=Strict` (`Secure` in production) cookies, while short-lived JWT access tokens (15m) are returned in JSON and held in memory only on the client.

| Method | Endpoint | Access | Rate Limit | Description |
|:---:|:---|:---|:---:|:---|
| `POST` | `/api/auth/signup` | Public | Strict | Register a new `STUDENT` user (validates name, email, password strength; bcrypt 12 rounds). |
| `POST` | `/api/auth/login` | Public | Strict | Authenticate user; returns `accessToken` + user profile and sets refresh token cookie. |
| `POST` | `/api/auth/refresh` | Cookie (`refreshToken`) | Strict | Rotate refresh token and issue new token pair. Revokes all user tokens on reuse detection. |
| `POST` | `/api/auth/logout` | Cookie (`refreshToken`) | Standard | Revoke the active refresh token and clear the cookie. |
| `POST` | `/api/auth/logout-all` | Bearer JWT | Standard | Revoke all active refresh tokens for the authenticated user and clear cookie. |
| `GET` | `/api/auth/me` | Bearer JWT | Standard | Return the authenticated user's profile (excludes `passwordHash`). |
| `GET` | `/api/admin/users` | `ADMIN`, `MODERATOR` | Standard | List users with pagination (`?page=1&limit=10`), excluding `passwordHash`. |
| `PATCH` | `/api/admin/users/:id/role` | `ADMIN` only | Standard | Update a user's role (`STUDENT`, `MODERATOR`, `ADMIN`). Blocks self-demotion. |

---

## 🎓 Verification API

Student verification endpoints are mounted under `/api/verification` (authenticated users only). Verification is **strictly restricted to `@chitkara.edu.in`** (`ALLOWED_COLLEGE_DOMAINS=chitkara.edu.in`, exact domain equality check — subdomains, prefix/suffix lookalikes such as `mail.chitkara.edu.in`, `chitkara.edu.in.evil.com`, or `chitkara.edu` are rejected; stored lowercase with case-insensitive duplicate checks). Normal login/signup emails remain unrestricted (so admin and external signups keep working).

| Method | Endpoint | Access | Rate / Abuse Controls | Description |
|:---:|:---|:---|:---|:---|
| `POST` | `/api/verification/request` | Bearer JWT | 60s resend cooldown; max 5 requests/hour/user | Validates `collegeEmail` (exact domain `@chitkara.edu.in` + format), checks case-insensitive uniqueness, generates 6-digit `crypto.randomInt` OTP (SHA-256 hashed, 10m expiry), invalidates older OTPs, sends via Nodemailer (or logs to console in dev if SMTP unconfigured). |
| `POST` | `/api/verification/confirm` | Bearer JWT | Max 5 wrong attempts/OTP; constant-time check | Verifies OTP, marks `isVerifiedStudent = true`, sets `verifiedAt` & lowercase `collegeEmail` on `User`, and marks OTP consumed. |
| `GET` | `/api/verification/status` | Bearer JWT | Standard | Returns `{ isVerifiedStudent, collegeEmail, verifiedAt }`. |

---

## 👤 Profile API

Profile endpoints are mounted under `/api/users`. Avatars are stored locally in `server/uploads/avatars` (to be migrated to cloud storage on Day 5).

| Method | Endpoint | Access | Description |
|:---:|:---|:---|:---|
| `GET` | `/api/users/me/profile` | Bearer JWT | Fetch the authenticated user's full profile (excluding `passwordHash`). |
| `PATCH` | `/api/users/me/profile` | Bearer JWT | Update `name`, `course`, `branch`, `year` (1–6), and `bio` (max 300 chars, XSS-sanitized). |
| `POST` | `/api/users/me/avatar` | Bearer JWT | Upload avatar (`multipart/form-data`, field `avatar`, max 2MB, JPEG/PNG/WebP verified by magic bytes); replaces & deletes previous avatar. |
| `GET` | `/api/users/:id` | Public | Fetch sanitized public profile (`id`, `name`, `profilePictureUrl`, `course`, `branch`, `year`, `bio`, `ratingAverage`, `ratingCount`, `isVerifiedStudent`). Never exposes `email`, `collegeEmail`, `role`, or `passwordHash`. |

---

## 🛒 Marketplace API

Categories and product listings are mounted under `/api/categories`, `/api/products`, and `/api/admin/products`. Soft-deleted listings (`deletedAt != null`) are excluded from all queries.

| Method | Endpoint | Access | Description |
|:---:|:---|:---|:---|
| `GET` | `/api/categories` | Public | List all seeded marketplace categories sorted alphabetically by `name`. |
| `GET` | `/api/products` | Public | Paginated feed (`?page=1&limit=12&categoryId=`) of `ACTIVE` and `RESERVED` listings sorted newest first, including seller public info. |
| `GET` | `/api/products/mine` | Bearer JWT | List the authenticated seller's own listings with optional `?status=` filter. |
| `GET` | `/api/products/:id` | Public / Optional Auth | View listing details (`DRAFT`, `UNDER_REVIEW`, `EXPIRED` visible only to owner, `ADMIN`, `MODERATOR`). Increments `viewCount` for non-owners. |
| `POST` | `/api/products` | Bearer JWT + Verified Student | Create a listing (`saveAsDraft: true` requires only `title`; publishing requires `title`, `description`, `price`, `categoryId`, `condition` and sets `expiresAt = now + LISTING_EXPIRY_DAYS`). |
| `PATCH` | `/api/products/:id` | Owner only | Edit listing fields (allowed only in `DRAFT`, `ACTIVE`, or `RESERVED`). |
| `POST` | `/api/products/:id/publish` | Owner only | Publish a `DRAFT` listing (`DRAFT -> ACTIVE`), setting `publishedAt` and `expiresAt`. |
| `POST` | `/api/products/:id/status` | Owner only | Transition seller listing status (`ACTIVE <-> RESERVED`, `ACTIVE/RESERVED -> SOLD`, `EXPIRED -> ACTIVE` relist). |
| `DELETE` | `/api/products/:id` | Owner or `ADMIN` | Hard delete for `DRAFT` listings; soft delete (`deletedAt`) for all other statuses. |
| `PATCH` | `/api/admin/products/:id/status` | `ADMIN`, `MODERATOR` | Moderation transition (`ACTIVE/RESERVED -> UNDER_REVIEW` or `UNDER_REVIEW -> ACTIVE`). |

---

## 🔄 Listing Lifecycle

Allowed listing status transitions enforced centrally in the product service (plus automated hourly expiry via `node-cron`):

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Create (saveAsDraft = true)
    [*] --> ACTIVE: Create (saveAsDraft = false)
    DRAFT --> ACTIVE: POST /publish (Seller)
    ACTIVE --> RESERVED: Seller marks reserved
    RESERVED --> ACTIVE: Seller unreserves
    ACTIVE --> SOLD: Seller marks sold
    RESERVED --> SOLD: Seller marks sold
    ACTIVE --> EXPIRED: Expiry cron job (past expiresAt)
    EXPIRED --> ACTIVE: Seller relists (resets expiresAt)
    ACTIVE --> UNDER_REVIEW: Admin / Moderator flags
    RESERVED --> UNDER_REVIEW: Admin / Moderator flags
    UNDER_REVIEW --> ACTIVE: Admin / Moderator approves
    SOLD --> [*]
```

---

## 🖼️ Storage & Images

### Architecture
CampusX decouples image processing from object storage using a provider-agnostic S3 interface (`server/src/services/storage/`) backed by `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Locally, Docker Compose runs **MinIO** on `:9000` (API) and `:9001` (Web Console) with a **private** bucket (`campusx-media`). On startup in development, the server ensures the bucket exists; in production, it fails fast if storage is unreachable.

### Upload & Optimization Flow
1. **Multipart Ingestion**: `multer` (memory storage, 5MB limit) + strict upload rate limiting (`uploadLimiter`).
2. **Magic-Byte & Decompression-Bomb Guard**: `sharp` + binary signature checks accept only genuine `JPEG`, `PNG`, and `WebP` files (`limitInputPixels` enforced).
3. **Privacy & Optimization**: Strips all EXIF/GPS metadata, auto-rotates via orientation, and generates 3 WebP variants (`thumb`: 320px, `medium`: 800px, `large`: 1600px, never upscaling) plus a ~20px base64 `blurDataUrl`.
4. **Private Bucket Storage**: Objects are uploaded concurrently under random UUID keys — never user-supplied filenames.
5. **URL Signing**: API responses return short-lived presigned `GET` URLs (`SIGNED_URL_EXPIRY_SECONDS`, default `900`s) computed locally in CPU (no per-image network calls), or `CDN_BASE_URL` URLs when a CDN is configured.

### Bucket Key Layout
```text
campusx-media/
├── products/
│   └── {productId}/
│       └── {imageId}/
│           ├── thumb.webp      (320px wide)
│           ├── medium.webp     (800px wide)
│           └── large.webp      (1600px wide)
└── avatars/
    └── {userId}/
        └── {imageId}/
            ├── thumb.webp      (320px wide)
            ├── medium.webp     (800px wide)
            └── large.webp      (1600px wide)
```

### Switching from MinIO to AWS S3 or Cloudflare R2
No application code changes are required — only environment variables:

```env
# AWS S3 Example
STORAGE_ENDPOINT=https://s3.ap-south-1.amazonaws.com
STORAGE_REGION=ap-south-1
STORAGE_BUCKET=campusx-prod-media
STORAGE_ACCESS_KEY=<IAM_ACCESS_KEY>
STORAGE_SECRET_KEY=<IAM_SECRET_KEY>
STORAGE_FORCE_PATH_STYLE=false
CDN_BASE_URL=https://cdn.campusx.edu   # Optional CloudFront/Cloudflare CDN

# Cloudflare R2 Example
STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BUCKET=campusx-prod-media
STORAGE_ACCESS_KEY=<R2_ACCESS_KEY>
STORAGE_SECRET_KEY=<R2_SECRET_KEY>
STORAGE_FORCE_PATH_STYLE=true
```

---

## 🔍 Search & Caching

### Search Architecture
- **Weighted Full-Text Search**: PostgreSQL `products."searchVector"` generated `tsvector` column (`title` weight **A**, `tags` weight **B**, `description` weight **C**) indexed with `GIN` (`products_searchVector_gin_idx`). Queries use parameterized `websearch_to_tsquery('english', q)` ranked via `ts_rank(...)` with title prefix boost so title matches naturally outrank description matches.
- **Typo-Tolerant Fallback**: PostgreSQL `pg_trgm` extension + `GIN` trigram index (`products_title_trgm_gin_idx` with `gin_trgm_ops`). When full-text matching returns fewer than 3 results, the engine runs a hybrid trigram similarity fallback (`q <% title` / `word_similarity`), allowing queries like `"bycycle"` to find `"Campus Bicycle"`.
- **Composite Filter Indexes**: `("status", "categoryId", "price")` and `("status", "publishedAt")` optimize public feed filtering (`ACTIVE` / `RESERVED` only, `deletedAt IS NULL`) with deterministic UUID `id` tie-breakers across paginated pages.
- **Autocomplete & Popular Terms**: `GET /api/search/suggest?q=` merges category matches, Redis `search:popular` sorted-set matches, and listing title prefix/trigram matches (max 8, min 2 chars). Valid executed searches (> 0 results, non-PII, per-IP 60s anti-spam guard) increment `search:popular` (`ZINCRBY`).

### Cache Keys, TTLs & Invalidation Rules
All keys are namespaced under `campusx:<NODE_ENV>:`. Redis calls **fail open** to PostgreSQL on outage (`enableOfflineQueue: false`, warning logged, zero request failures).

| Logical Key Pattern | TTL | Stampede / Protection | Invalidation Trigger |
|:---|---:|:---|:---|
| `categories:all` | `3600s` (1h) | `getOrSet` + `NX` lock + singleflight | Category seed/change |
| `products:version` | Persistent | Atomic `INCR` counter | Create, update, publish, status/moderation change, delete, image add/reorder/delete, expiry cron, seller profile/status change |
| `products:list:v{ver}:{sha256(params)}` | `60s` | Version-bumped + `NX` lock | Instant logical invalidation via `products:version` bump (no `KEYS`/mass deletes) |
| `products:detail:{productId}` | `30s` | Public `ACTIVE`/`RESERVED` non-owner views only (`viewCount` increments directly in Postgres, never cached; private statuses & owner/mod views bypass cache) | `DEL products:detail:{productId}` on product/image edit, status/moderation change, or delete |
| `search:suggest:{sha256(q)}` | `60s` | `getOrSet` + `NX` lock | `delByPrefix('search:suggest:')` via cursor `SCAN` on listing/image mutations |
| `search:popular` | Bounded sorted set (top 200) | Per-IP + term `60s` `SET NX` anti-spam & `total > 0` check | Auto-trimmed via `ZREMRANGEBYRANK` |
| `search:popular:top10` | `300s` (5m) | `getOrSet` | Natural TTL expiry |
| `auth:user:{userId}` | `60s` | Caches only `{ id, role, isActive, isVerifiedStudent }` (never `passwordHash`) | Immediate `DEL` on admin role update, user deactivation (`PATCH /api/admin/users/:id/status`), verification confirmation, `fix:college-emails`, and profile/avatar updates |
| `rl:{prefix}:{ip}` | Window (`60s`–`900s`) | `rate-limit-redis` shared across app instances; `MemoryStore` fallback | Sliding window expiration |

> **URL Lifetime Safety Check**: `SIGNED_URL_EXPIRY_SECONDS` (`900s` default) always exceeds max product cache TTL (`60s`) by a wide margin; server boot logs a warning if `SIGNED_URL_EXPIRY_SECONDS <= maxProductCacheTtl + 60`.

### Search, Filter & Sort Query Parameters (`GET /api/products`)

| Parameter | Type / Allowed Values | Default | Description |
|:---|:---|:---|:---|
| `q` | string (1–100 chars) | `""` | Keyword search (weighted FT + `pg_trgm` typo fallback) |
| `categoryId` / `category` | UUID / slug | — | Filter by category UUID or slug (e.g. `books`, `electronics`) |
| `minPrice`, `maxPrice` | number `>= 0` | — | Inclusive price bounds (validated `minPrice <= maxPrice`) |
| `condition` | `NEW,LIKE_NEW,GOOD,FAIR,USED` | — | Single condition or comma-separated list |
| `availability` | `available \| reserved \| all` | `all` | `available` (`ACTIVE` only), `reserved` (`RESERVED` only), `all` (`ACTIVE`+`RESERVED`) |
| `isNegotiable` | `true \| false` | — | Filter negotiable vs fixed-price listings |
| `verifiedSeller` | `true \| false` | `false` | Restrict results to verified (`@chitkara.edu.in`) student sellers |
| `sort` | `newest \| price_asc \| price_desc \| popularity \| relevance` | `newest` (`relevance` when `q` present) | Deterministic ordering with UUID `id` tie-breaker (`relevance` requires `q`) |
| `page`, `limit` | int (`limit` max `50`) | `1`, `12` | Returns `{ products, pagination: { page, limit, total, totalPages, hasNext } }` |

Additional search endpoints:
- `GET /api/search/suggest?q=<2-50 chars>` — Returns up to 8 autocomplete suggestions (`category`, `popular`, `listing`), cached `60s`, rate-limited.
- `GET /api/search/popular` (alias `/api/search/suggest/popular`) — Returns top 10 popular search terms from Redis sorted set `search:popular`, cached `300s`.

### 5,000-Product Search Benchmark (`npm run seed:bench`, Dev Only)
- **Dataset**: 5,000 idempotent listings seeded via `cd server && npm run seed:bench` (clean up with `npm run seed:bench -- --clean`).
- **Median HTTP Search Latency (15 queries across 5,000 rows)**:
  - **Cache MISS (PostgreSQL)**: `35.78 ms`
  - **Cache HIT (Redis)**: `10.66 ms` (~3.4x faster)
- **PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` Plan Confirmation**:
  - `Bitmap Index Scan on "products_searchVector_gin_idx"` (`shared hit=5`, **Execution Time: `0.405 ms`** after `VACUUM ANALYZE`)
  - Trigram typo index `"products_title_trgm_gin_idx"` (`gin_trgm_ops`) confirmed via `Bitmap Index Scan` on `<%` operator.

---

## 🔑 Google Sign-In Architecture

CampusX integrates Google Identity Services (GIS) using the ID-token authentication flow. The client renders Google's official sign-in button, obtains a cryptographically signed ID token JWT directly from Google, and submits it to `/api/auth/google`. The server validates the token using Google's public keys via `google-auth-library`.

### Google Authentication Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client as React Client (GIS)
    participant Google as Google Identity Services
    participant Server as Express Server
    participant DB as PostgreSQL (Prisma)
    participant Redis as Redis Cache

    User->>Client: Clicks "Continue with Google"
    Client->>Google: Authenticates via GIS popup/One-Tap
    Google-->>Client: Returns ID Token (JWT Credential)
    Client->>Server: POST /api/auth/google { credential }
    Server->>Google: Verifies token signature & audience (OAuth2Client)
    Google-->>Server: Token payload (sub, email, email_verified, hd, name, picture)
    alt email_verified == false
        Server-->>Client: 401 Unauthorized ("Google email is not verified")
    else User exists with googleId
        Server->>DB: Fetch user & update last login
    else User exists with email (Account Linking)
        alt existing user emailVerified == false
            Server->>DB: Set googleId, emailVerified=true, passwordHash=null, revoke all refresh tokens
            Note over Server,DB: Mitigates pre-registration takeover: nulls password & revokes tokens
        else existing user emailVerified == true
            Server->>DB: Link googleId
        end
    else New User
        Server->>DB: Create user (role=STUDENT, authProvider=GOOGLE, passwordHash=null)
    end
    opt GOOGLE_AUTO_VERIFY_COLLEGE == true && hd == "chitkara.edu.in"
        Server->>DB: Mark isVerifiedStudent=true, collegeEmail=email, verifiedAt=now
        Server->>Redis: Invalidate auth:user:{userId}
    end
    Server->>DB: Store rotated RefreshToken
    Server-->>Client: 200 OK + JWT Access Token & Set-Cookie (refreshToken httpOnly)
    Client->>Client: Store accessToken in memory & update state
```

### Environment Variables for Google OAuth
| Variable | Service | Default | Description |
|:---|:---|:---|:---|
| `GOOGLE_CLIENT_ID` | Server | `""` | Google Cloud Console OAuth 2.0 Client ID |
| `GOOGLE_AUTO_VERIFY_COLLEGE` | Server | `true` | When true, matches `@chitkara.edu.in` via token `hd` claim to auto-verify student |
| `VITE_GOOGLE_CLIENT_ID` | Client | `""` | Passed to Vite client (via Docker build arg or `.env`) to initialize GIS button |

### Creating Google OAuth Client ID in Google Cloud Console
1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or select your project (e.g. `CampusX`).
3. Configure the **OAuth Consent Screen**:
   - User Type: **External**.
   - App Name: `CampusX`.
   - User Support Email: your developer email.
   - Authorized Domains: add `chitkara.edu.in` (and your production domain if deploying).
4. Go to **Credentials** -> **Create Credentials** -> **OAuth Client ID**:
   - Application Type: **Web Application**.
   - Name: `CampusX Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (Vite dev server)
     - `http://localhost:4173` (Vite preview server)
     - `http://localhost` (Docker / Production port 80)
   - **Authorized redirect URIs**: (None required for Google Identity Services ID-token button flow).
5. Copy the generated **Client ID** (ending in `.apps.googleusercontent.com`).
6. Paste into your `.env` and `server/.env` files under `GOOGLE_CLIENT_ID`, and in `client/.env` under `VITE_GOOGLE_CLIENT_ID`.

### Google Auth Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|:---|:---|:---:|:---:|:---|
| `GET` | `/api/auth/config` | Public | None | Returns `{ googleEnabled: boolean }` so client conditionally renders GIS |
| `POST` | `/api/auth/google` | Public | `authLimiter` (10/15m) | Verifies ID token credential, links or creates user, issues JWT + cookie |
| `POST` | `/api/auth/set-password` | Bearer Token | Standard | Allows Google-authenticated users without password to create an email password |
| `GET` | `/api/auth/me` | Bearer Token | Standard | Current user profile, includes `authProvider` and `hasPassword` boolean |

---

## 🎨 UI Animation Guidelines

CampusX utilizes `framer-motion` for fluid, professional micro-interactions while maintaining strict performance budgets.

### Performance & Accessibility Rules
- **Bundle Optimization**: Imported via `LazyMotion` with `domAnimation` features, adding `< 25KB` gzipped to production bundles.
- **Accessibility**: Application is wrapped in `<MotionConfig reducedMotion="user">`, automatically disabling motion transitions when `prefers-reduced-motion: reduce` is enabled in OS settings.
- **Hardware Acceleration**: Only `transform` (`x`, `y`, `scale`) and `opacity` are animated to ensure 60fps execution on mobile/low-power devices. Layout properties (`width`, `height`, `margin`, `padding`) are strictly forbidden.
- **Duration Limits**:
  - Micro-interactions (hover, tap): `150ms`
  - Standard transitions (drawers, reveals): `200ms`
  - Complex transitions (page, modals): `250ms–300ms` (never exceeds `300ms`).
- **Spring Parameters**: Standardized spring configuration for overlays/drawers: `{ type: 'spring', damping: 25, stiffness: 300 }`.
- **Easing Curve**: Standard cubic-bezier ease for transitions: `[0.25, 0.1, 0.25, 1]`.
- **Battery Preservation**: No infinite decorative loop animations. Skeletons utilize CSS keyframe shimmers rather than JS animation loops.

### Animated Interactions
1. **Route Transitions**: Page changes feature smooth fade + `8px` vertical translation wrapped in `AnimatePresence mode="wait"`.
2. **Marketplace Grid**: Product listings enter with a clean `40ms` stagger (capped at top 12 items to prevent frame drops).
3. **Product Card Hover**: Subtle `-4px` vertical elevation lift, soft shadow deepening, and `1.03` image zoom scale.
4. **Interactive Tap**: Button click feedback with `whileTap={{ scale: 0.98 }}`.
5. **Wishlist Heart Pop & Fill Transition**: Heart button toggle triggers elastic keyframe bounce (`scale: [0.8, 1.25, 1]`) and smooth color fill transition (`transition-colors duration-200 fill-rose-500 text-rose-500`).
6. **Notification Bell & Badge Pop**: Notification bell unread count badge pops (`scale: [0.8, 1.35, 1]`) on count changes; dropdown fades and slides in/out with `<AnimatePresence>` (`slideDown`).
7. **Wishlist & Notification Lists**: Staggered fade-in on first load only (`staggerContainer` + `staggerItem`).
8. **Dashboard Counters**: Numerical metrics count up smoothly on viewport entry over `600ms` using `AnimatedCounter.jsx`.
9. **Sliding Tab Underline**: Active tab indicator smoothly slides between tabs using Framer Motion `layoutId="activeTabUnderline"`.
10. **Modals & Drawers**: Backdrop fade with spring-driven scale/slide-in entrance.
11. **Form Feedback**: Validation error messages slide down and fade in with zero layout jank.

---

## 📸 Feature Screenshots

Full high-resolution screenshots of all major frontend features are documented in [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md):

- **Campus Marketplace**: [`docs/screenshots/01-marketplace-grid.png`](docs/screenshots/01-marketplace-grid.png)
- **Wishlist Heart Pop**: [`docs/screenshots/02-wishlist-heart-pop.png`](docs/screenshots/02-wishlist-heart-pop.png)
- **Notification Bell Dropdown**: [`docs/screenshots/03-notification-bell-dropdown.png`](docs/screenshots/03-notification-bell-dropdown.png)
- **Product Detail & Gallery**: [`docs/screenshots/04-product-detail.png`](docs/screenshots/04-product-detail.png)
- **Google Sign-In & Login**: [`docs/screenshots/05-login-google-signin.png`](docs/screenshots/05-login-google-signin.png)
- **Dashboard Stats & Underline**: [`docs/screenshots/06-dashboard-animated-stats.png`](docs/screenshots/06-dashboard-animated-stats.png)
- **Dashboard Saved Wishlist**: [`docs/screenshots/07-dashboard-saved-wishlist.png`](docs/screenshots/07-dashboard-saved-wishlist.png)
- **User Profile & Verification**: [`docs/screenshots/08-user-profile.png`](docs/screenshots/08-user-profile.png)

---

## 🔒 Security Architecture
- **Helmet**: Secures HTTP response headers against clickjacking, sniffing, and XSS.
- **CORS Whitelist**: Whitelists only trusted origins defined in `CORS_ORIGIN`.
- **Express Rate Limit**: Prevents brute-force and DoS attacks (default 100 requests per 15 minutes per IP).
- **XSS Sanitization**: Strips dangerous script injections from request body, query, and params.
- **Request Body Limits**: Enforces strict payload limits (default 10MB) to mitigate memory exhaustion.
- **Standardized JSON Envelope**: Uniform API responses with `success`, `statusCode`, `message`, `data`, and `timestamp`.

---

## 📄 License
ISC © 2026 CampusX Engineering Team
