"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: routes/auth.py – маршруты аутентификации и управления сессиями.
"""

from datetime import datetime, timedelta
import secrets

from flask import current_app, flash, g, redirect, render_template, request, session, url_for
from flask_babel import gettext as _
from flask_login import current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from extensions import db, login_manager
from models.password_reset_token import PasswordResetToken
from models.user import User
from models.user_contact import UserContact
from utils.contact_normalizer import normalize_email
from utils.rate_limit import get_client_identifier
from utils.reset_delivery import send_password_reset_code


@login_manager.user_loader
def load_user(user_id):
    """Выполняет операцию `load_user` в рамках сценария модуля."""
    return db.session.get(User, int(user_id))


def _current_lang() -> str:
    """Служебная функция `_current_lang` для внутренней логики модуля."""
    lang = (request.view_args or {}).get("lang") if request.view_args else None
    if lang:
        return lang
    return getattr(g, "lang", current_app.config.get("DEFAULT_LANGUAGE", "en"))


def _localized_redirect(endpoint: str, code: int = 302, **values):
    """Служебная функция `_localized_redirect` для внутренней логики модуля."""
    values.setdefault("lang", _current_lang())
    return redirect(url_for(endpoint, **values), code=code)


def _validate_password_strength(password: str, username: str | None = None) -> str | None:
    """Служебная функция `_validate_password_strength` для внутренней логики модуля."""
    if not (10 <= len(password) <= 16):
        return _("Пароль должен содержать от 10 до 16 символов.")
    if any(ch.isspace() for ch in password):
        return _("Пароль не должен содержать пробелы.")
    if not any(ch.isupper() for ch in password):
        return _("Пароль должен содержать хотя бы одну заглавную букву.")
    if not any(ch.islower() for ch in password):
        return _("Пароль должен содержать хотя бы одну строчную букву.")
    if not any(ch.isdigit() for ch in password):
        return _("Пароль должен содержать хотя бы одну цифру.")
    if not any(not ch.isalnum() for ch in password):
        return _("Пароль должен содержать хотя бы один спецсимвол.")
    if username and username.lower() in password.lower():
        return _("Пароль не должен содержать имя пользователя.")
    return None


def _find_user_contact(destination: str) -> UserContact | None:
    """Служебная функция `_find_user_contact` для внутренней логики модуля."""
    return UserContact.query.filter_by(email=destination).first()


def _find_user_by_login(login_value: str) -> User | None:
    """Служебная функция `_find_user_by_login` для внутренней логики модуля."""
    raw = (login_value or "").strip()
    if not raw:
        return None

    user = User.query.filter_by(username=raw).first()
    if user:
        return user

    email = normalize_email(raw)
    if email:
        user_contact = UserContact.query.filter_by(email=email).first()
        if user_contact and user_contact.user:
            return user_contact.user

    return None


def _normalize_login_identity(login_value: str) -> str:
    """Служебная функция `_normalize_login_identity` для внутренней логики модуля."""
    raw = (login_value or "").strip()
    if not raw:
        return "anonymous"

    email = normalize_email(raw)
    if email:
        return f"email:{email}"

    return f"username:{raw.lower()}"


def _validate_username(username: str) -> str | None:
    """Служебная функция `_validate_username` для внутренней логики модуля."""
    if not username:
        return _("Имя пользователя обязательно.")
    if len(username) < 3:
        return _("Имя пользователя должно содержать минимум 3 символа.")
    if len(username) > 80:
        return _("Имя пользователя не должно превышать 80 символов.")
    if any(ch.isspace() for ch in username):
        return _("Имя пользователя не должно содержать пробелы.")
    return None


def _issue_reset_code(user_id: int, destination: str) -> tuple[bool, str]:
    """Служебная функция `_issue_reset_code` для внутренней логики модуля."""
    now = datetime.utcnow()
    expires_at = now + timedelta(
        minutes=max(5, int(current_app.config.get("PASSWORD_RESET_CODE_TTL_MINUTES", 15)))
    )
    code = f"{secrets.randbelow(1_000_000):06d}"

    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    ).update({PasswordResetToken.used_at: now}, synchronize_session=False)

    token = PasswordResetToken(
        user_id=user_id,
        channel="email",
        destination=destination,
        code_hash=generate_password_hash(code, method="scrypt"),
        expires_at=expires_at,
    )
    db.session.add(token)
    db.session.commit()

    sent = send_password_reset_code(destination, code)
    if not sent:
        current_app.logger.warning(
            "Не удалось доставить код восстановления для %s",
            destination,
        )
        token.used_at = now
        db.session.commit()

    return sent, code


def _get_active_reset_token(user_id: int, destination: str) -> PasswordResetToken | None:
    """Служебная функция `_get_active_reset_token` для внутренней логики модуля."""
    now = datetime.utcnow()
    return (
        PasswordResetToken.query.filter_by(
            user_id=user_id,
            channel="email",
            destination=destination,
            used_at=None,
        )
        .filter(PasswordResetToken.expires_at > now)
        .order_by(PasswordResetToken.created_at.desc())
        .first()
    )


def register_routes(app):
    """Выполняет операцию `register_routes` в рамках сценария модуля."""
    def _is_rate_limited(bucket: str, limit: int, window_seconds: int, identity: str | None = None) -> bool:
        """Служебная функция `_is_rate_limited` для внутренней логики модуля."""
        limiter = current_app.extensions.get("rate_limiter")
        if limiter is None:
            return False

        rate_identity = identity or get_client_identifier()
        rate_key = f"{bucket}:{rate_identity}"
        return not limiter.is_allowed(rate_key, limit, window_seconds)

    @app.get("/register")
    def register_legacy():
        """Выполняет операцию `register_legacy` в рамках сценария модуля."""
        return redirect(url_for("register", lang="ru"), code=301)

    @app.route("/<lang>/register", methods=["GET", "POST"])
    def register(lang):
        """Выполняет операцию `register` в рамках сценария модуля."""
        if request.method == "POST":
            if _is_rate_limited("register", limit=10, window_seconds=15 * 60):
                flash(_("Слишком много попыток регистрации. Попробуйте через несколько минут."), "error")
                return _localized_redirect("register")

            username = (request.form.get("username") or "").strip()
            password = request.form.get("password") or ""
            raw_email = request.form.get("email") or ""
            email = normalize_email(raw_email)

            if not username or not password:
                flash(_("Пожалуйста, заполните все поля"), "error")
                return _localized_redirect("register")

            username_error = _validate_username(username)
            if username_error:
                flash(username_error, "error")
                return _localized_redirect("register")

            if not raw_email.strip():
                flash(_("Укажите email для восстановления пароля."), "error")
                return _localized_redirect("register")

            if raw_email.strip() and not email:
                flash(_("Введите корректный email."), "error")
                return _localized_redirect("register")

            password_error = _validate_password_strength(password, username=username)
            if password_error:
                flash(password_error, "error")
                return _localized_redirect("register")

            if User.query.filter_by(username=username).first():
                flash(_("Пользователь с таким именем уже существует"), "error")
                return _localized_redirect("register")

            if email and UserContact.query.filter_by(email=email).first():
                flash(_("Этот email уже используется другим аккаунтом."), "error")
                return _localized_redirect("register")

            hashed_password = generate_password_hash(password, method="scrypt")
            new_user = User(username=username, password_hash=hashed_password)
            new_user.contact = UserContact(email=email or None)
            db.session.add(new_user)
            db.session.commit()

            flash(_("Регистрация успешна! Теперь войдите в систему"), "success")
            return _localized_redirect("login")

        return render_template("register.html")

    @app.get("/login")
    def login_legacy():
        """Выполняет операцию `login_legacy` в рамках сценария модуля."""
        return redirect(url_for("login", lang="ru"), code=301)

    @app.route("/<lang>/login", methods=["GET", "POST"])
    def login(lang):
        """Выполняет операцию `login` в рамках сценария модуля."""
        if request.method == "POST":
            login_value = (request.form.get("login") or request.form.get("username") or "").strip()
            password = request.form.get("password") or ""

            if _is_rate_limited("login_ip", limit=20, window_seconds=10 * 60):
                flash(_("Слишком много попыток входа. Попробуйте позже."), "error")
                return _localized_redirect("login")

            login_identity = _normalize_login_identity(login_value)
            if _is_rate_limited(
                "login_user",
                limit=10,
                window_seconds=10 * 60,
                identity=login_identity,
            ):
                flash(_("Слишком много попыток входа для этого пользователя. Попробуйте позже."), "error")
                return _localized_redirect("login")

            user = _find_user_by_login(login_value)
            if user and check_password_hash(user.password_hash, password):
                login_user(user)
                flash(_("Вход выполнен успешно"), "success")

                next_url = request.args.get("next") or request.form.get("next")
                if next_url and next_url.startswith("/"):
                    return redirect(next_url)

                return _localized_redirect("index")

            flash(_("Неверное имя пользователя или пароль"), "error")

        return render_template("login.html")

    @app.get("/profile")
    def profile_legacy():
        """Выполняет операцию `profile_legacy` в рамках сценария модуля."""
        return redirect(url_for("profile", lang="ru"), code=301)

    @app.get("/<lang>/profile")
    @login_required
    def profile(lang):
        """Выполняет операцию `profile` в рамках сценария модуля."""
        return render_template("profile.html", profile_contact=current_user.contact)

    @app.post("/profile/update")
    def profile_update_legacy():
        """Выполняет операцию `profile_update_legacy` в рамках сценария модуля."""
        return redirect(url_for("profile_update", lang="ru"), code=308)

    @app.post("/<lang>/profile/update")
    @login_required
    def profile_update(lang):
        """Выполняет операцию `profile_update` в рамках сценария модуля."""
        if _is_rate_limited("profile_update", limit=15, window_seconds=15 * 60, identity=str(current_user.id)):
            flash(_("Слишком много попыток изменения профиля. Попробуйте позже."), "error")
            return _localized_redirect("profile")

        username = (request.form.get("username") or "").strip()
        raw_email = request.form.get("email") or ""
        current_password = request.form.get("current_password") or ""

        if not check_password_hash(current_user.password_hash, current_password):
            flash(_("Для изменения профиля укажите текущий пароль."), "error")
            return _localized_redirect("profile")

        username_error = _validate_username(username)
        if username_error:
            flash(username_error, "error")
            return _localized_redirect("profile")

        email = normalize_email(raw_email)

        if not raw_email.strip():
            flash(_("Укажите email для восстановления пароля."), "error")
            return _localized_redirect("profile")

        if raw_email.strip() and not email:
            flash(_("Введите корректный email."), "error")
            return _localized_redirect("profile")

        existing_username = User.query.filter(
            User.username == username,
            User.id != current_user.id,
        ).first()
        if existing_username:
            flash(_("Это имя пользователя уже занято."), "error")
            return _localized_redirect("profile")

        if email:
            existing_email = UserContact.query.filter(
                UserContact.email == email,
                UserContact.user_id != current_user.id,
            ).first()
            if existing_email:
                flash(_("Этот email уже используется другим аккаунтом."), "error")
                return _localized_redirect("profile")

        current_user.username = username
        if current_user.contact is None:
            current_user.contact = UserContact(user_id=current_user.id)
        current_user.contact.email = email or None
        db.session.commit()

        flash(_("Профиль обновлён."), "success")
        return _localized_redirect("profile")

    @app.post("/profile/password/send-code")
    def profile_send_password_code_legacy():
        """Выполняет операцию `profile_send_password_code_legacy` в рамках сценария модуля."""
        return redirect(url_for("profile_send_password_code", lang="ru"), code=308)

    @app.post("/<lang>/profile/password/send-code")
    @login_required
    def profile_send_password_code(lang):
        """Выполняет операцию `profile_send_password_code` в рамках сценария модуля."""
        if _is_rate_limited(
            "profile_password_send",
            limit=8,
            window_seconds=15 * 60,
            identity=str(current_user.id),
        ):
            flash(_("Слишком много запросов на отправку кода. Попробуйте позже."), "error")
            return _localized_redirect("profile")

        contact = current_user.contact
        if not contact:
            flash(_("Сначала добавьте email в личном кабинете."), "error")
            return _localized_redirect("profile")

        destination = (contact.email or "").strip()
        if not destination:
            flash(_("Для этого аккаунта не задан email."), "error")
            return _localized_redirect("profile")

        if _is_rate_limited(
            "profile_password_send_email",
            limit=5,
            window_seconds=15 * 60,
            identity=destination,
        ):
            flash(_("Слишком много запросов для этого контакта. Попробуйте позже."), "error")
            return _localized_redirect("profile")

        sent, code = _issue_reset_code(current_user.id, destination)
        if sent:
            flash(_("Код подтверждения отправлен."), "success")
        else:
            flash(_("Не удалось отправить код. Проверьте настройки SMTP."), "error")
            if current_app.debug:
                flash(_("Dev-код: %(code)s", code=code), "info")

        return _localized_redirect("profile")

    @app.post("/profile/password/change")
    def profile_change_password_legacy():
        """Выполняет операцию `profile_change_password_legacy` в рамках сценария модуля."""
        return redirect(url_for("profile_change_password", lang="ru"), code=308)

    @app.post("/<lang>/profile/password/change")
    @login_required
    def profile_change_password(lang):
        """Выполняет операцию `profile_change_password` в рамках сценария модуля."""
        if _is_rate_limited(
            "profile_password_change",
            limit=15,
            window_seconds=15 * 60,
            identity=str(current_user.id),
        ):
            flash(_("Слишком много попыток смены пароля. Попробуйте позже."), "error")
            return _localized_redirect("profile")

        code = (request.form.get("code") or "").strip()
        new_password = request.form.get("new_password") or ""
        confirm_password = request.form.get("confirm_password") or ""

        if not (code.isdigit() and len(code) == 6):
            flash(_("Код должен состоять из 6 цифр."), "error")
            return _localized_redirect("profile")

        if new_password != confirm_password:
            flash(_("Пароли не совпадают."), "error")
            return _localized_redirect("profile")

        contact = current_user.contact
        destination = (contact.email or "").strip() if contact else ""
        if not destination:
            flash(_("Сначала укажите email в личном кабинете."), "error")
            return _localized_redirect("profile")

        if _is_rate_limited(
            "profile_password_change_email",
            limit=12,
            window_seconds=15 * 60,
            identity=destination,
        ):
            flash(_("Слишком много попыток для этого контакта. Попробуйте позже."), "error")
            return _localized_redirect("profile")

        token = _get_active_reset_token(current_user.id, destination)
        if not token:
            flash(_("Код не найден или истек. Запросите новый."), "error")
            return _localized_redirect("profile")

        max_attempts = max(3, int(current_app.config.get("PASSWORD_RESET_MAX_ATTEMPTS", 5)))
        if token.attempts >= max_attempts:
            flash(_("Превышено число попыток. Запросите новый код."), "error")
            return _localized_redirect("profile")

        if not check_password_hash(token.code_hash, code):
            token.attempts += 1
            db.session.commit()
            flash(_("Неверный код подтверждения."), "error")
            return _localized_redirect("profile")

        password_error = _validate_password_strength(new_password, username=current_user.username)
        if password_error:
            flash(password_error, "error")
            return _localized_redirect("profile")

        if check_password_hash(current_user.password_hash, new_password):
            flash(_("Новый пароль должен отличаться от текущего."), "error")
            return _localized_redirect("profile")

        now = datetime.utcnow()
        current_user.password_hash = generate_password_hash(new_password, method="scrypt")
        token.used_at = now
        PasswordResetToken.query.filter(
            PasswordResetToken.user_id == current_user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
            PasswordResetToken.id != token.id,
        ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
        db.session.commit()

        flash(_("Пароль успешно изменен."), "success")
        return _localized_redirect("profile")

    @app.get("/forgot-password")
    def forgot_password_legacy():
        """Выполняет операцию `forgot_password_legacy` в рамках сценария модуля."""
        return redirect(url_for("forgot_password", lang="ru"), code=301)

    @app.route("/<lang>/forgot-password", methods=["GET", "POST"])
    def forgot_password(lang):
        """Выполняет операцию `forgot_password` в рамках сценария модуля."""
        if request.method == "POST":
            if _is_rate_limited("forgot_password_ip", limit=8, window_seconds=15 * 60):
                flash(_("Слишком много запросов. Попробуйте позже."), "error")
                return _localized_redirect("forgot_password")

            raw_contact = (request.form.get("contact") or "").strip()
            destination = normalize_email(raw_contact)
            if not destination:
                flash(_("Введите корректный email."), "error")
                return _localized_redirect("forgot_password")

            if _is_rate_limited(
                "forgot_password_email",
                limit=5,
                window_seconds=15 * 60,
                identity=destination,
            ):
                flash(_("Слишком много запросов для этого контакта. Попробуйте позже."), "error")
                return _localized_redirect("forgot_password")

            user_contact = _find_user_contact(destination)
            if user_contact and user_contact.user:
                sent, code = _issue_reset_code(user_contact.user_id, destination)
                if not sent and current_app.debug:
                    flash(_("Dev-код восстановления: %(code)s", code=code), "info")

            # Не раскрываем, существует ли аккаунт для указанного контакта.
            flash(_("Если контакт найден, код восстановления отправлен."), "success")
            return _localized_redirect("reset_password", contact=destination)

        return render_template("forgot_password.html")

    @app.get("/reset-password")
    def reset_password_legacy():
        """Выполняет операцию `reset_password_legacy` в рамках сценария модуля."""
        return redirect(url_for("reset_password", lang="ru"), code=301)

    @app.route("/<lang>/reset-password", methods=["GET", "POST"])
    def reset_password(lang):
        """Выполняет операцию `reset_password` в рамках сценария модуля."""
        if request.method == "POST":
            if _is_rate_limited("reset_password_ip", limit=20, window_seconds=15 * 60):
                flash(_("Слишком много попыток сброса пароля. Попробуйте позже."), "error")
                return _localized_redirect("reset_password")

            raw_contact = (request.form.get("contact") or "").strip()
            code = (request.form.get("code") or "").strip()
            new_password = request.form.get("new_password") or ""
            confirm_password = request.form.get("confirm_password") or ""

            destination = normalize_email(raw_contact)
            if not destination:
                flash(_("Введите корректный email."), "error")
                return _localized_redirect("reset_password")

            if not (code.isdigit() and len(code) == 6):
                flash(_("Код восстановления должен состоять из 6 цифр."), "error")
                return _localized_redirect("reset_password", contact=destination)

            if new_password != confirm_password:
                flash(_("Пароли не совпадают."), "error")
                return _localized_redirect("reset_password", contact=destination)

            user_contact = _find_user_contact(destination)
            if not user_contact or not user_contact.user:
                flash(_("Неверный код или контакт. Проверьте данные."), "error")
                return _localized_redirect("reset_password", contact=destination)

            if _is_rate_limited(
                "reset_password_email",
                limit=12,
                window_seconds=15 * 60,
                identity=destination,
            ):
                flash(_("Слишком много попыток для этого контакта. Попробуйте позже."), "error")
                return _localized_redirect("reset_password", contact=destination)

            token = _get_active_reset_token(user_contact.user_id, destination)

            if not token:
                flash(_("Код не найден или истек. Запросите новый код."), "error")
                return _localized_redirect("forgot_password")

            max_attempts = max(3, int(current_app.config.get("PASSWORD_RESET_MAX_ATTEMPTS", 5)))
            if token.attempts >= max_attempts:
                flash(_("Превышено число попыток. Запросите новый код."), "error")
                return _localized_redirect("forgot_password")

            if not check_password_hash(token.code_hash, code):
                token.attempts += 1
                db.session.commit()
                flash(_("Неверный код восстановления."), "error")
                return _localized_redirect("reset_password", contact=destination)

            password_error = _validate_password_strength(new_password, username=user_contact.user.username)
            if password_error:
                flash(password_error, "error")
                return _localized_redirect("reset_password", contact=destination)

            if check_password_hash(user_contact.user.password_hash, new_password):
                flash(_("Новый пароль должен отличаться от текущего."), "error")
                return _localized_redirect("reset_password", contact=destination)

            now = datetime.utcnow()
            user_contact.user.password_hash = generate_password_hash(new_password, method="scrypt")
            token.used_at = now
            PasswordResetToken.query.filter(
                PasswordResetToken.user_id == user_contact.user_id,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
                PasswordResetToken.id != token.id,
            ).update({PasswordResetToken.used_at: now}, synchronize_session=False)
            db.session.commit()

            flash(_("Пароль обновлен. Теперь вы можете войти с новым паролем."), "success")
            return _localized_redirect("login")

        prefill_contact = (request.args.get("contact") or "").strip()
        return render_template(
            "reset_password.html",
            prefill_contact=prefill_contact,
        )

    @app.post("/logout")
    def logout_legacy():
        """Выполняет операцию `logout_legacy` в рамках сценария модуля."""
        return redirect(url_for("logout", lang="ru"), code=308)

    @app.route("/<lang>/logout", methods=["POST"])
    @login_required
    def logout(lang):
        """Выполняет операцию `logout` в рамках сценария модуля."""
        session.pop("last_upload", None)
        logout_user()
        flash(_("Вы вышли из системы"), "info")
        return _localized_redirect("index")
