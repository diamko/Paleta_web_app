/*
 * Модуль: `static/js/myPalet/palette-editor.js`.
 * Назначение: Редактирование цветов сохранённых палитр.
 */

import { withCsrfHeaders } from '../security/csrf.js';

const t = window.t || ((key, fallback) => fallback || key);
const currentLang = window.currentLang || 'en';

const MIN_COLORS = 3;
const MAX_COLORS = 15;

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16),
    };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
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
        b: Math.round((b1 + m) * 255),
    };
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
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

export function createPaletteEditor({ showToast }) {
    const editColors = {};

    function renderColors(paletteId) {
        const section = document.getElementById(`editor-${paletteId}`);
        if (!section) return;
        const container = section.querySelector('.palette-editor-colors');
        if (!container) return;
        container.innerHTML = '';

        const colors = editColors[paletteId] || [];
        colors.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'd-flex align-items-center gap-1 mb-1';
            item.innerHTML = `
                <input type="color" class="form-control form-control-color p-0 border-0" value="${color.toLowerCase()}" style="width:32px;height:32px;">
                <input type="text" class="form-control form-control-sm flex-grow-1 font-monospace" value="${color}" maxlength="7" spellcheck="false">
                <button class="btn btn-sm btn-outline-danger btn-remove-color" data-palette-id="${paletteId}" data-index="${index}" title="${t('remove', 'Удалить')}">
                    <i class="fas fa-times"></i>
                </button>
            `;

            const picker = item.querySelector('input[type="color"]');
            const hex = item.querySelector('input[type="text"]');

            picker.addEventListener('input', () => {
                const val = picker.value.toUpperCase();
                editColors[paletteId][index] = val;
                hex.value = val;
            });

            hex.addEventListener('blur', () => {
                const val = hex.value.trim().toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(val)) {
                    editColors[paletteId][index] = val;
                    picker.value = val.toLowerCase();
                } else {
                    hex.value = editColors[paletteId][index];
                }
            });

            hex.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); hex.blur(); }
            });

            container.appendChild(item);
        });
    }

    function openEditor(paletteId) {
        const card = document.querySelector(`.palette-card[data-palette-id="${paletteId}"]`);
        if (!card) return;

        try {
            editColors[paletteId] = JSON.parse(card.dataset.paletteColors || '[]');
        } catch (_e) {
            editColors[paletteId] = [];
        }

        const section = document.getElementById(`editor-${paletteId}`);
        if (section) {
            const nameInput = section.querySelector('.palette-editor-name');
            if (nameInput) {
                nameInput.value = card.dataset.paletteName || '';
            }
            section.classList.remove('d-none');
            renderColors(paletteId);
        }
    }

    function closeEditor(paletteId) {
        const section = document.getElementById(`editor-${paletteId}`);
        if (section) section.classList.add('d-none');
        delete editColors[paletteId];
    }

    function addColor(paletteId) {
        const colors = editColors[paletteId];
        if (!colors) return;
        if (colors.length >= MAX_COLORS) {
            showToast(t('max_colors_reached', 'Максимум 15 цветов'), 'error');
            return;
        }
        colors.push('#808080');
        renderColors(paletteId);
    }

    function removeColor(paletteId, index) {
        const colors = editColors[paletteId];
        if (!colors) return;
        if (colors.length <= MIN_COLORS) {
            showToast(t('min_colors_reached', 'Минимум 3 цвета'), 'error');
            return;
        }
        colors.splice(index, 1);
        renderColors(paletteId);
    }

    function applyGradient(paletteId) {
        const colors = editColors[paletteId];
        if (!colors || colors.length < 2) return;
        editColors[paletteId] = generateGradient(colors);
        renderColors(paletteId);
    }

    async function saveColors(paletteId) {
        const colors = editColors[paletteId];
        if (!colors || colors.length < MIN_COLORS) return;

        const section = document.getElementById(`editor-${paletteId}`);
        const nameInput = section?.querySelector('.palette-editor-name');
        const newName = (nameInput?.value || '').trim();

        if (!newName) {
            showToast(t('rename_empty', 'Название палитры не может быть пустым.'), 'error');
            return;
        }

        try {
            const response = await fetch(`/api/palettes/update/${paletteId}`, {
                method: 'POST',
                headers: withCsrfHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ colors, name: newName }),
            });

            if (!response.ok) {
                if (response.status === 401) {
                    showToast(t('session_expired_login', 'Сессия истекла. Пожалуйста, войдите снова.'), 'error');
                    window.location.href = `/${currentLang}/login`;
                    return;
                }
                const data = await response.json().catch(() => ({}));
                showToast(data.error || t('update_error', 'Ошибка при обновлении палитры'), 'error');
                return;
            }

            const data = await response.json();
            if (data.success) {
                showToast(t('colors_updated', 'Цвета палитры обновлены!'));
                const card = document.querySelector(`.palette-card[data-palette-id="${paletteId}"]`);
                if (card) {
                    card.dataset.paletteColors = JSON.stringify(colors);
                    card.dataset.colorCount = String(colors.length);
                    card.dataset.paletteName = newName;
                    card.dataset.name = newName.toLowerCase();
                    const titleEl = card.querySelector('.card-title');
                    if (titleEl) titleEl.textContent = newName;
                    const deleteBtn = card.querySelector('.btn-delete-palette');
                    if (deleteBtn) deleteBtn.dataset.paletteName = newName;
                    const swatchContainer = card.querySelector('.d-flex.flex-wrap.gap-1.mb-3');
                    if (swatchContainer) {
                        swatchContainer.innerHTML = colors.map(c =>
                            `<div class="color-swatch-small" style="background-color: ${c}; width: 25px; height: 25px; border-radius: 3px;"></div>`
                        ).join('');
                    }
                }
                closeEditor(paletteId);
            } else {
                showToast(data.error || t('update_error', 'Ошибка при обновлении палитры'), 'error');
            }
        } catch (error) {
            console.error('Update palette colors error:', error);
            showToast(t('update_error', 'Ошибка при обновлении палитры'), 'error');
        }
    }

    return { openEditor, closeEditor, addColor, removeColor, applyGradient, saveColors };
}
