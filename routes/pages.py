"""
Программа: «Paleta» – веб-приложение для генерации и управления цветовыми палитрами.
Модуль: routes/pages.py – маршруты пользовательских страниц.

Назначение модуля:
- Определение HTML-страниц приложения (главная, генерация палитры, мои палитры, FAQ).
- Подготовка данных для шаблонов (недавние загрузки, список палитр пользователя).
"""

from datetime import datetime, timedelta

from flask import Response, render_template, request, send_from_directory, url_for
from flask_login import login_required, current_user

from models.palette import Palette
from models.upload import Upload


def register_routes(app):
    yandex_verification_file = "yandex_a19b89f07e18fcfd.html"

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

    @app.route(f"/{yandex_verification_file}")
    def yandex_verification():
        return send_from_directory(app.root_path, yandex_verification_file)

    @app.get("/sitemap.xml")
    def sitemap_xml():
        public_endpoints = (
            "index",
            "generatePalet",
            "faq",
            "register",
            "login",
            "forgot_password",
            "reset_password",
        )
        lastmod = datetime.utcnow().date().isoformat()
        url_entries = []
        for endpoint in public_endpoints:
            location = url_for(endpoint, _external=True)
            url_entries.append(
                "\n".join(
                    (
                        "  <url>",
                        f"    <loc>{location}</loc>",
                        f"    <lastmod>{lastmod}</lastmod>",
                        "  </url>",
                    )
                )
            )

        xml = "\n".join(
            (
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                *url_entries,
                "</urlset>",
                "",
            )
        )
        return Response(xml, mimetype="application/xml")

    @app.get("/robots.txt")
    def robots_txt():
        sitemap_url = request.url_root.rstrip("/") + url_for("sitemap_xml")
        body = "\n".join(
            (
                "User-agent: *",
                "Allow: /",
                "Disallow: /api/",
                "Disallow: /myPalet",
                "Disallow: /profile",
                "Disallow: /profile/",
                "Disallow: /logout",
                f"Sitemap: {sitemap_url}",
                "",
            )
        )
        return Response(body, mimetype="text/plain")
