"""
Программа: «Paleta» – веб-приложение для генерации и управления цветовыми палитрами.
Модуль: routes/pages.py – маршруты пользовательских страниц.

Назначение модуля:
- Определение HTML-страниц приложения (главная, генерация палитры, мои палитры, FAQ).
- Подготовка данных для шаблонов (недавние загрузки, список палитр пользователя).
"""

from datetime import datetime, timedelta

from flask import render_template
from flask_login import login_required, current_user

from models.palette import Palette
from models.upload import Upload


def register_routes(app):
    @app.route("/")
    @app.route("/index")
    def index():
        recent_uploads = []
        if current_user.is_authenticated:
            cutoff = datetime.utcnow() - timedelta(days=7)
            recent_uploads = (
                Upload.query.filter_by(user_id=current_user.id)
                .filter(Upload.created_at >= cutoff)
                .order_by(Upload.created_at.desc())
                .all()
            )

        return render_template("index.html", recent_uploads=recent_uploads)

    @app.route("/generatePalet")
    def generatePalet():
        return render_template("generatePalet.html")

    @app.route("/myPalet")
    @login_required
    def myPalet():
        palettes = (
            Palette.query.filter_by(user_id=current_user.id)
            .order_by(Palette.created_at.desc())
            .all()
        )
        return render_template("myPalet.html", palettes=palettes)

    @app.route("/faq")
    def faq():
        return render_template("faq.html")

