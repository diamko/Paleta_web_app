"""
Модуль: `utils/i18n.py`.
Назначение: Вспомогательная логика выбора и нормализации языка интерфейса.
"""

from __future__ import annotations

from flask import Request


def is_supported_language(lang: str | None, supported_languages: tuple[str, ...]) -> bool:
    """Выполняет операцию `is_supported_language` в рамках сценария модуля."""
    if not lang:
        return False
    return lang.strip().lower() in supported_languages


def _normalize_language(lang: str | None, supported_languages: tuple[str, ...], default_language: str) -> str:
    """Служебная функция `_normalize_language` для внутренней логики модуля."""
    if not lang:
        return default_language
    normalized = lang.strip().lower()
    if normalized in supported_languages:
        return normalized
    return default_language


def resolve_auto_language(
    request: Request,
    supported_languages: tuple[str, ...],
    default_language: str,
    ru_country_codes: set[str],
) -> str:
    """Выполняет операцию `resolve_auto_language` в рамках сценария модуля."""
    country_code = (request.headers.get("X-Country-Code") or "").strip().upper()
    if country_code and country_code in ru_country_codes and "ru" in supported_languages:
        return "ru"

    preferred = request.accept_languages.best_match(supported_languages)
    if preferred:
        return preferred

    return default_language


def resolve_request_language(
    request: Request,
    url_lang: str | None,
    supported_languages: tuple[str, ...],
    cookie_name: str,
    default_language: str,
    ru_country_codes: set[str],
) -> str:
    """Выполняет операцию `resolve_request_language` в рамках сценария модуля."""
    default = _normalize_language(default_language, supported_languages, supported_languages[0])

    if is_supported_language(url_lang, supported_languages):
        return url_lang.strip().lower()

    cookie_lang = request.cookies.get(cookie_name)
    if is_supported_language(cookie_lang, supported_languages):
        return cookie_lang.strip().lower()

    return resolve_auto_language(
        request=request,
        supported_languages=supported_languages,
        default_language=default,
        ru_country_codes=ru_country_codes,
    )
