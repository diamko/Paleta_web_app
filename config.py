"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: config.py – конфигурация приложения.

Назначение модуля:
- Определение базовых параметров приложения Flask (секретный ключ, строка подключения к БД).
- Настройка параметров загрузки файлов (папка, максимальный размер, допустимые расширения).
- Предоставление вспомогательной функции allowed_file() для проверки расширения файлов.
"""

import os


def _get_env_bool(name: str, default: bool = False) -> bool:
    """Преобразует переменную окружения в bool."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Базовая конфигурация приложения."""

    SECRET_KEY = os.environ.get("SECRET_KEY")
    if not SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY environment variable is required. "
            "Set a strong random value before starting the app."
        )

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "sqlite:////app/instance/paleta.db",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_SECURE = _get_env_bool("SESSION_COOKIE_SECURE", default=False)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")

    UPLOAD_FOLDER = "static/uploads"
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

    @staticmethod
    def allowed_file(filename: str) -> bool:
        return (
            "." in filename
            and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS
        )
