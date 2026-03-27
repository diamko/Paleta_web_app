# CLAUDE.md — Paleta

## Что это

Веб-приложение для генерации, редактирования, сохранения и экспорта цветовых палитр.
Живой сайт: **diamko.ru**

## Стек

| Слой | Технология |
|------|-----------|
| Бэкенд | Python 3.12, Flask 2.3.3, SQLAlchemy, Gunicorn |
| БД | PostgreSQL (psycopg 3) |
| ML | scikit-learn KMeans, Pillow |
| Фронтенд | Bootstrap 5, Vanilla JS, HTML5 Canvas |
| Деплой | Docker Compose, Nginx, Let's Encrypt |
| i18n | Flask-Babel (RU / EN) |
| Мобильный клиент | REST API (routes/mobile_api.py) — Android-приложение разработано напарницей |

## Структура

```
app.py              — точка входа, фабрика приложения
config.py           — конфиг (dev / prod из .env)
extensions.py       — db, login_manager, babel, ...
models/             — User, Palette, Upload, PasswordResetToken, UserContact
routes/
  pages.py          — публичные страницы (главная, FAQ, ...)
  auth.py           — регистрация, вход, сброс пароля
  api.py            — веб-API (AJAX)
  mobile_api.py     — REST API для Android (/api/mobile/v1/)
  cleanup.py        — фоновая очистка старых загрузок
utils/
  image_processor.py — KMeans-извлечение палитры из изображения
  export_handler.py  — экспорт JSON/GPL/ASE/ACO/CSV/PNG
  rate_limit.py      — rate limiting по IP / user
  reset_delivery.py  — email-сброс пароля
  i18n.py, contact_normalizer.py, ...
static/
  uploads/          — загрузки пользователей (монтируется в Docker)
  apk/              — Android APK
templates/          — Jinja2-шаблоны
translations/       — .po/.mo файлы (Flask-Babel)
deploy/             — nginx.conf, certbot, systemd и прочее
data/               — PostgreSQL data / instance (только в Docker, в .gitignore)
tests/              — pytest (в .gitignore в Docker-образе)
```

## Запуск для разработки

```bash
cp .env.prod.example .env   # заполнить переменные
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
flask db upgrade            # если используются миграции
flask run
```

## Запуск через Docker (продакшен)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Ключевые детали реализации

- **KMeans**: resize → 200×200, n_clusters 3–15, n_init=10, RGB→HEX (`utils/image_processor.py`)
- **10 гармоний**: HSL-пространство, алгоритм в `utils/` (или `routes/api.py`)
- **Экспорт ASE/ACO**: побайтовая сборка через `struct.pack` (`utils/export_handler.py`)
- **Безопасность**: scrypt-хеш паролей, CSRF-токены, rate limiting, email-код 6 цифр TTL 15 мин
- **Mobile API**: access + refresh токены, 28 эндпоинтов (`routes/mobile_api.py`)
- **Куки**: Secure, HttpOnly, SameSite=Lax
- **Загрузки**: двойная валидация (расширение + реальный формат через Pillow), макс. 16 МБ

## Переменные окружения (см. .env.prod.example)

`SECRET_KEY`, `DATABASE_URL`, `MAIL_*`, `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH`

## Тесты

```bash
pytest tests/
```

## Конференция (апрель 2026)

Файлы для доклада на "Студенческая научная весна" МГТУ — **не коммитить**:
- `план-презентации.md`
- `тезисы.md`
