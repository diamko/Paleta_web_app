"""
Модуль: `utils/reset_delivery.py`.
Назначение: Доставка кода восстановления через email.
"""

import smtplib
import ssl
from email.message import EmailMessage

from flask import current_app


def send_password_reset_code(destination: str, code: str) -> bool:
    """Выполняет операцию `send_password_reset_code` в рамках сценария модуля."""
    return _send_email_code(destination, code)


def _send_email_code(email: str, code: str) -> bool:
    """Служебная функция `_send_email_code` для внутренней логики модуля."""
    cfg = current_app.config
    host = cfg.get("SMTP_HOST", "").strip()
    sender = cfg.get("SMTP_FROM", "").strip()
    if not host or not sender:
        return False

    port = int(cfg.get("SMTP_PORT", 587))
    use_ssl = bool(cfg.get("SMTP_USE_SSL", False))
    use_tls = bool(cfg.get("SMTP_USE_TLS", True))
    username = cfg.get("SMTP_USER", "").strip()
    password = cfg.get("SMTP_PASSWORD", "")

    msg = EmailMessage()
    msg["Subject"] = "Код восстановления пароля Paleta"
    msg["From"] = sender
    msg["To"] = email
    msg.set_content(
        (
            "Вы запросили восстановление пароля в Paleta.\n"
            f"Код подтверждения: {code}\n\n"
            "Код действует ограниченное время. Если запрос сделали не вы, просто проигнорируйте письмо."
        )
    )

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=10, context=ssl.create_default_context()) as client:
                if username:
                    client.login(username, password)
                client.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as client:
                if use_tls:
                    client.starttls(context=ssl.create_default_context())
                if username:
                    client.login(username, password)
                client.send_message(msg)
        return True
    except Exception:
        current_app.logger.exception("Не удалось отправить код восстановления на email: %s", email)
        return False
