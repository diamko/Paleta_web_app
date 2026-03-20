# Paleta

<p align="right">
  🌍 <strong>Language:</strong>
  🇬🇧 English |
  🇷🇺 <a href="README.ru.md">Русский</a>
</p>

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3-black.svg)](https://flask.palletsprojects.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/status-active-success.svg)](#)

<p align="center">
  <a href="https://diamko.ru">
    <img src="https://img.shields.io/badge/Website-diamko.ru-ff6a00?style=for-the-badge&logo=googlechrome&logoColor=white" alt="diamko.ru website">
  </a>
</p>

Paleta is a web application for generating, editing, saving, and exporting color palettes. Build palettes from uploaded images (dominant color extraction via KMeans) or generate random ones, then manage them in your personal account.

The project is aimed at designers, frontend developers, and anyone who works with color and needs a fast workflow from image to ready-to-use HEX codes.

## Table of Contents

1. [Why Paleta](#why-paleta)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [How It Works](#how-it-works)
5. [Installation and Setup](#installation-and-setup)
6. [Run the Project](#run-the-project)
7. [Configuration](#configuration)
8. [Usage Guide](#usage-guide)
9. [Web API Endpoints](#web-api-endpoints)
10. [Mobile API Endpoints](#mobile-api-endpoints)
11. [Project Structure](#project-structure)
12. [Testing](#testing)
13. [Related Projects](#related-projects)
14. [Contributing](#contributing)
15. [Authors](#authors)
16. [License](#license)

## Why Paleta

### Goal

Provide a practical, browser-based tool for turning visual references into reusable color palettes — with a companion Android app for on-the-go use.

### Problem It Solves

- Manual color picking from images is slow and inconsistent.
- Exporting palettes to design-tool formats often requires extra tools.
- Managing multiple palettes in one place is inconvenient without authentication and storage.

### What Makes It Different

- **Three generation modes**: from image (KMeans clustering), random, and color harmonies (sequential, tetradic/square).
- **Inline palette editing**: color picker + HEX field + copy to clipboard + gradient fill between colors.
- **Palette management**: save, edit name and colors together, delete, filter, sort — all within your account.
- **6 export formats**: JSON, GPL, ASE, CSV, PNG, ACO — ready for both development and design tools.
- **Dark / light theme**: toggle between themes, with system preference detection.
- **Mobile app**: Android client available for download directly from the site, with a full REST API backend.
- **Password recovery**: email-based code verification with rate limiting.

## Key Features

| Category | Features |
| --- | --- |
| **Generation** | Dominant color extraction from image (KMeans), random palette, sequential and tetradic color harmonies |
| **Editing** | Color picker, HEX input, gradient fill between colors, re-analysis with custom color count |
| **Export** | JSON, GPL, ASE, CSV, PNG, ACO |
| **Library** | Personal palette library with search, filter by color count, sorting, inline name + color editing |
| **Auth** | Register, login, logout, password reset via email |
| **Uploads** | Drag-and-drop image upload, recent uploads (last 7 days) |
| **UI** | Dark / light theme toggle, responsive layout for mobile and desktop |
| **Mobile** | Full REST API for Android client (auth, palettes, generation, export); APK available on the download page |
| **i18n** | Russian and English interface |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Python 3.12, Flask 2.3.3 |
| ORM | Flask-SQLAlchemy |
| Auth | Flask-Login (web), JWT-like tokens (mobile API) |
| Database | PostgreSQL (psycopg) |
| Image processing | Pillow, NumPy, scikit-learn (KMeans) |
| Frontend | Bootstrap 5 + Vanilla JavaScript |
| Email | smtplib (password reset codes) |
| Deployment | Docker + Nginx + HTTPS (see `DEPLOYMENT.ru.md`) |

## How It Works

1. User uploads an image (or generates a random/harmony palette).
2. Backend resizes the image and runs KMeans clustering.
3. Dominant RGB colors are converted to HEX.
4. User edits (including gradient fill between colors), copies, exports, or saves the palette.
5. Saved palettes are linked to the authenticated account and managed in "My Palettes".

## Installation and Setup

### Prerequisites

- `git`
- `Python 3.10+` (recommended `3.12`)
- `pip`
- `PostgreSQL` (or Docker)

### 1) Clone the repository

```bash
git clone https://github.com/diamko/Paleta_web_app.git
cd Paleta_web_app
```

### 2) Create and activate virtual environment

> Use `.venv` (with a leading dot), not `venv`. On Windows use `python` instead of `python3`.

Linux / macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3) Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4) Initialize database (first run)

Quick local PostgreSQL via Docker:

```bash
docker run --name paleta-postgres \
  -e POSTGRES_DB=paleta \
  -e POSTGRES_USER=paleta \
  -e POSTGRES_PASSWORD=paleta \
  -p 5432:5432 \
  -d postgres:latest
```

Create tables:

```bash
python3 -c "from app import app; from extensions import db; import models; app.app_context().push(); db.create_all()"
```

Default database URLs:

| Environment | URL |
| --- | --- |
| Development | `postgresql+psycopg://paleta:paleta@localhost:5432/paleta` |
| Production | `postgresql+psycopg://paleta:paleta@db:5432/paleta` |

## Run the Project

### Option A: Direct run

```bash
python3 app.py
```

### Option B: Flask CLI

```bash
flask --app app run
```

Open in browser: `http://127.0.0.1:5000`

## Configuration

Main config is in `config.py`. Override via environment variables:

### Core settings

| Variable | Description | Default |
| --- | --- | --- |
| `SECRET_KEY` | Session secret (required in production) | Auto-generated in dev |
| `DATABASE_URL` | PostgreSQL connection string | Local PostgreSQL |
| `FLASK_ENV` | `development` or `production` | `development` |

### Security

| Variable | Description | Default |
| --- | --- | --- |
| `SESSION_COOKIE_SECURE` | HTTPS-only cookies | `true` in prod |
| `CORS_ENABLED` | Enable CORS | `false` |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | — |

### Image processing

| Variable | Description | Default |
| --- | --- | --- |
| `MAX_IMAGE_PIXELS` | Max image resolution (pixels) | `20000000` |
| `MIN_COLOR_COUNT` | Min colors in palette | `3` |
| `MAX_COLOR_COUNT` | Max colors in palette | `15` |

### Password reset (email)

| Variable | Description | Default |
| --- | --- | --- |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASSWORD` | SMTP password | — |
| `SMTP_FROM` | Sender email address | — |
| `SMTP_USE_TLS` | Use STARTTLS | `true` |
| `SMTP_USE_SSL` | Use SSL (mutually exclusive with TLS) | `false` |
| `PASSWORD_RESET_CODE_TTL_MINUTES` | Code lifetime | `15` |
| `PASSWORD_RESET_MAX_ATTEMPTS` | Max code entry attempts | `5` |

### Other defaults

- `UPLOAD_FOLDER = static/uploads`
- `MAX_CONTENT_LENGTH = 16 MB`
- Allowed image extensions: `png`, `jpg`, `jpeg`, `webp`

## Usage Guide

### Guest mode (without account)

- Extract palette from an uploaded image
- Generate random palettes or build harmonies
- Edit colors (picker, HEX, gradient fill)
- Export palettes to any format

### Authenticated mode

Additionally:

- Save palettes to your personal library
- Edit palette name and colors in one step
- Delete palettes
- Search, filter, and sort in "My Palettes"
- Reuse recent image uploads (last 7 days)
- Recover password via email

### Basic flow

1. Open home page → upload image or go to the palette generator.
2. Select generation mode (from image / random / harmony) and number of colors.
3. Edit colors if needed (picker, HEX input, or gradient fill).
4. Export or save the palette.
5. Manage saved palettes in "My Palettes".

## Web API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/upload` | Upload image and extract palette |
| `POST` | `/api/palettes/save` | Save palette (auth required) |
| `POST` | `/api/palettes/update/<id>` | Update palette colors and/or name (auth required) |
| `POST` | `/api/palettes/rename/<id>` | Rename palette (auth required) |
| `DELETE` | `/api/palettes/delete/<id>` | Delete palette (auth required) |
| `POST` | `/api/export` | Export palette (json, gpl, ase, csv, png, aco) |

## Mobile API Endpoints

REST API for the [Paleta Mobile](https://github.com/diamko/Paleta_mobile_app) Android client. All endpoints are prefixed with `/api/mobile/v1`.

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/login` | Login, returns access + refresh tokens |
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Revoke tokens |
| `GET` | `/auth/me` | Get current user profile |
| `POST` | `/auth/password/forgot` | Request password reset code (email) |
| `POST` | `/auth/password/reset` | Reset password with code |

### Profile

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/profile` | Get user profile |
| `PATCH` | `/profile` | Update username / email |
| `POST` | `/profile/password/send-code` | Send password change code |
| `POST` | `/profile/password/change` | Change password with code |

### Palettes

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/palettes` | List user palettes (search, sort, filter) |
| `POST` | `/palettes` | Create palette |
| `PATCH` | `/palettes/<id>` | Rename palette |
| `DELETE` | `/palettes/<id>` | Delete palette |
| `POST` | `/palettes/<id>/save` | Update palette colors |

### Generation & Export

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/generate/image` | Extract colors from uploaded image |
| `POST` | `/generate/random` | Generate random palette |
| `GET` | `/uploads/recent` | Recent image uploads (last 7 days) |
| `GET` | `/uploads/<filename>` | Serve uploaded image |
| `POST` | `/export` | Export palette to file |

## Project Structure

```text
Paleta/
├── app.py                  # Flask app factory and startup
├── config.py               # Configuration (env vars, defaults)
├── extensions.py           # SQLAlchemy, login manager init
├── models/
│   ├── user.py             # User model
│   ├── user_contact.py     # User email contacts
│   ├── palette.py          # Palette model
│   ├── upload.py           # Upload tracking
│   └── password_reset_token.py  # Password reset codes
├── routes/
│   ├── pages.py            # Main web routes (pages)
│   ├── auth.py             # Web auth routes (login, register, etc.)
│   ├── api.py              # Web palette API (upload, save, update, export)
│   └── mobile_api.py       # Mobile REST API (all mobile endpoints)
├── utils/
│   ├── image_processor.py  # KMeans color extraction
│   ├── export_handler.py   # Multi-format palette export
│   ├── reset_delivery.py   # Email code sending (SMTP)
│   ├── contact_normalizer.py  # Email normalization
│   └── rate_limit.py       # Request rate limiting
├── templates/              # Jinja2 HTML templates
├── translations/           # i18n message catalogs (ru, en)
├── static/
│   ├── apk/                # Android APK (paleta.apk)
│   ├── css/                # Stylesheets
│   ├── js/                 # Frontend JavaScript
│   └── uploads/            # User-uploaded images
├── requirements.txt
├── LICENCE
├── README.md
├── README.ru.md
├── CONTRIBUTING.md
└── CONTRIBUTING.ru.md
```

## Testing

Manual smoke test checklist:

1. Register and login.
2. Upload image and generate palette.
3. Generate a random palette and a harmony palette.
4. Use gradient fill to interpolate colors.
5. Recalculate palette with a different color count.
6. Save palette and verify it appears in "My Palettes".
7. Edit palette name and colors together; verify both are saved.
8. Delete palette.
9. Export palette in all 6 formats.
10. Toggle dark / light theme; verify all pages are readable.
11. Request password reset code via email.
12. Test mobile API endpoints with a REST client.

## Related Projects

- [Paleta Mobile](https://github.com/diamko/Paleta_mobile_app) — Android companion app built with Kotlin and Jetpack Compose.

## Contributing

Contributions are welcome. Please read the full guidelines:

- [`CONTRIBUTING.md`](CONTRIBUTING.md) (English)
- [`CONTRIBUTING.ru.md`](CONTRIBUTING.ru.md) (Russian)

Quick start:

1. Fork the repo.
2. Create a branch: `git checkout -b feature/your-feature-name`.
3. Commit changes: `git commit -m "Add: your feature"`.
4. Push branch: `git push origin feature/your-feature-name`.
5. Open a Pull Request with a clear description and test steps.

## Authors

- Diana Konanerova
- Yuliya Tyurina

## License

This project is licensed under the MIT License — see [`LICENCE`](LICENCE).
