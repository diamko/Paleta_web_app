document.addEventListener('DOMContentLoaded', function() {
    const uploadZone = document.getElementById('uploadZone');
    const imageInput = document.getElementById('imageInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadForm = document.getElementById('uploadForm');
    const resultSection = document.getElementById('resultSection');
    const imagePreview = document.getElementById('imagePreview');
    const colorPalette = document.getElementById('colorPalette');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const reanalyzeBtn = document.getElementById('reanalyzeBtn');
    const newImageBtn = document.getElementById('newImageBtn');
    const colorCountSelect = document.getElementById('colorCountSelect');
    const recentUploadsSection = document.getElementById('recentUploadsSection');
    const recentUploadsRow = document.getElementById('recentUploadsRow');
    const recentUploadsEmpty = document.getElementById('recentUploadsEmpty');
    const savePaletteBtn = document.getElementById('savePaletteBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const exportOptions = document.querySelectorAll('.export-option');
    
    let currentImageFile = null;
    let currentColors = [];

    // Функция для конвертации DataURL (строки base64) обратно в Blob-объект
    function dataURLToBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], {type: contentType});
    }

    // При загрузке страницы пытаемся восстановить poslednyuyu палитру из localStorage
    const savedFilename = localStorage.getItem('lastImageFilename');
    const savedPalette = localStorage.getItem('lastPalette');
    const savedImageDataURL = localStorage.getItem('lastImageDataURL');
    
    if (savedFilename && savedPalette && savedImageDataURL) {
        try {
            const palette = JSON.parse(savedPalette);
            currentColors = palette;
            displayPalette(palette);
            
            // Восстанавливаем превью изображения из сохранённого DataURL
            imagePreview.src = savedImageDataURL;
            imagePreview.style.display = 'block';
            resultSection.classList.remove('d-none');
            uploadZone.style.display = 'none';
            
            console.log('Загружены сохраненные данные из localStorage');
        } catch (e) {
            console.error('Ошибка загрузки сохраненных данных:', e);
        }
    }

    // Открыть диалог выбора файла
    browseBtn.addEventListener('click', () => imageInput.click());

    // Drag & Drop события
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, () => {
            uploadZone.classList.remove('dragover');
        }, false);
    });

    uploadZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    }

    // Обработка выбора файла
    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Клик по кнопке "Использовать" у недавних изображений
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (target.classList.contains('btn-use-upload')) {
            const filename = target.dataset.filename;
            useExistingUpload(filename);
        }
    });

    // Основная функция обработки изображения
    async function handleImageFile(file) {
        if (!file.type.match('image.*')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        if (file.size > 16 * 1024 * 1024) {
            alert('Файл слишком большой. Максимальный размер: 16MB');
            return;
        }

        currentImageFile = file;
        showLoading(true);

        try {
            // Показываем превью и сохраняем DataURL
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                
                // Сохраняем DataURL для будущего использования
                localStorage.setItem('lastImageDataURL', e.target.result);
            };
            reader.readAsDataURL(file);

            // Формируем FormData и отправляем изображение на сервер
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Ошибка загрузки изображения');

            const data = await response.json();
            
            if (data.success) {
                currentColors = data.palette;
                displayPalette(currentColors);
                showResults();
                
                //  Сохраняем имя файла и палитру в localStorage для восстановления при перезагрузке
                localStorage.setItem('lastImageFilename', data.filename);
                localStorage.setItem('lastPalette', JSON.stringify(currentColors));

                // Мгновенное добавление в блок "Недавние изображения" (если он есть)
                addRecentUploadCard(data.filename);
            } else {
                alert(data.error || 'Ошибка при анализе изображения');
            }
        } catch (error) {
            console.error('Ошибка при загрузке изображения:', error);
            alert('Произошла ошибка при загрузке файла');
        } finally {
            showLoading(false);
        }
    }

    // Использование уже загруженного ранее изображения (из списка "Недавние")
    async function useExistingUpload(filename) {
        if (!filename) return;

        try {
            const response = await fetch(`/static/uploads/${filename}`);
            if (!response.ok) {
                showToast('Не удалось загрузить сохранённое изображение', 'error');
                return;
            }

            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type || 'image/png' });

            await handleImageFile(file);
        } catch (error) {
            console.error('Ошибка при использовании сохранённого изображения:', error);
            showToast('Произошла ошибка при использовании сохранённого изображения', 'error');
        }
    }

    // Добавление карточки в блок "Недавние изображения" без перезагрузки
    function addRecentUploadCard(filename) {
        if (!recentUploadsSection || !recentUploadsRow || !filename) return;

        // Прячем сообщение "пока нет" и показываем грид
        if (recentUploadsEmpty) {
            recentUploadsEmpty.classList.add('d-none');
        }
        recentUploadsRow.classList.remove('d-none');

        // Форматируем время по-русски, как в шаблоне
        const now = new Date();
        const formatted = now.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).replace(',', '');

        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-lg-3';
        col.innerHTML = `
            <div class="card h-100 shadow-sm">
                <div class="ratio ratio-4x3">
                    <img src="/static/uploads/${filename}"
                         class="card-img-top object-fit-cover"
                         alt="Недавнее изображение">
                </div>
                <div class="card-body p-2">
                    <small class="text-muted d-block mb-2">
                        ${formatted}
                    </small>
                    <button type="button"
                            class="btn btn-sm btn-outline-primary w-100 btn-use-upload"
                            data-filename="${filename}">
                        Использовать
                    </button>
                </div>
            </div>
        `;

        // Добавляем новую карточку в начало списка
        if (recentUploadsRow.firstChild) {
            recentUploadsRow.insertBefore(col, recentUploadsRow.firstChild);
        } else {
            recentUploadsRow.appendChild(col);
        }
    }

    function normalizeHexColor(value) {
        if (typeof value !== 'string') return null;
        const sanitized = value.trim().toUpperCase();

        if (/^#[0-9A-F]{6}$/.test(sanitized)) return sanitized;
        if (/^[0-9A-F]{6}$/.test(sanitized)) return `#${sanitized}`;

        if (/^#[0-9A-F]{3}$/.test(sanitized)) {
            return `#${sanitized[1]}${sanitized[1]}${sanitized[2]}${sanitized[2]}${sanitized[3]}${sanitized[3]}`;
        }
        if (/^[0-9A-F]{3}$/.test(sanitized)) {
            return `#${sanitized[0]}${sanitized[0]}${sanitized[1]}${sanitized[1]}${sanitized[2]}${sanitized[2]}`;
        }

        return null;
    }

    // Функция отображения палитры
    function displayPalette(colors) {
        colorPalette.innerHTML = '';

        if (!Array.isArray(colors) || colors.length === 0) {
            currentColors = [];
            localStorage.removeItem('lastPalette');
            return;
        }

        currentColors = colors.map(color => normalizeHexColor(color) || '#000000');

        currentColors.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'palette-edit-item';
            item.innerHTML = `
                <button type="button" class="palette-edit-preview" title="Скопировать HEX"></button>
                <div class="palette-edit-controls">
                    <input type="color" class="palette-edit-picker" value="${color.toLowerCase()}" aria-label="Выбор цвета ${index + 1}">
                    <input type="text" class="palette-edit-hex" value="${color}" maxlength="7" spellcheck="false" aria-label="HEX цвета ${index + 1}">
                </div>
            `;

            const preview = item.querySelector('.palette-edit-preview');
            const picker = item.querySelector('.palette-edit-picker');
            const hexInput = item.querySelector('.palette-edit-hex');

            preview.style.backgroundColor = color;

            const applyColor = (rawValue, showError = false) => {
                const normalized = normalizeHexColor(rawValue);
                if (!normalized) {
                    if (showError) {
                        hexInput.value = currentColors[index];
                        showToast('Введите корректный HEX-код, например #A1B2C3', 'error');
                    }
                    return false;
                }

                currentColors[index] = normalized;
                preview.style.backgroundColor = normalized;
                picker.value = normalized.toLowerCase();
                hexInput.value = normalized;
                localStorage.setItem('lastPalette', JSON.stringify(currentColors));
                return true;
            };

            preview.addEventListener('click', () => copyToClipboard(currentColors[index]));

            picker.addEventListener('input', () => {
                applyColor(picker.value);
            });

            hexInput.addEventListener('input', () => {
                hexInput.value = hexInput.value.toUpperCase();
                const normalized = normalizeHexColor(hexInput.value);
                if (normalized) {
                    applyColor(normalized);
                }
            });

            hexInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    hexInput.blur();
                }
            });

            hexInput.addEventListener('blur', () => {
                applyColor(hexInput.value, true);
            });

            colorPalette.appendChild(item);
        });

        localStorage.setItem('lastPalette', JSON.stringify(currentColors));
    }

    // Функция копирования в буфер обмена
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('HEX код скопирован!');
        } catch (err) {
            console.error('Ошибка копирования:', err);
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('HEX код скопирован!');
        }
    }

    // Показать/скрыть индикатор загрузки
    function showLoading(show) {
        if (show) {
            loadingIndicator.classList.remove('d-none');
            uploadZone.style.opacity = '0.5';
        } else {
            loadingIndicator.classList.add('d-none');
            uploadZone.style.opacity = '1';
        }
    }

    // Показать результаты
    function showResults() {
        resultSection.classList.remove('d-none');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Пересчитать палитру - исправленная версия
    reanalyzeBtn.addEventListener('click', async function(e) {
        e.stopPropagation();
        
        console.log('Попытка пересчёта палитры. currentImageFile:', currentImageFile);
        
        // Проверяем есть ли изображение для пересчета
        const savedImageDataURL = localStorage.getItem('lastImageDataURL');
        if (!currentImageFile && !savedImageDataURL) {
            showToast('Сначала загрузите изображение!', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            let formData = new FormData();
            formData.append('color_count', colorCountSelect.value);
            
            // Если есть объект File (новая загрузка)
            if (currentImageFile) {
                formData.append('image', currentImageFile);
                console.log('Для пересчёта используется исходный File-объект');
            } 
            // Если есть только DataURL (после перезагрузки страницы)
            else if (savedImageDataURL) {
                // Конвертируем сохранённый DataURL обратно в Blob
                const blob = dataURLToBlob(savedImageDataURL);
                formData.append('image', blob, 'image.png');
                console.log('Для пересчёта используется DataURL из localStorage');
            }
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentColors = data.palette;
                displayPalette(currentColors);
                localStorage.setItem('lastPalette', JSON.stringify(currentColors));
                showToast('Палитра пересчитана!');
            } else {
                showToast('Ошибка при пересчете палитры', 'error');
            }
        } catch (error) {
            console.error('Ошибка при пересчёте палитры:', error);
            showToast('Произошла ошибка при пересчете', 'error');
        } finally {
            showLoading(false);
        }
    });

    // Кнопка "Загрузить новое" - добавьте этот код
    if (newImageBtn) {
        newImageBtn.addEventListener('click', function() {
            // Сбросить состояние
            currentImageFile = null;
            currentColors = [];
            
            // Показать зону загрузки
            uploadZone.style.display = 'block';
            
            // Скрыть результаты
            resultSection.classList.add('d-none');
            
            // Очистить превью
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            
            // Очистить палитру
            colorPalette.innerHTML = '';
            
            // Очистить localStorage
            localStorage.removeItem('lastImageFilename');
            localStorage.removeItem('lastPalette');
            localStorage.removeItem('lastImageDataURL');
            
            // Прокрутить к началу
            uploadZone.scrollIntoView({ behavior: 'smooth' });
            
            showToast('Готово для новой загрузки!');
        });
    }

    // Сохранение палитры
    if (savePaletteBtn) {
        savePaletteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            if (currentColors.length === 0) {
                showToast('Сначала создайте палитру!', 'error');
                return;
            }
            
            // Заполняем модальное окно
            const modalPalette = document.getElementById('modalPalette');
            if (modalPalette) {
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
                
                // Сбросим значение названия палитры
                const paletteNameInput = document.getElementById('paletteName');
                if (paletteNameInput) {
                    paletteNameInput.value = '';
                }
            }
        });
    }

    // Подтверждение сохранения палитры
    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', async function() {
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
                    
                    let errorMessage = 'Ошибка при сохранении';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (e) {}
                    
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
    }

    // Экспорт палитры
    exportOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (currentColors.length === 0) {
                showToast('Сначала создайте палитру!', 'error');
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

    // Вспомогательная функция для уведомлений
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `position-fixed bottom-0 end-0 m-3 p-3 ${type === 'error' ? 'bg-danger' : 'bg-success'} text-white rounded shadow`;
        toast.style.zIndex = '1060';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 2000);
    }
});
