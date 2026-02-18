"""
Название: «Paleta»
Разработала: Конанерова Диана Максимовна
Группа: ТИП-62
Дата и номер версии: 2026-02-07 v1.0
Язык: Python (Flask)
Краткое описание: веб-приложение для генерации и управления цветовыми палитрами на основе изображений
Задание:
  1) создать веб-приложение на Flask, позволяющее пользователям загружать изображения и генерировать цветовые палитры на основе доминирующих цветов;
  2) реализовать функционал сохранения, редактирования и удаления сгенерированных палитр в базе данных;
  3) обеспечить возможность экспорта палитр в различных форматах (JSON, GPL, ASE, CSV, ACO);
  4) создать удобный и интуитивно понятный интерфейс для взаимодействия с приложением;
  5) реализовать сисету регистрации и аутентификации пользователей для управления их палитрами;
  6) обеспечить безопасность приложения, включая защиту от уязвимостей и безопасное хранение данных пользователей.


==================== КОНФИГУРАЦИЯ ====================
 1. ПУТИ И ДИРЕКТОРИИ
 UPLOAD_FOLDER - путь к папке для хранения загруженных изображений (./static/uploads)
 MAX_CONTENT_LENGTH - максимальный размер загружаемого файла (16 МБ)
 ALLOWED_EXTENSIONS - разрешенные расширения файлов изображений (png, jpg, jpeg, webp)
 DATABASE_URL - URI базы данных (по умолчанию SQLite: sqlite:///paleta.db)
 SECRET_KEY - секретный ключ для подписи сессий и токенов

 2. ТЕКУЩЕЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
 current_user - текущий авторизованный пользователь (объект User или AnonymousUser)
 session - объект сессии для хранения данных между запросами

 3. ОБЪЕКТЫ РАСШИРЕНИЙ
 db - объект SQLAlchemy для работы с базой данных
 login_manager - менеджер аутентификации Flask-Login
 cors - объект CORS для настройки Cross-Origin Resource Sharing

 4. МОДЕЛИ БАЗЫ ДАННЫХ
 User - модель пользователя:
   id: Integer, primary_key - уникальный идентификатор пользователя
   username: String(80), unique - имя пользователя
   password_hash: String(256) - хеш пароля
   created_at: DateTime - дата регистрации
   palettes: relationship - связь с палитрами пользователя

 Palette - модель цветовой палитры:
   id: Integer, primary_key - уникальный идентификатор палитры
   name: String(100) - название палитры
   colors: Text - JSON-строка с цветами палитры в формате HEX
   user_id: Integer, ForeignKey - ID пользователя-владельца
   created_at: DateTime - дата создания палитры
   user: relationship - связь с пользователем

 Upload - модель загруженного изображения:
   id: Integer, primary_key - уникальный идентификатор загрузки
   filename: String(200) - имя файла
   user_id: Integer, ForeignKey - ID пользователя-владельца
   created_at: DateTime - дата создания загрузки
   user: relationship - связь с пользователем

 5. ФУНКЦИИ УПРАВЛЕНИЯ ФАЙЛАМИ
 allowed_file(filename) - проверка разрешенного расширения файла

 6. ФУНКЦИИ ГЕНЕРАЦИИ ПАЛИТР
 extract_colors_from_image(image_path, num_colors) - извлечение доминирующих цветов из изображения с помощью KMeans

 7. ФУНКЦИИ ЭКСПОРТА
 export_palette_data(colors, format_type) - формирование данных для экспорта палитры в различных форматах (JSON, GPL, ASE, CSV, ACO)

 8. МАРШРУТЫ ПРИЛОЖЕНИЯ
 Страницы:
   index() - главная страница
   generatePalet() - страница генерации палитры из изображения
   myPalet() - страница с сохраненными палитрами пользователя
   faq() - страница FAQ

 Аутентификация:
   login() - вход в систему
   register() - регистрация
   logout() - выход из системы

 API:
   upload_image() - загрузка изображения для генерации палитры
   save_palette() - сохранение палитры в базу данных
   rename_palette(palette_id) - переименование существующей палитры
   delete_palette(palette_id) - удаление палитры
   export_palette() - экспорт палитры в указанном формате
   uploaded_file(filename) - выдача загруженных файлов

 9. ФУНКЦИИ ОБСЛУЖИВАНИЯ
   load_user(user_id) - загрузка пользователя по ID (для Flask-Login)
   cleanup_old_uploads(days) - очистка старых загрузок

 ==================== ИНИЦИАЛИЗАЦИЯ ====================
 ФУНКЦИЯ: create_app() -> Flask
 Создает и настраивает экземпляр Flask-приложения, инициализирует расширения,
 регистрирует маршруты и возвращает готовый к использованию объект приложения

 Основная последовательность инициализации:
 1. Создание экземпляра Flask приложения
 2. Загрузка конфигурации из класса Config
 3. Инициализация расширений (SQLAlchemy, Flask-Login, CORS)
 4. Создание папки для загрузок, если она не существует
 5. Регистрация маршрутов из отдельных модулей
 6. Возврат готового приложения

 При запуске в режиме __main__:
 - Создание структуры базы данных (db.create_all())
 - Запуск сервера в режиме отладки (debug=True)
"""

import os

from flask import Flask

from config import Config
from extensions import db, login_manager, cors
from routes.pages import register_routes as register_page_routes
from routes.auth import register_routes as register_auth_routes
from routes.api import register_routes as register_api_routes
from utils.cleanup import cleanup_old_uploads


def create_app() -> Flask:
    """Фабрика приложения, собирающая все модули воедино."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Инициализация расширений
    db.init_app(app)
    login_manager.init_app(app)
    cors.init_app(app)
    login_manager.login_view = "login"
    login_manager.login_message = "Пожалуйста, войдите, чтобы получить доступ к этой странице."
    login_manager.login_message_category = "error"

    # Гарантируем наличие папки загрузок
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Регистрация роутов по модулям
    register_page_routes(app)
    register_auth_routes(app)
    register_api_routes(app)

    return app


app = create_app()


if __name__ == "__main__":
    with app.app_context():
        # Очистка старых загрузок при запуске приложения
        cleanup_old_uploads()
    app.run(debug=True)
