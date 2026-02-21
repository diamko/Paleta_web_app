"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: routes/auth.py – маршруты аутентификации и управления сессиями.

Назначение модуля:
- Регистрация новых пользователей с проверкой сложности пароля.
- Вход и выход из системы с использованием Flask-Login.
- Загрузка пользователя по идентификатору для управления сессией.
"""

from flask import current_app, render_template, request, flash, redirect, url_for, session
from flask_login import login_user, logout_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import login_manager, db
from models.user import User
from utils.rate_limit import get_client_identifier


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def register_routes(app):
    def _is_rate_limited(bucket: str, limit: int, window_seconds: int, identity: str | None = None) -> bool:
        limiter = current_app.extensions.get("rate_limiter")
        if limiter is None:
            return False

        rate_identity = identity or get_client_identifier()
        rate_key = f"{bucket}:{rate_identity}"
        return not limiter.is_allowed(rate_key, limit, window_seconds)

    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            if _is_rate_limited("register", limit=10, window_seconds=15 * 60):
                flash("Слишком много попыток регистрации. Попробуйте через несколько минут.", "error")
                return redirect(url_for("register"))

            username = request.form.get("username")
            password = request.form.get("password")

            if not username or not password:
                flash("Пожалуйста, заполните все поля", "error")
                return redirect(url_for("register"))

            # Проверяем пароль на соответствие требованиям безопасности
            if not (10 <= len(password) <= 128):
                flash("Пароль должен содержать от 10 до 128 символов.", "error")
                return redirect(url_for("register"))

            if any(ch.isspace() for ch in password):
                flash("Пароль не должен содержать пробелы.", "error")
                return redirect(url_for("register"))

            if not any(ch.isupper() for ch in password):
                flash("Пароль должен содержать хотя бы одну заглавную букву.", "error")
                return redirect(url_for("register"))

            if not any(ch.islower() for ch in password):
                flash("Пароль должен содержать хотя бы одну строчную букву.", "error")
                return redirect(url_for("register"))

            if not any(ch.isdigit() for ch in password):
                flash("Пароль должен содержать хотя бы одну цифру.", "error")
                return redirect(url_for("register"))

            if not any(not ch.isalnum() for ch in password):
                flash("Пароль должен содержать хотя бы один спецсимвол.", "error")
                return redirect(url_for("register"))

            if username and username.lower() in password.lower():
                flash("Пароль не должен содержать имя пользователя.", "error")
                return redirect(url_for("register"))

            if User.query.filter_by(username=username).first():
                flash("Пользователь с таким именем уже существует", "error")
                return redirect(url_for("register"))

            hashed_password = generate_password_hash(password, method="scrypt")
            new_user = User(username=username, password_hash=hashed_password)
            db.session.add(new_user)
            db.session.commit()

            flash("Регистрация успешна! Теперь войдите в систему", "success")
            return redirect(url_for("login"))

        return render_template("register.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username")
            password = request.form.get("password")

            if _is_rate_limited("login_ip", limit=20, window_seconds=10 * 60):
                flash("Слишком много попыток входа. Попробуйте позже.", "error")
                return redirect(url_for("login"))

            username_key = (username or "").strip().lower() or "anonymous"
            if _is_rate_limited(
                "login_user",
                limit=10,
                window_seconds=10 * 60,
                identity=username_key,
            ):
                flash("Слишком много попыток входа для этого пользователя. Попробуйте позже.", "error")
                return redirect(url_for("login"))

            user = User.query.filter_by(username=username).first()
            if user and check_password_hash(user.password_hash, password):
                login_user(user)
                flash("Вход выполнен успешно", "success")
                return redirect(url_for("index"))
            else:
                flash("Неверное имя пользователя или пароль", "error")

        return render_template("login.html")

    @app.route("/logout", methods=["POST"])
    @login_required
    def logout():
        # Очищаем данные о последней загрузке при выходе из аккаунта
        session.pop("last_upload", None)
        logout_user()
        flash("Вы вышли из системы", "info")
        return redirect(url_for("index"))
