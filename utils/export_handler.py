"""
Программа: «Paleta» – веб-приложение для генерации и экспорта цветовых палитр.
Модуль: utils/export_handler.py – формирование данных для экспорта палитр.

Назначение модуля:
- Подготовка содержимого палитры в форматах JSON, GPL, ASE, CSV, ACO и PNG.
- Возврат бинарных данных, имени файла и режима записи для последующей отправки пользователю.
"""

import io
import json
import math
import struct
from datetime import datetime
from typing import List, Tuple, Optional

from PIL import Image, ImageDraw, ImageFont


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    """Преобразует HEX-цвет вида #RRGGBB в RGB-кортеж."""
    normalized = color.lstrip("#")
    return (
        int(normalized[0:2], 16),
        int(normalized[2:4], 16),
        int(normalized[4:6], 16),
    )


def _text_color_for_background(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Возвращает белый или темный цвет текста в зависимости от яркости фона."""
    luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return (20, 20, 20) if luminance > 150 else (245, 245, 245)


def _render_palette_png(colors: List[str]) -> bytes:
    """Рендерит PNG с цветными плашками и HEX-подписями."""
    total_colors = len(colors)
    columns = min(total_colors, 5)
    rows = math.ceil(total_colors / columns)

    swatch_width = 190
    swatch_height = 120
    label_height = 34
    card_height = swatch_height + label_height
    card_gap = 16
    padding = 24

    width = padding * 2 + columns * swatch_width + (columns - 1) * card_gap
    height = padding * 2 + rows * card_height + (rows - 1) * card_gap

    image = Image.new("RGB", (width, height), (248, 249, 251))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    for index, color in enumerate(colors):
        row = index // columns
        col = index % columns

        x1 = padding + col * (swatch_width + card_gap)
        y1 = padding + row * (card_height + card_gap)
        x2 = x1 + swatch_width - 1
        swatch_y2 = y1 + swatch_height - 1
        y2 = y1 + card_height - 1

        r, g, b = _hex_to_rgb(color)
        text_color = _text_color_for_background(r, g, b)

        draw.rectangle((x1, y1, x2, swatch_y2), fill=(r, g, b))
        draw.rectangle((x1, swatch_y2 + 1, x2, y2), fill=(238, 240, 244))
        draw.rectangle((x1, y1, x2, y2), outline=(210, 214, 220), width=1)

        label = color.upper()
        text_bbox = draw.textbbox((0, 0), label, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        text_x = x1 + (swatch_width - text_width) / 2
        text_y = y1 + (swatch_height - text_height) / 2
        draw.text((text_x, text_y), label, fill=text_color, font=font)

        caption = color.upper()
        caption_bbox = draw.textbbox((0, 0), caption, font=font)
        caption_width = caption_bbox[2] - caption_bbox[0]
        caption_height = caption_bbox[3] - caption_bbox[1]
        caption_x = x1 + (swatch_width - caption_width) / 2
        caption_y = swatch_y2 + 1 + (label_height - caption_height) / 2
        draw.text((caption_x, caption_y), caption, fill=(33, 37, 41), font=font)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def export_palette_data(colors: List[str], format_type: str = "json") -> Tuple[Optional[bytes], Optional[str], str]:
    """Генерирует данные для экспорта палитры в различных форматах.

    Возвращает кортеж (content, filename, mode), где:
    - content — содержимое файла (bytes),
    - filename — имя файла для скачивания,
    - mode — режим открытия временного файла ('w' или 'wb').
    """
    if not colors:
        return None, None, "w"

    content: bytes | str
    filename = ""
    mode = "w"  # по умолчанию текстовый режим

    # Текстовый JSON-файл с описанием палитры
    if format_type == "json":
        content = json.dumps(
            {
                "name": "Цветовая палитра",
                "colors": colors,
                "generated": datetime.now().isoformat(),
            },
            indent=2,
        )
        filename = "palette.json"

    # GPL-палитра для GIMP
    elif format_type == "gpl":
        content = "GIMP Palette\n"
        content += "Name: Generated Palette\n"
        content += "Columns: 5\n#\n"
        for color in colors:
            c = color.lstrip("#")
            r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
            content += f"{r:3d} {g:3d} {b:3d} #{c.upper()}\n"
        filename = "palette.gpl"

    # ASE-палитра для продуктов Adobe
    elif format_type == "ase":
        content = b"ASEF"
        content += struct.pack(">I", 0x00010000)
        content += struct.pack(">I", len(colors))
        for i, color in enumerate(colors):
            c = color.lstrip("#")
            r, g, b = int(c[0:2], 16) / 255.0, int(c[2:4], 16) / 255.0, int(
                c[4:6], 16
            ) / 255.0
            name = f"Цвет {i+1}"
            name_bytes = name.encode("utf-16-be")
            name_len = len(name_bytes) // 2
            block_data = struct.pack(">H", name_len) + name_bytes
            block_data += b"RGB "
            block_data += struct.pack(">fff", r, g, b)
            block_len = len(block_data)
            content += struct.pack(">HI", 0x0001, block_len)
            content += block_data
        filename = "palette.ase"
        mode = "wb"

    # Простой CSV-файл, по одному HEX-цвету в строке
    elif format_type == "csv":
        content = "Цвет\n"
        for color in colors:
            content += f"{color}\n"
        filename = "palette.csv"

    # ACO-палитра для Adobe Photoshop
    elif format_type == "aco":
        version = 1
        count = len(colors)
        content = struct.pack(">HH", version, count)
        for color in colors:
            c = color.lstrip("#")
            r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
            content += struct.pack(">HHHH", 0, r * 256, g * 256, b * 256)
        filename = "palette.aco"
        mode = "wb"

    elif format_type == "png":
        content = _render_palette_png(colors)
        filename = "palette.png"
        mode = "wb"

    else:
        return None, None, "w"

    # Приводим к bytes для удобства записи
    if isinstance(content, str) and mode == "w":
        return content.encode("utf-8"), filename, "wb"

    return content, filename, mode
