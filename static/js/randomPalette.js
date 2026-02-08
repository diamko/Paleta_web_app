// генерация случайной палитры и взаимодействие с пользователем
document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generateBtn');
    const colorPalette = document.getElementById('colorPalette');
    const colorCountSelect = document.getElementById('colorCount');
    const savePaletteBtn = document.getElementById('savePaletteBtn');
    const exportOptions = document.querySelectorAll('.export-option');

    let currentColors = [];

    // Генерация палитры при клике на кнопку
    generateBtn.addEventListener('click', () => {
        const count = parseInt(colorCountSelect.value);
        currentColors = generateRandomColors(count);
        displayPalette(currentColors);
    });

    // Функция генерации случайных цветов
    function generateRandomColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            colors.push(color);
        }
        return colors;
    }

    // Функция отображения палитры
    function displayPalette(colors) {
        colorPalette.innerHTML = '';

        colors.forEach(color => {
            // Создаем элемент для каждого цвета
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.innerHTML = `<div class="hex-code">${color}</div>`;
            swatch.addEventListener('click', () => copyToClipboard(color));
            colorPalette.appendChild(swatch);
        });

        //  Показываем секцию с действиями (сохранить, экспортировать)
        const actionsSection = document.getElementById('actionsSection');
        if (actionsSection) {
            actionsSection.classList.remove('d-none');
        }
    }

    //  Копирование HEX кода в буфер обмена
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('HEX код скопирован!');
        } catch (err) {
            console.error('Ошибка копирования:', err);
            //  Резервный способ для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('HEX код скопирован!');
        }
    }

    //  Обработчик для сохранения палитры
    savePaletteBtn.addEventListener('click', () => {
        if (currentColors.length === 0) {
            showToast('Сначала сгенерируйте палитру!', 'error');
            return;
        }

        //  Заполняем модальное окно текущими цветами
        const modalPalette = document.getElementById('modalPalette');
        modalPalette.innerHTML = '';

        currentColors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-swatch-small';
            colorDiv.style.backgroundColor = color;
            colorDiv.style.width = '30px';
            colorDiv.style.height = '30px';
            colorDiv.style.borderRadius = '5px';
            modalPalette.appendChild(colorDiv);
        });

        //  Очищаем поле ввода названия палитры
        document.getElementById('paletteName').value = '';
        
        // Модальное окно откроется через data-bs-toggle
    });

    //  Обработчик для подтверждения сохранения палитры
    document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
        const paletteNameInput = document.getElementById('paletteName');
        const originalValue = paletteNameInput?.value || '';
        const paletteName = originalValue.trim();
        
        // Если пользователь ввел только пробелы - это ошибка
        if (originalValue && !paletteName) {
            showToast('Название палитры не может состоять только из пробелов', 'error');
            return;
        }
        
        // Если название пустое (пользователь ничего не ввел), используем значение по умолчанию
        const finalName = paletteName || 'Моя палитра';
        
        const saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
        
        try {
            const response = await fetch('/api/palettes/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: finalName,
                    colors: currentColors
                })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    showToast('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                    window.location.href = '/login';
                    return;
                }
                // Для других ошибок, попробуем получить сообщение из ответа
                let errorMessage = 'Ошибка при сохранении';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Если не JSON, оставляем общее сообщение
                }
                showToast(errorMessage, 'error');
                return;
            }

            const data = await response.json();

            if (data.success) {
                showToast('Палитра сохранена!');
                if (saveModal) saveModal.hide();
            } else {
                showToast(data.error || 'Ошибка при сохранении', 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            showToast('Ошибка при сохранении палитры', 'error');
        }
    });

    //  Обработчики для экспорта палитры
    exportOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
            e.preventDefault();

            if (currentColors.length === 0) {
                showToast('Сначала сгенерируйте палитру!', 'error');
                return;
            }

            const format = e.target.dataset.format;

            try {
                const response = await fetch(`/api/export?format=${format}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ colors: currentColors })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `palette.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            } catch (error) {
                console.error('Export error:', error);
                showToast('Ошибка при экспорте', 'error');
            }
        });
    });
});
