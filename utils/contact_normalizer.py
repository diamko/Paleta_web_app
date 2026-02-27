"""
Модуль: `utils/contact_normalizer.py`.
Назначение: Нормализация email-контактов пользователей.
"""

import re


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str | None) -> str:
    """Выполняет операцию `normalize_email` в рамках сценария модуля."""
    if not value:
        return ""
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        return ""
    return email
