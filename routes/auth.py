"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: routes/auth.py – маршруты аутентификации и управления сессиями.

Назначение модуля:
- Регистрация новых пользователей с проверкой сложности пароля.
- Вход и выход из системы с использованием Flask-Login.
- Загрузка пользователя по идентификатору для управления сессией.
"""

from flask import render_template, request, flash, redirect, url_for, session
from flask_login import login_user, logout_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import login_manager, db
from models.user import User


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def register_routes(app):
    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            username = request.form.get("username")
            password = request.form.get("password")

            if not username or not password:
                flash("Пожалуйста, заполните все поля", "error")
                return redirect(url_for("register"))

            # Проверяем пароль на соответствие требованиям безопасности
            # 1) длина от 4 до 16 символов
            if not (4 <= len(password) <= 16):
                flash("Пароль должен содержать от 4 до 16 символов.", "error")
                return redirect(url_for("register"))

            # 2) запрет символов из набора * & { } | +
            forbidden_chars = set("*&{}|+")
            if any(ch in forbidden_chars for ch in password):
                flash("Пароль не должен содержать символы: * & { } | +", "error")
                return redirect(url_for("register"))

            # 3) должна быть хотя бы одна заглавная буква
            if not any(ch.isupper() for ch in password):
                flash("Пароль должен содержать хотя бы одну заглавную букву.", "error")
                return redirect(url_for("register"))

            # 4) должна быть хотя бы одна цифра
            if not any(ch.isdigit() for ch in password):
                flash("Пароль должен содержать хотя бы одну цифру.", "error")
                return redirect(url_for("register"))

            if User.query.filter_by(username=username).first():
                flash("Пользователь с таким именем уже существует", "error")
                return redirect(url_for("register"))

            hashed_password = generate_password_hash(password)
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

            user = User.query.filter_by(username=username).first()
            if user and check_password_hash(user.password_hash, password):
                login_user(user)
                flash("Вход выполнен успешно", "success")
                return redirect(url_for("index"))
            else:
                flash("Неверное имя пользователя или пароль", "error")

        return render_template("login.html")

    @app.route("/logout")
    @login_required
    def logout():
        # Очищаем данные о последней загрузке при выходе из аккаунта
        session.pop("last_upload", None)
        logout_user()
        flash("Вы вышли из системы", "info")
        return redirect(url_for("index"))

