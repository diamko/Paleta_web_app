"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: models/palette.py – модель цветовой палитры.

Назначение модуля:
- Описание ORM-модели Palette для хранения пользовательских палитр.
- Хранение названия палитры, списка цветов и привязки к пользователю.
- Дополнительный метод для экспорта палитры в формат GPL (GIMP Palette).
"""

from datetime import datetime
from extensions import db

class Palette(db.Model):
    """Класс `Palette` описывает сущность текущего модуля."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, default='Без названия')
    colors = db.Column(db.JSON, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_gpl_format(self):
        """Выполняет операцию `to_gpl_format` в рамках сценария модуля."""
        gpl = f"GIMP Palette\nName: {self.name}\n#\n"
        for color in self.colors:
            hex_color = color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            gpl += f"{rgb[0]} {rgb[1]} {rgb[2]} Color\n"
        return gpl