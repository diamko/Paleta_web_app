"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: models/upload.py – модель загруженного изображения.

Назначение модуля:
- Описание ORM-модели Upload для учёта загруженных пользователями изображений.
- Хранение имени файла, даты загрузки и (при наличии) ссылки на пользователя.
"""

from datetime import datetime
from extensions import db


class Upload(db.Model):
    """Класс `Upload` описывает сущность текущего модуля."""
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Привязка к пользователю (может быть пустой для анонимных загрузок)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

