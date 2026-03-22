/*
 * Модуль: `static/js/createPalette.js`.
 * Назначение: Логика ручного создания палитры с цветовым кольцом.
 */

var t = window.t || ((key, fallback) => fallback || key);
const currentLang = window.currentLang || 'en';

document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('colorWheel');
    const ctx = canvas.getContext('2d');
    const wheelCursor = document.getElementById('wheelCursor');
    const lightnessSlider = document.getElementById('lightnessSlider');
    const lightnessValue = document.getElementById('lightnessValue');
    const currentColorBox = document.getElementById('currentColorBox');
    const currentHexInput = document.getElementById('currentHexInput');
    const addColorBtn = document.getElementById('addColorBtn');
    const paletteColors = document.getElementById('paletteColors');
    const colorCountLabel = document.getElementById('colorCountLabel');
    const emptyHint = document.getElementById('emptyHint');
    const actionsSection = document.getElementById('actionsSection');
    const gradientSection = document.getElementById('gradientSection');
    const gradientPreview = document.getElementById('gradientPreview');
    const gradientFillBtn = document.getElementById('gradientFillBtn');
    const gradientSteps = document.getElementById('gradientSteps');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const savePaletteBtn = document.getElementById('savePaletteBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const exportOptions = document.querySelectorAll('.export-option');

    let colors = [];
    let currentHue = 0;
    let currentSat = 100;
    let currentLight = 50;
    let isDraggingWheel = false;

    const MAX_COLORS = 15;
    const MIN_COLORS = 3;

    // --- Color conversion utilities ---

    function clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    }

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        s = clamp(s, 0, 100) / 100;
        l = clamp(l, 0, 100) / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const hp = h / 60;
        const x = c * (1 - Math.abs((hp % 2) - 1));
        let r1 = 0, g1 = 0, b1 = 0;
        if (hp < 1) { r1 = c; g1 = x; }
        else if (hp < 2) { r1 = x; g1 = c; }
        else if (hp < 3) { g1 = c; b1 = x; }
        else if (hp < 4) { g1 = x; b1 = c; }
        else if (hp < 5) { r1 = x; b1 = c; }
        else { r1 = c; b1 = x; }
        const m = l - c / 2;
        return {
            r: Math.round((r1 + m) * 255),
            g: Math.round((g1 + m) * 255),
            b: Math.round((b1 + m) * 255)
        };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    function hslToHex(h, s, l) {
        const rgb = hslToRgb(h, s, l);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function hexToRgb(hex) {
        const h = hex.replace('#', '');
        return {
            r: parseInt(h.substring(0, 2), 16),
            g: parseInt(h.substring(2, 4), 16),
            b: parseInt(h.substring(4, 6), 16)
        };
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function normalizeHexColor(value) {
        if (typeof value !== 'string') return null;
        const s = value.trim().toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(s)) return s;
        if (/^[0-9A-F]{6}$/.test(s)) return '#' + s;
        if (/^#[0-9A-F]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
        if (/^[0-9A-F]{3}$/.test(s)) return '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
        return null;
    }

    // --- Color wheel drawing ---

    function drawColorWheel() {
        const size = canvas.width;
        const center = size / 2;
        const radius = center - 4;
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center;
                const dy = y - center;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idx = (y * size + x) * 4;

                if (dist <= radius) {
                    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                    const sat = (dist / radius) * 100;
                    const rgb = hslToRgb(angle, sat, currentLight);
                    data[idx] = rgb.r;
                    data[idx + 1] = rgb.g;
                    data[idx + 2] = rgb.b;
                    data[idx + 3] = 255;
                } else if (dist <= radius + 2) {
                    data[idx] = 200;
                    data[idx + 1] = 200;
                    data[idx + 2] = 200;
                    data[idx + 3] = Math.round(255 * (1 - (dist - radius) / 2));
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function updateCursorPosition() {
        const size = canvas.width;
        const center = size / 2;
        const radius = center - 4;
        const dist = (currentSat / 100) * radius;
        const rad = currentHue * Math.PI / 180;
        const scaleX = canvas.offsetWidth / size;
        const scaleY = canvas.offsetHeight / size;
        const x = (center + dist * Math.cos(rad)) * scaleX + canvas.offsetLeft;
        const y = (center + dist * Math.sin(rad)) * scaleY + canvas.offsetTop;

        wheelCursor.style.left = x + 'px';
        wheelCursor.style.top = y + 'px';
    }

    function updateCurrentColor() {
        const hex = hslToHex(currentHue, currentSat, currentLight);
        currentColorBox.style.backgroundColor = hex;
        currentHexInput.value = hex;
        updateCursorPosition();
    }

    function pickColorFromWheel(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const size = canvas.width;
        const center = size / 2;
        const radius = center - 4;
        const scaleX = size / rect.width;
        const scaleY = size / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const dx = x - center;
        const dy = y - center;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius + 4) {
            const clampedDist = Math.min(dist, radius);
            currentHue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
            currentSat = Math.round((clampedDist / radius) * 100);
            updateCurrentColor();
        }
    }

    // --- Wheel interaction ---

    canvas.addEventListener('mousedown', function (e) {
        isDraggingWheel = true;
        pickColorFromWheel(e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', function (e) {
        if (isDraggingWheel) {
            pickColorFromWheel(e.clientX, e.clientY);
        }
    });

    document.addEventListener('mouseup', function () {
        isDraggingWheel = false;
    });

    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        isDraggingWheel = true;
        const touch = e.touches[0];
        pickColorFromWheel(touch.clientX, touch.clientY);
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        if (isDraggingWheel) {
            const touch = e.touches[0];
            pickColorFromWheel(touch.clientX, touch.clientY);
        }
    }, { passive: false });

    canvas.addEventListener('touchend', function () {
        isDraggingWheel = false;
    });

    // --- Sliders ---

    lightnessSlider.addEventListener('input', function () {
        currentLight = parseInt(this.value, 10);
        lightnessValue.textContent = currentLight + '%';
        drawColorWheel();
        updateCurrentColor();
    });


    // --- HEX input ---

    currentHexInput.addEventListener('input', function () {
        this.value = this.value.toUpperCase();
        const hex = normalizeHexColor(this.value);
        if (hex) {
            const rgb = hexToRgb(hex);
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            currentHue = hsl.h;
            currentSat = Math.round(hsl.s);
            currentLight = Math.round(hsl.l);
            lightnessSlider.value = currentLight;
            lightnessValue.textContent = currentLight + '%';
            currentColorBox.style.backgroundColor = hex;
            drawColorWheel();
            updateCursorPosition();
        }
    });

    currentHexInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCurrentColor();
        }
    });

    // --- State persistence ---

    function saveState() {
        localStorage.setItem('createPalette_colors', JSON.stringify(colors));
    }

    function restoreState() {
        var saved = localStorage.getItem('createPalette_colors');
        if (!saved) return;
        try {
            var parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(function (c) { return /^#[0-9A-F]{6}$/i.test(c); })) {
                colors = parsed.map(function (c) { return c.toUpperCase(); });
                renderPalette();
                updateGradientPreview();
            }
        } catch (_e) {}
    }

    // --- Palette management ---

    function addCurrentColor() {
        if (colors.length >= MAX_COLORS) {
            showToast(t('max_colors_reached', 'Максимум 15 цветов'), 'error');
            return;
        }
        const hex = normalizeHexColor(currentHexInput.value);
        if (!hex) {
            showToast(t('hex_validation_error', 'Введите корректный HEX-код, например #A1B2C3'), 'error');
            return;
        }
        colors.push(hex);
        renderPalette();
        updateGradientPreview();
    }

    addColorBtn.addEventListener('click', addCurrentColor);

    function removeColor(index) {
        colors.splice(index, 1);
        renderPalette();
        updateGradientPreview();
    }

    function moveColor(fromIndex, toIndex) {
        if (toIndex < 0 || toIndex >= colors.length) return;
        const color = colors.splice(fromIndex, 1)[0];
        colors.splice(toIndex, 0, color);
        renderPalette();
        updateGradientPreview();
    }

    let dragFromIndex = null;

    function renderPalette() {
        paletteColors.innerHTML = '';
        colorCountLabel.textContent = colors.length;

        if (colors.length === 0) {
            emptyHint.classList.remove('d-none');
            actionsSection.classList.add('d-none');
            gradientSection.classList.add('d-none');
            saveState();
            return;
        }

        emptyHint.classList.add('d-none');
        actionsSection.classList.remove('d-none');

        if (colors.length >= 2) {
            gradientSection.classList.remove('d-none');
        } else {
            gradientSection.classList.add('d-none');
        }

        colors.forEach(function (color, index) {
            const item = document.createElement('div');
            item.className = 'palette-build-item';
            item.draggable = true;
            item.dataset.index = index;
            item.innerHTML =
                '<button type="button" class="palette-build-preview" title="' + t('pick_color_title', 'Выбрать цвет') + '"></button>' +
                '<div class="palette-build-controls">' +
                '    <input type="color" class="palette-build-picker" value="' + color.toLowerCase() + '" style="display:none">' +
                '    <button type="button" class="palette-build-copy" title="' + t('copy_hex_title', 'Скопировать HEX') + '"></button>' +
                '    <input type="text" class="palette-build-hex" value="' + color + '" maxlength="7" spellcheck="false">' +
                '</div>' +
                '<div class="palette-build-actions">' +
                '    <button type="button" class="btn-icon move-left" title="' + t('move_left', '←') + '"' +
                (index === 0 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>' +
                '    <button type="button" class="btn-icon move-right" title="' + t('move_right', '→') + '"' +
                (index === colors.length - 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>' +
                '    <button type="button" class="btn-icon remove-color" title="' + t('remove', 'Удалить') + '"><i class="fas fa-times"></i></button>' +
                '</div>';

            item.addEventListener('dragstart', function (e) {
                dragFromIndex = index;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
                dragFromIndex = null;
                paletteColors.querySelectorAll('.drag-over').forEach(function (el) {
                    el.classList.remove('drag-over');
                });
            });

            item.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragFromIndex !== null && dragFromIndex !== index) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', function () {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', function (e) {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (dragFromIndex !== null && dragFromIndex !== index) {
                    moveColor(dragFromIndex, index);
                    dragFromIndex = null;
                }
            });

            const preview = item.querySelector('.palette-build-preview');
            const picker = item.querySelector('.palette-build-picker');
            const copyBtn = item.querySelector('.palette-build-copy');
            const hexInput = item.querySelector('.palette-build-hex');

            preview.style.backgroundColor = color;
            copyBtn.style.backgroundColor = color;

            preview.addEventListener('click', function () {
                picker.click();
            });

            copyBtn.addEventListener('click', function () {
                copyToClipboard(colors[index]);
            });

            picker.addEventListener('input', function () {
                var normalized = normalizeHexColor(picker.value);
                if (normalized) {
                    colors[index] = normalized;
                    preview.style.backgroundColor = normalized;
                    copyBtn.style.backgroundColor = normalized;
                    hexInput.value = normalized;
                    updateGradientPreview();
                }
            });

            hexInput.addEventListener('input', function () {
                hexInput.value = hexInput.value.toUpperCase();
                var normalized = normalizeHexColor(hexInput.value);
                if (normalized) {
                    colors[index] = normalized;
                    preview.style.backgroundColor = normalized;
                    copyBtn.style.backgroundColor = normalized;
                    picker.value = normalized.toLowerCase();
                    updateGradientPreview();
                }
            });

            hexInput.addEventListener('blur', function () {
                var normalized = normalizeHexColor(hexInput.value);
                if (!normalized) {
                    hexInput.value = colors[index];
                    showToast(t('hex_validation_error', 'Введите корректный HEX-код, например #A1B2C3'), 'error');
                }
            });

            hexInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); hexInput.blur(); }
            });

            item.querySelector('.move-left').addEventListener('click', function () {
                moveColor(index, index - 1);
            });

            item.querySelector('.move-right').addEventListener('click', function () {
                moveColor(index, index + 1);
            });

            item.querySelector('.remove-color').addEventListener('click', function () {
                removeColor(index);
            });

            paletteColors.appendChild(item);
        });

        saveState();
    }

    // --- Gradient ---

    function generateGradient(colorArray, steps) {
        if (colorArray.length < 2) return colorArray.slice();
        var first = hexToRgb(colorArray[0]);
        var last = hexToRgb(colorArray[colorArray.length - 1]);
        var firstHsl = rgbToHsl(first.r, first.g, first.b);
        var lastHsl = rgbToHsl(last.r, last.g, last.b);

        var hueDiff = lastHsl.h - firstHsl.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;

        var result = [];
        for (var i = 0; i < steps; i++) {
            var p = i / (steps - 1);
            var h = ((firstHsl.h + hueDiff * p) % 360 + 360) % 360;
            var s = firstHsl.s + (lastHsl.s - firstHsl.s) * p;
            var l = firstHsl.l + (lastHsl.l - firstHsl.l) * p;
            result.push(hslToHex(h, s, l));
        }
        return result;
    }

    function updateGradientPreview() {
        if (colors.length < 2) {
            gradientPreview.style.background = '';
            return;
        }
        gradientPreview.style.background = 'linear-gradient(to right, ' + colors.join(', ') + ')';
    }

    if (gradientFillBtn) {
        gradientFillBtn.addEventListener('click', function () {
            if (colors.length < 2) {
                showToast(t('need_two_colors', 'Нужно минимум 2 цвета для градиента'), 'error');
                return;
            }
            var steps = parseInt(gradientSteps.value, 10);
            colors = generateGradient(colors, steps);
            renderPalette();
            updateGradientPreview();
        });
    }

    // --- Clear all ---

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function () {
            colors = [];
            renderPalette();
            updateGradientPreview();
        });
    }

    // --- Save ---

    function getCsrfToken() {
        var el = document.querySelector('meta[name="csrf-token"]');
        return el ? el.getAttribute('content') || '' : '';
    }

    function withCsrfHeaders(headers) {
        var token = getCsrfToken();
        if (!token) return headers || {};
        var result = Object.assign({}, headers || {});
        result['X-CSRF-Token'] = token;
        return result;
    }

    if (savePaletteBtn) {
        savePaletteBtn.addEventListener('click', function () {
            if (colors.length < MIN_COLORS) {
                showToast(t('min_colors_reached', 'Минимум 3 цвета'), 'error');
                return;
            }
            var modalPalette = document.getElementById('modalPalette');
            if (modalPalette) {
                modalPalette.innerHTML = '';
                colors.forEach(function (color) {
                    var div = document.createElement('div');
                    div.className = 'color-swatch-small';
                    div.style.backgroundColor = color;
                    div.style.width = '30px';
                    div.style.height = '30px';
                    div.style.borderRadius = '5px';
                    modalPalette.appendChild(div);
                });
            }
            var nameInput = document.getElementById('paletteName');
            if (nameInput) nameInput.value = '';
        });
    }

    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', async function () {
            var nameInput = document.getElementById('paletteName');
            var originalValue = nameInput ? nameInput.value : '';
            var paletteName = originalValue.trim();

            if (originalValue && !paletteName) {
                showToast(t('palette_name_spaces', 'Название палитры не может состоять только из пробелов'), 'error');
                return;
            }

            var finalName = paletteName || t('default_palette_name', 'Моя палитра');
            var saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));

            try {
                var response = await fetch('/api/palettes/save', {
                    method: 'POST',
                    headers: withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        name: finalName,
                        colors: colors,
                        lang: currentLang
                    })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        showToast(t('session_expired_login', 'Сессия истекла. Пожалуйста, войдите снова.'), 'error');
                        window.location.href = '/' + currentLang + '/login';
                        return;
                    }
                    var errorMsg = t('save_error', 'Ошибка при сохранении');
                    try {
                        var errData = await response.json();
                        errorMsg = errData.error || errorMsg;
                    } catch (_e) {}
                    showToast(errorMsg, 'error');
                    return;
                }

                var data = await response.json();
                if (data.success) {
                    showToast(t('palette_saved', 'Палитра сохранена!'));
                    localStorage.removeItem('createPalette_colors');
                    if (saveModal) saveModal.hide();
                } else {
                    showToast(data.error || t('save_error', 'Ошибка при сохранении'), 'error');
                }
            } catch (error) {
                console.error('Create palette save error:', error);
                showToast(t('save_palette_error', 'Ошибка при сохранении палитры'), 'error');
            }
        });
    }

    // --- Export ---

    exportOptions.forEach(function (option) {
        option.addEventListener('click', async function (e) {
            e.preventDefault();
            if (colors.length < MIN_COLORS) {
                showToast(t('min_colors_reached', 'Минимум 3 цвета'), 'error');
                return;
            }

            var format = option.dataset.format;
            if (!format) {
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
                return;
            }

            try {
                var response = await fetch('/api/export?format=' + format, {
                    method: 'POST',
                    headers: withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ colors: colors })
                });

                if (!response.ok) {
                    var errMsg = t('export_error', 'Ошибка при экспорте');
                    try {
                        var errData = await response.json();
                        errMsg = errData.error || errMsg;
                    } catch (_e) {}
                    showToast(errMsg, 'error');
                    return;
                }

                var blob = await response.blob();
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'palette.' + format;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { window.URL.revokeObjectURL(url); }, 1500);
            } catch (error) {
                console.error('Create palette export error:', error);
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
            }
        });
    });

    // --- Toast ---

    function showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        var toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 p-3 ' +
            (type === 'error' ? 'bg-danger' : 'bg-success') + ' text-white rounded shadow';
        toast.style.zIndex = '1060';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 2000);
    }

    // --- Clipboard ---

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(t('hex_copied', 'HEX код скопирован!'));
        } catch (err) {
            var ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(t('hex_copied', 'HEX код скопирован!'));
        }
    }

    // --- Init ---

    drawColorWheel();
    updateCurrentColor();
    restoreState();
});
