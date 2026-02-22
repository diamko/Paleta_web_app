"""
Модуль: `models/__init__.py`.
Назначение: Импорт моделей для корректной регистрации в SQLAlchemy metadata.
"""

from .user import User
from .user_contact import UserContact
from .password_reset_token import PasswordResetToken
from .palette import Palette
from .upload import Upload

__all__ = ["User", "UserContact", "PasswordResetToken", "Palette", "Upload"]
