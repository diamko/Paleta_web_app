"""
Программа: «Paleta» – веб-приложение для работы с цветовыми палитрами.
Модуль: utils/image_processor.py – обработка изображений.

Назначение модуля:
- Открытие и предварительная обработка изображений.
- Выделение доминирующих цветов с помощью алгоритма KMeans.
- Преобразование найденных цветов в HEX-представление.
"""

from PIL import Image
import numpy as np
from sklearn.cluster import KMeans


def extract_colors_from_image(image_path, num_colors: int = 5):
    """Извлекает доминирующие цвета из изображения с помощью алгоритма KMeans."""
    try:
        print(f"Извлечение цветов из файла: {image_path}")
        img = Image.open(image_path).convert("RGB")
        print(f"Изображение открыто, размер: {img.size}")
        img = img.resize((200, 200))
        print("Изображение уменьшено до 200x200 для ускорения обработки")

        pixels = np.array(img).reshape(-1, 3)
        print(f"Количество пикселей для кластеризации: {pixels.shape[0]}")

        kmeans = KMeans(
            n_clusters=num_colors,
            random_state=42,
            n_init=10,
        )
        kmeans.fit(pixels)
        print("Модель KMeans обучена на пикселях изображения")

        colors = kmeans.cluster_centers_.astype(int)
        print(f"Найденные центры кластеров (RGB): {colors}")

        hex_colors = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors]
        print(f"Итоговые HEX-цвета: {hex_colors}")
        return hex_colors
    except Exception as e:
        print(f"Ошибка в extract_colors_from_image: {e}")
        import traceback
        traceback.print_exc()
        raise

