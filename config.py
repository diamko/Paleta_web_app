"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: config.py – конфигурация приложения.

Назначение модуля:
- Определение базовых параметров приложения Flask (секретный ключ, строка подключения к БД).
- Настройка параметров загрузки файлов (папка, максимальный размер, допустимые расширения).
- Предоставление вспомогательной функции allowed_file() для проверки расширения файлов.
"""

import os


class Config:
    """Базовая конфигурация приложения."""

    SECRET_KEY = os.environ.get('SECRET_KEY') or "super-secret-key-change-me"
    SQLALCHEMY_DATABASE_URI = 'sqlite:///paleta.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

    @staticmethod
    def allowed_file(filename: str) -> bool:
        return (
            '.' in filename
            and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
        )