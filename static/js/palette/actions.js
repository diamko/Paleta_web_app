/*
 * Модуль: `static/js/palette/actions.js`.
 * Назначение: Модуль клиентской логики страницы извлечения и редактирования палитры.
 */

import { dataURLToBlob, showToast } from './utils.js';
import { withCsrfHeaders } from '../security/csrf.js';

const t = window.t || ((key, fallback) => fallback || key);
const currentLang = window.currentLang || 'en';

/**
 * Выполняет операцию `bindPaletteActions` для соответствующего сценария интерфейса.
 */
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
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

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.min(100, Math.max(0, s)) / 100;
    l = Math.min(100, Math.max(0, l)) / 100;
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
    return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function generateGradient(colors) {
    if (colors.length < 2) return [...colors];
    const first = hexToRgb(colors[0]);
    const last = hexToRgb(colors[colors.length - 1]);
    const fHsl = rgbToHsl(first.r, first.g, first.b);
    const lHsl = rgbToHsl(last.r, last.g, last.b);
    let hueDiff = lHsl.h - fHsl.h;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    return colors.map((_, i) => {
        const p = i / (colors.length - 1);
        const h = ((fHsl.h + hueDiff * p) % 360 + 360) % 360;
        const s = fHsl.s + (lHsl.s - fHsl.s) * p;
        const l = fHsl.l + (lHsl.l - fHsl.l) * p;
        const rgb = hslToRgb(h, s, l);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    });
}

function colorDistance(hex1, hex2) {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function findNewColorFromImage(canvas, existingColors) {
    if (!canvas || !canvas.width) return '#808080';
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width, h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(1, Math.floor(data.length / 4 / 2000)) * 4;
    const freq = {};

    for (let i = 0; i < data.length; i += step) {
        const qr = Math.min(Math.round(data[i] / 32) * 32, 255);
        const qg = Math.min(Math.round(data[i + 1] / 32) * 32, 255);
        const qb = Math.min(Math.round(data[i + 2] / 32) * 32, 255);
        const key = rgbToHex(qr, qg, qb);
        freq[key] = (freq[key] || 0) + 1;
    }

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return '#808080';

    for (const [color] of sorted) {
        if (existingColors.every(c => colorDistance(color, c) > 50)) {
            return color;
        }
    }
    return sorted[0][0];
}

export function bindPaletteActions({ elements, state, paletteView, markerController }) {
    elements.imagePreview.addEventListener('load', () => {
        markerController.rebuildSampleCanvas();
        markerController.resetMarkersForPalette(true);
    });

    window.addEventListener('resize', () => {
        markerController.updateActiveLoupe();
    });

    elements.reanalyzeBtn.addEventListener('click', async (event) => {
        event.stopPropagation();

        const savedImageDataURL = localStorage.getItem('lastImageDataURL');
        if (!state.currentImageFile && !savedImageDataURL) {
            showToast(t('upload_image_first', 'Сначала загрузите изображение!'), 'error');
            return;
        }

        paletteView.showLoading(true);

        try {
            const formData = new FormData();
            formData.append('color_count', elements.colorCountSelect.value);

            if (state.currentImageFile) {
                formData.append('image', state.currentImageFile);
            } else if (savedImageDataURL) {
                const blob = dataURLToBlob(savedImageDataURL);
                formData.append('image', blob, 'image.png');
            }

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: withCsrfHeaders(),
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                state.currentColors = data.palette;
                paletteView.displayPalette(state.currentColors);
                localStorage.setItem('lastPalette', JSON.stringify(state.currentColors));
                showToast(t('palette_recalculated', 'Палитра пересчитана!'));
            } else {
                showToast(data.error || t('palette_recalculate_error', 'Ошибка при пересчете палитры'), 'error');
            }
        } catch (error) {
            console.error('Palette recalculation error:', error);
            showToast(t('palette_recalculate_fail', 'Произошла ошибка при пересчете'), 'error');
        } finally {
            paletteView.showLoading(false);
        }
    });

    if (elements.newImageBtn) {
        elements.newImageBtn.addEventListener('click', () => {
            paletteView.resetForNewUpload();
        });
    }

    if (elements.gradientBtn) {
        elements.gradientBtn.addEventListener('click', () => {
            if (state.currentColors.length < 2) {
                showToast(t('need_two_colors', 'Нужно минимум 2 цвета для градиента'), 'error');
                return;
            }
            state.currentColors = generateGradient(state.currentColors);
            paletteView.displayPalette(state.currentColors);
            localStorage.setItem('lastPalette', JSON.stringify(state.currentColors));
        });
    }

    if (elements.addColorBtn) {
        elements.addColorBtn.addEventListener('click', () => {
            if (state.currentColors.length >= 15) {
                showToast(t('max_colors_reached', 'Максимум 15 цветов'), 'error');
                return;
            }
            const newColor = findNewColorFromImage(markerController.getSampleCanvas(), state.currentColors);
            state.currentColors.push(newColor);
            paletteView.displayPalette(state.currentColors);
            localStorage.setItem('lastPalette', JSON.stringify(state.currentColors));
        });
    }

    if (elements.savePaletteBtn) {
        elements.savePaletteBtn.addEventListener('click', (event) => {
            event.stopPropagation();

            if (state.currentColors.length === 0) {
                showToast(t('create_palette_first', 'Сначала создайте палитру!'), 'error');
                return;
            }

            const modalPalette = document.getElementById('modalPalette');
            if (modalPalette) {
                modalPalette.innerHTML = '';

                state.currentColors.forEach(color => {
                    const colorDiv = document.createElement('div');
                    colorDiv.className = 'color-swatch-small';
                    colorDiv.style.backgroundColor = color;
                    colorDiv.style.width = '30px';
                    colorDiv.style.height = '30px';
                    colorDiv.style.borderRadius = '5px';
                    modalPalette.appendChild(colorDiv);
                });

                const paletteNameInput = document.getElementById('paletteName');
                if (paletteNameInput) {
                    paletteNameInput.value = '';
                }
            }
        });
    }

    if (elements.confirmSaveBtn) {
        elements.confirmSaveBtn.addEventListener('click', async () => {
            const paletteNameInput = document.getElementById('paletteName');
            const originalValue = paletteNameInput?.value || '';
            const paletteName = originalValue.trim();

            if (originalValue && !paletteName) {
                showToast(t('palette_name_spaces', 'Название палитры не может состоять только из пробелов'), 'error');
                return;
            }

            const finalName = paletteName || t('default_palette_name', 'Моя палитра');
            const saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));

            try {
                const response = await fetch('/api/palettes/save', {
                    method: 'POST',
                    headers: withCsrfHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        name: finalName,
                        colors: state.currentColors,
                        lang: currentLang,
                    }),
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        showToast(t('session_expired_login', 'Сессия истекла. Пожалуйста, войдите снова.'), 'error');
                        window.location.href = `/${currentLang}/login`;
                        return;
                    }

                    let errorMessage = t('save_error', 'Ошибка при сохранении');
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (_error) {
                        // Ignore JSON parse errors.
                    }

                    showToast(errorMessage, 'error');
                    return;
                }

                const data = await response.json();

                if (data.success) {
                    showToast(t('palette_saved', 'Палитра сохранена!'));
                    if (saveModal) saveModal.hide();
                } else {
                    showToast(data.error || t('save_error', 'Ошибка при сохранении'), 'error');
                }
            } catch (error) {
                console.error('Palette save error:', error);
                showToast(t('save_palette_error', 'Ошибка при сохранении палитры'), 'error');
            }
        });
    }

    elements.exportOptions.forEach(option => {
        option.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (state.currentColors.length === 0) {
                showToast(t('create_palette_first', 'Сначала создайте палитру!'), 'error');
                return;
            }

            const format = option.dataset.format;
            if (!format) {
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
                return;
            }

            try {
                const response = await fetch(`/api/export?format=${format}`, {
                    method: 'POST',
                    headers: withCsrfHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ colors: state.currentColors }),
                });

                if (!response.ok) {
                    let errorMessage = t('export_error', 'Ошибка при экспорте');
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (_error) {
                        // Ignore JSON parse errors.
                    }
                    showToast(errorMessage, 'error');
                    return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `palette.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                }, 1500);
            } catch (error) {
                console.error('Palette export error:', error);
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
            }
        });
    });
}
