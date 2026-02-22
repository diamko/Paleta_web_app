"""
Модуль: `utils/cleanup.py`.
Назначение: Очистка устаревших пользовательских загрузок и связанных записей.
"""

import os
from datetime import datetime, timedelta
from extensions import db
from models.upload import Upload

UPLOAD_FOLDER = 'static/uploads'

def cleanup_old_uploads(days=7):
    """Выполняет операцию `cleanup_old_uploads` в рамках сценария модуля."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    old_files = Upload.query.filter(
        Upload.created_at < cutoff
    ).all()

    for f in old_files:
        file_path = os.path.join(UPLOAD_FOLDER, f.filename)

        if os.path.exists(file_path):
            os.remove(file_path)

        db.session.delete(f)

    db.session.commit()
