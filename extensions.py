from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS

# Все расширения создаём здесь и инициализируем в фабрике приложения
db = SQLAlchemy()
login_manager = LoginManager()
cors = CORS()