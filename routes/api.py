"""
Программа: «Paleta» – веб-приложение для генерации и экспорта цветовых палитр.
Модуль: routes/api.py – REST-подобные API-маршруты.

Назначение модуля:
- Обработка загрузки изображений и извлечение доминирующих цветов.
- Управление пользовательскими палитрами (создание, переименование, удаление).
- Экспорт палитр в различные форматы (JSON, GPL, ASE, CSV, ACO).
- Выдача загруженных файлов из папки static/uploads.
"""

import os
import tempfile
from datetime import datetime

from flask import request, jsonify, session, send_file, send_from_directory
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from extensions import db
from models.palette import Palette
from models.upload import Upload
from utils.image_processor import extract_colors_from_image
from utils.export_handler import export_palette_data
from config import Config


def _allowed_file(filename: str) -> bool:
    return Config.allowed_file(filename)


def register_routes(app):
    @app.route("/api/upload", methods=["POST"])
    def upload_image():
        """Обработчик загрузки изображения и извлечения палитры."""
        try:
            # Логируем факт получения запроса
            print("Получен запрос на загрузку изображения")
            if "image" not in request.files:
                print("В запросе нет файла (ключ 'image')")
                return jsonify({"success": False, "error": "Файл не был загружен"}), 400

            file = request.files["image"]
            print(f"Имя файла: {file.filename}")

            # Проверяем, что пользователь действительно выбрал файл
            if file.filename == "":
                print("Пустое имя файла")
                return jsonify({"success": False, "error": "Файл не выбран"}), 400

            # Проверяем тип файла по расширению
            if not _allowed_file(file.filename):
                print(f"Недопустимый тип файла: {file.filename}")
                return (
                    jsonify({"success": False, "error": "Недопустимый тип файла"}),
                    400,
                )

            # Формируем уникальное имя файла и путь до него
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
            print(f"Сохраняем файл в: {filepath}")

            # Сохраняем файл на диск
            file.save(filepath)
            print("Файл успешно сохранён")

            # Количество цветов, запрошенное пользователем
            color_count = request.form.get("color_count", 5, type=int)
            print(f"Запрошено цветов: {color_count}")

            # Извлекаем палитру из изображения
            try:
                palette = extract_colors_from_image(filepath, color_count)
            except Exception as e:
                print(f"Ошибка при извлечении цветов: {e}")
                import traceback

                traceback.print_exc()
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Не удалось извлечь цвета из изображения",
                        }
                    ),
                    500,
                )
            print(f"Полученная палитра: {palette}")

            # Создаём запись о новом загруженном файле и, при наличии, привязываем её к пользователю
            upload_record = Upload(
                filename=unique_filename,
                user_id=current_user.id if current_user.is_authenticated else None,
            )
            db.session.add(upload_record)
            db.session.commit()

            # Обновляем данные последней загрузки в сессии
            session["last_upload"] = {
                "filename": unique_filename,
                "palette": palette,
            }

            return jsonify(
                {
                    "success": True,
                    "filename": unique_filename,
                    "palette": palette,
                }
            )

        except Exception as e:
            print("ОШИБКА ЗАГРУЗКИ:", e)
            import traceback

            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/palettes/save", methods=["POST"])
    @login_required
    def save_palette():
        try:
            data = request.get_json(force=True)
            palette_name = data.get("name", "").strip()
            colors = data.get("colors", [])

            if not colors:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Палитра не может быть пустой",
                        }
                    ),
                    400,
                )

            # Проверяем, что название не состоит только из пробелов
            # Если пользователь явно отправил название (не None и не пустая строка по умолчанию),
            # но оно пустое после strip - это ошибка
            original_name = data.get("name")
            if original_name is not None and original_name.strip() == "":
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Название палитры не может быть пустым или состоять только из пробелов",
                        }
                    ),
                    400,
                )

            # Значения по умолчанию, которые нужно нумеровать
            default_names = ["Моя палитра", "Без названия", "Untitled Palette", "Random Palette", ""]
            
            # Если название пустое или является значением по умолчанию, используем "Моя палитра"
            if not palette_name or palette_name in default_names:
                base_name = "Моя палитра"
                
                # Проверяем, существует ли "Моя палитра"
                existing = Palette.query.filter_by(
                    user_id=current_user.id, name=base_name
                ).first()
                
                if not existing:
                    # Если базовое имя свободно, используем его
                    palette_name = base_name
                else:
                    # Ищем свободное имя с номером
                    counter = 1
                    while True:
                        candidate_name = f"{base_name} {counter}"
                        existing = Palette.query.filter_by(
                            user_id=current_user.id, name=candidate_name
                        ).first()
                        if not existing:
                            palette_name = candidate_name
                            break
                        counter += 1
            else:
                # Для пользовательских названий проверяем уникальность
                existing_palette = Palette.query.filter_by(
                    user_id=current_user.id, name=palette_name
                ).first()
                if existing_palette:
                    return (
                        jsonify(
                            {
                                "success": False,
                                "error": "У вас уже есть палитра с таким названием",
                            }
                        ),
                        400,
                    )

            print(f"Сохраняем палитру '{palette_name}': {colors}")

            new_palette = Palette(
                name=palette_name,
                colors=colors,
                user_id=current_user.id,
            )
            db.session.add(new_palette)
            db.session.commit()

            return jsonify({"success": True, "palette_id": new_palette.id})

        except Exception as e:
            print("ОШИБКА СОХРАНЕНИЯ ПАЛИТРЫ:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/palettes/rename/<int:palette_id>", methods=["POST"])
    @login_required
    def rename_palette(palette_id: int):
        """Переименовать существующую палитру текущего пользователя."""
        try:
            data = request.get_json(force=True)
            new_name = (data.get("name") or "").strip()

            if not new_name:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Название палитры не может быть пустым",
                        }
                    ),
                    400,
                )

            palette = Palette.query.get_or_404(palette_id)

            # Проверяем, что палитра принадлежит текущему пользователю
            if palette.user_id != current_user.id:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "У вас нет прав на изменение этой палитры",
                        }
                    ),
                    403,
                )

            # Проверяем уникальность названия для данного пользователя
            existing = Palette.query.filter_by(
                user_id=current_user.id, name=new_name
            ).first()
            if existing and existing.id != palette.id:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "У вас уже есть палитра с таким названием",
                        }
                    ),
                    400,
                )

            print(f"Переименовываем палитру id={palette_id} в '{new_name}'")
            palette.name = new_name
            db.session.commit()

            return jsonify({"success": True})

        except Exception as e:
            print("ОШИБКА ПЕРЕИМЕНОВАНИЯ ПАЛИТРЫ:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/palettes/delete/<int:palette_id>", methods=["DELETE"])
    @login_required
    def delete_palette(palette_id: int):
        try:
            palette = Palette.query.get_or_404(palette_id)

            if palette.user_id != current_user.id:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "У вас нет прав на удаление этой палитры",
                        }
                    ),
                    403,
                )

            db.session.delete(palette)
            db.session.commit()

            return jsonify({"success": True})

        except Exception as e:
            print("ОШИБКА УДАЛЕНИЯ ПАЛИТРЫ:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/api/export", methods=["POST"])
    def export_palette():
        try:
            data = request.get_json(force=True)
            colors = data.get("colors", [])

            format_type = request.args.get("format", "json").lower()

            if not colors:
                return (
                    jsonify({"success": False, "error": "Не переданы цвета палитры"}),
                    400,
                )

            content, filename, mode = export_palette_data(colors, format_type)
            if content is None or filename is None:
                if format_type == "png":
                    return jsonify(
                        {
                            "success": True,
                            "message": "Экспорт PNG пока не реализован",
                        }
                    )
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Неподдерживаемый формат экспорта",
                        }
                    ),
                    400,
                )

            suffix = f".{format_type}"
            with tempfile.NamedTemporaryFile(
                delete=False, mode=mode, suffix=suffix
            ) as f:
                f.write(content)
                temp_path = f.name

            response = send_file(temp_path, as_attachment=True, download_name=filename)

            @response.call_on_close
            def cleanup():
                os.unlink(temp_path)

            return response

        except Exception as e:
            print("ОШИБКА ЭКСПОРТА ПАЛИТРЫ:", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route("/static/uploads/<filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    @app.route("/favicon.ico")
    def favicon():
        return "", 204

