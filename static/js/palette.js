document.addEventListener('DOMContentLoaded', function() {
    const uploadZone = document.getElementById('uploadZone');
    const imageInput = document.getElementById('imageInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadForm = document.getElementById('uploadForm');
    const resultSection = document.getElementById('resultSection');
    const imagePreview = document.getElementById('imagePreview');
    const imageStage = document.getElementById('imageStage');
    const markerLayer = document.getElementById('markerLayer');
    const activeLoupe = document.getElementById('activeLoupe');
    const activeLoupeCanvas = document.getElementById('activeLoupeCanvas');
    const activeLoupeHex = document.getElementById('activeLoupeHex');
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
    let paletteControls = [];
    let markerPositions = [];
    let markerElements = [];
    let activeMarkerIndex = -1;
    let draggingMarkerIndex = -1;
    let draggingPointerId = null;

    const sampleCanvas = document.createElement('canvas');
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const loupeCtx = activeLoupeCanvas ? activeLoupeCanvas.getContext('2d') : null;
    if (loupeCtx) {
        loupeCtx.imageSmoothingEnabled = false;
    }

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

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function rgbToHex(r, g, b) {
        return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }

    function buildDefaultMarkerPositions(count) {
        if (count <= 0) return [];

        if (count === 1) {
            return [{ x: 0.5, y: 0.5 }];
        }

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const points = [];

        for (let i = 0; i < count; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            points.push({
                x: (col + 0.5) / cols,
                y: (row + 0.5) / rows,
            });
        }

        return points;
    }

    function rebuildSampleCanvas() {
        if (!imagePreview || !sampleCtx || !imagePreview.naturalWidth || !imagePreview.naturalHeight) {
            return false;
        }

        sampleCanvas.width = imagePreview.naturalWidth;
        sampleCanvas.height = imagePreview.naturalHeight;
        sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
        sampleCtx.drawImage(imagePreview, 0, 0, sampleCanvas.width, sampleCanvas.height);
        return true;
    }

    function sampleHexAtNormalized(normX, normY) {
        if (!sampleCanvas.width || !sampleCanvas.height) {
            if (!rebuildSampleCanvas()) return null;
        }

        const x = Math.round(clamp(normX, 0, 1) * (sampleCanvas.width - 1));
        const y = Math.round(clamp(normY, 0, 1) * (sampleCanvas.height - 1));
        const pixel = sampleCtx.getImageData(x, y, 1, 1).data;

        return rgbToHex(pixel[0], pixel[1], pixel[2]);
    }

    function hideActiveLoupe() {
        if (activeLoupe) {
            activeLoupe.classList.add('d-none');
        }
    }

    function drawLoupe(normX, normY) {
        if (!loupeCtx || !activeLoupeCanvas) return;
        if (!sampleCanvas.width || !sampleCanvas.height) {
            if (!rebuildSampleCanvas()) return;
        }

        const sourceRadius = 6;
        const centerX = Math.round(clamp(normX, 0, 1) * (sampleCanvas.width - 1));
        const centerY = Math.round(clamp(normY, 0, 1) * (sampleCanvas.height - 1));
        const srcX = clamp(centerX - sourceRadius, 0, sampleCanvas.width - 1);
        const srcY = clamp(centerY - sourceRadius, 0, sampleCanvas.height - 1);
        const srcWidth = Math.min(sourceRadius * 2 + 1, sampleCanvas.width - srcX);
        const srcHeight = Math.min(sourceRadius * 2 + 1, sampleCanvas.height - srcY);

        loupeCtx.clearRect(0, 0, activeLoupeCanvas.width, activeLoupeCanvas.height);
        loupeCtx.imageSmoothingEnabled = false;
        loupeCtx.drawImage(
            sampleCanvas,
            srcX, srcY, srcWidth, srcHeight,
            0, 0, activeLoupeCanvas.width, activeLoupeCanvas.height
        );

        const center = activeLoupeCanvas.width / 2;
        loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        loupeCtx.lineWidth = 1.5;
        loupeCtx.beginPath();
        loupeCtx.moveTo(center - 10, center);
        loupeCtx.lineTo(center + 10, center);
        loupeCtx.moveTo(center, center - 10);
        loupeCtx.lineTo(center, center + 10);
        loupeCtx.stroke();
    }

    function updateActiveLoupe() {
        if (
            !activeLoupe ||
            !imageStage ||
            activeMarkerIndex < 0 ||
            !markerPositions[activeMarkerIndex] ||
            imagePreview.style.display === 'none'
        ) {
            hideActiveLoupe();
            return;
        }

        const markerPosition = markerPositions[activeMarkerIndex];
        const stageRect = imageStage.getBoundingClientRect();
        const imageRect = imagePreview.getBoundingClientRect();

        if (!stageRect.width || !imageRect.width || !imageRect.height) {
            hideActiveLoupe();
            return;
        }

        drawLoupe(markerPosition.x, markerPosition.y);

        const markerX = (imageRect.left - stageRect.left) + markerPosition.x * imageRect.width;
        const markerY = (imageRect.top - stageRect.top) + markerPosition.y * imageRect.height;

        const loupeWidth = activeLoupe.offsetWidth || 116;
        const loupeHeight = activeLoupe.offsetHeight || 132;
        let loupeLeft = markerX + 18;
        let loupeTop = markerY - loupeHeight - 12;

        if (loupeLeft + loupeWidth > stageRect.width) {
            loupeLeft = stageRect.width - loupeWidth - 6;
        }
        if (loupeLeft < 6) {
            loupeLeft = 6;
        }
        if (loupeTop < 6) {
            loupeTop = markerY + 18;
        }
        if (loupeTop + loupeHeight > stageRect.height - 4) {
            loupeTop = stageRect.height - loupeHeight - 4;
        }

        activeLoupe.style.left = `${loupeLeft}px`;
        activeLoupe.style.top = `${loupeTop}px`;
        activeLoupe.classList.remove('d-none');

        if (activeLoupeHex) {
            activeLoupeHex.textContent = currentColors[activeMarkerIndex] || '#000000';
        }
    }

    function setActiveMarker(index) {
        if (!Array.isArray(markerElements) || markerElements.length === 0) return;

        activeMarkerIndex = index;
        markerElements.forEach((markerElement, markerIndex) => {
            markerElement.classList.toggle('active', markerIndex === activeMarkerIndex);
        });
        updateActiveLoupe();
    }

    function clearMarkers() {
        window.removeEventListener('pointermove', handleMarkerPointerMove);
        window.removeEventListener('pointerup', handleMarkerPointerUp);
        window.removeEventListener('pointercancel', handleMarkerPointerUp);

        markerPositions = [];
        markerElements = [];
        activeMarkerIndex = -1;
        draggingMarkerIndex = -1;
        draggingPointerId = null;

        if (markerLayer) {
            markerLayer.innerHTML = '';
        }

        hideActiveLoupe();
    }

    function setColorAtIndex(index, rawValue, options = {}) {
        const normalized = normalizeHexColor(rawValue);
        const showError = !!options.showError;

        if (!normalized || index < 0 || index >= currentColors.length) {
            if (showError && paletteControls[index]?.hexInput) {
                paletteControls[index].hexInput.value = currentColors[index] || '#000000';
                showToast('Введите корректный HEX-код, например #A1B2C3', 'error');
            }
            return false;
        }

        currentColors[index] = normalized;

        const controls = paletteControls[index];
        if (controls) {
            controls.preview.style.backgroundColor = normalized;
            controls.picker.value = normalized.toLowerCase();
            controls.hexInput.value = normalized;
        }

        const markerElement = markerElements[index];
        if (markerElement) {
            markerElement.style.backgroundColor = normalized;
        }

        localStorage.setItem('lastPalette', JSON.stringify(currentColors));

        if (activeMarkerIndex === index) {
            updateActiveLoupe();
        }

        return true;
    }

    function moveMarkerFromClient(index, clientX, clientY, sampleColor = true) {
        if (!imagePreview || !markerPositions[index]) return;

        const imageRect = imagePreview.getBoundingClientRect();
        if (!imageRect.width || !imageRect.height) return;

        const normX = clamp((clientX - imageRect.left) / imageRect.width, 0, 1);
        const normY = clamp((clientY - imageRect.top) / imageRect.height, 0, 1);
        markerPositions[index] = { x: normX, y: normY };

        const markerElement = markerElements[index];
        if (markerElement) {
            markerElement.style.left = `${normX * 100}%`;
            markerElement.style.top = `${normY * 100}%`;
        }

        if (sampleColor) {
            const sampledHex = sampleHexAtNormalized(normX, normY);
            if (sampledHex) {
                setColorAtIndex(index, sampledHex);
            }
        }

        setActiveMarker(index);
    }

    function handleMarkerPointerMove(event) {
        if (event.pointerId !== draggingPointerId || draggingMarkerIndex < 0) return;
        moveMarkerFromClient(draggingMarkerIndex, event.clientX, event.clientY, true);
    }

    function handleMarkerPointerUp(event) {
        if (event.pointerId !== draggingPointerId) return;

        if (draggingMarkerIndex >= 0 && markerElements[draggingMarkerIndex]) {
            markerElements[draggingMarkerIndex].classList.remove('dragging');
        }

        draggingMarkerIndex = -1;
        draggingPointerId = null;

        window.removeEventListener('pointermove', handleMarkerPointerMove);
        window.removeEventListener('pointerup', handleMarkerPointerUp);
        window.removeEventListener('pointercancel', handleMarkerPointerUp);
    }

    function renderMarkers() {
        if (!markerLayer) return;

        markerLayer.innerHTML = '';
        markerElements = [];

        markerPositions.forEach((position, index) => {
            const markerButton = document.createElement('button');
            markerButton.type = 'button';
            markerButton.className = 'palette-marker';
            markerButton.style.left = `${position.x * 100}%`;
            markerButton.style.top = `${position.y * 100}%`;
            markerButton.style.backgroundColor = currentColors[index] || '#000000';
            markerButton.setAttribute('aria-label', `Маркер цвета ${index + 1}`);

            markerButton.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;

                event.preventDefault();
                draggingMarkerIndex = index;
                draggingPointerId = event.pointerId;
                markerButton.classList.add('dragging');

                rebuildSampleCanvas();
                moveMarkerFromClient(index, event.clientX, event.clientY, true);

                window.addEventListener('pointermove', handleMarkerPointerMove);
                window.addEventListener('pointerup', handleMarkerPointerUp);
                window.addEventListener('pointercancel', handleMarkerPointerUp);
            });

            markerButton.addEventListener('click', (event) => {
                event.preventDefault();
                setActiveMarker(index);
            });

            markerLayer.appendChild(markerButton);
            markerElements.push(markerButton);
        });

        if (markerElements.length > 0) {
            setActiveMarker(activeMarkerIndex >= 0 ? activeMarkerIndex : 0);
        } else {
            hideActiveLoupe();
        }
    }

    function resetMarkersForPalette(forceReset = false) {
        if (!Array.isArray(currentColors) || currentColors.length === 0) {
            clearMarkers();
            return;
        }

        if (forceReset || markerPositions.length !== currentColors.length) {
            markerPositions = buildDefaultMarkerPositions(currentColors.length);
            activeMarkerIndex = markerPositions.length ? 0 : -1;
        }

        renderMarkers();
        updateActiveLoupe();
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

    imagePreview.addEventListener('load', () => {
        rebuildSampleCanvas();
        resetMarkersForPalette(false);
    });

    window.addEventListener('resize', () => {
        updateActiveLoupe();
    });

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
        clearMarkers();
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
        paletteControls = [];

        if (!Array.isArray(colors) || colors.length === 0) {
            currentColors = [];
            localStorage.removeItem('lastPalette');
            clearMarkers();
            return;
        }

        currentColors = colors.map(color => normalizeHexColor(color) || '#000000');
        resetMarkersForPalette(true);

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
            paletteControls[index] = { preview, picker, hexInput };
            setColorAtIndex(index, color);

            preview.addEventListener('click', () => copyToClipboard(currentColors[index]));

            picker.addEventListener('input', () => {
                setColorAtIndex(index, picker.value);
            });

            hexInput.addEventListener('input', () => {
                hexInput.value = hexInput.value.toUpperCase();
                const normalized = normalizeHexColor(hexInput.value);
                if (normalized) {
                    setColorAtIndex(index, normalized);
                }
            });

            hexInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    hexInput.blur();
                }
            });

            hexInput.addEventListener('blur', () => {
                setColorAtIndex(index, hexInput.value, { showError: true });
            });

            colorPalette.appendChild(item);
        });

        localStorage.setItem('lastPalette', JSON.stringify(currentColors));
        updateActiveLoupe();
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
            paletteControls = [];
            clearMarkers();
            
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
