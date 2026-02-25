/*
 * Модуль: `static/js/randomPalette.js`.
 * Назначение: Логика генерации случайной палитры и работы с её действиями.
 */

const t = window.t || ((key, fallback) => fallback || key);
const currentLang = window.currentLang || 'en';

document.addEventListener('DOMContentLoaded', function() {
    const generateBtn = document.getElementById('generateBtn');
    const colorPalette = document.getElementById('colorPalette');
    const colorCountSelect = document.getElementById('colorCount');
    const colorSchemeSelect = document.getElementById('harmonyType');
    const savePaletteBtn = document.getElementById('savePaletteBtn');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const exportOptions = document.querySelectorAll('.export-option');

    let currentColors = [];
    const SCHEME_REQUIRED_COUNTS = {
        triad: 3,
        tetrad: 4,
    };

    function getSchemeDisplayName(scheme) {
        const names = {
            free: t('scheme_free', 'Произвольная'),
            monochromatic: t('scheme_monochromatic', 'Монохромная'),
            complementary: t('scheme_complementary', 'Комплементарная'),
            analogous: t('scheme_analogous', 'Аналоговая'),
            analog_complementary: t('scheme_analog_complementary', 'Аналогово-комплементарная'),
            split_complementary: t('scheme_split_complementary', 'Раздельно-комплементарная'),
            triad: t('scheme_triad', 'Триада'),
            tetrad: t('scheme_tetrad', 'Тетрада'),
        };
        return names[scheme] || scheme;
    }

    function getCsrfToken() {
        const tokenElement = document.querySelector('meta[name="csrf-token"]');
        return tokenElement ? tokenElement.getAttribute('content') || '' : '';
    }

    function withCsrfHeaders(headers = {}) {
        const csrfToken = getCsrfToken();
        if (!csrfToken) return { ...headers };
        return {
            ...headers,
            'X-CSRF-Token': csrfToken,
        };
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function normalizeHue(hue) {
        const normalized = hue % 360;
        return normalized < 0 ? normalized + 360 : normalized;
    }

    function hslToRgb(h, s, l) {
        const hue = normalizeHue(h);
        const saturation = clamp(s, 0, 100) / 100;
        const lightness = clamp(l, 0, 100) / 100;

        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
        const huePrime = hue / 60;
        const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));

        let redPrime = 0;
        let greenPrime = 0;
        let bluePrime = 0;

        if (huePrime >= 0 && huePrime < 1) {
            redPrime = chroma;
            greenPrime = secondComponent;
        } else if (huePrime < 2) {
            redPrime = secondComponent;
            greenPrime = chroma;
        } else if (huePrime < 3) {
            greenPrime = chroma;
            bluePrime = secondComponent;
        } else if (huePrime < 4) {
            greenPrime = secondComponent;
            bluePrime = chroma;
        } else if (huePrime < 5) {
            redPrime = secondComponent;
            bluePrime = chroma;
        } else {
            redPrime = chroma;
            bluePrime = secondComponent;
        }

        const match = lightness - chroma / 2;
        return {
            r: Math.round((redPrime + match) * 255),
            g: Math.round((greenPrime + match) * 255),
            b: Math.round((bluePrime + match) * 255),
        };
    }

    function rgbToHex(r, g, b) {
        return `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }

    function hslToHex(h, s, l) {
        const rgb = hslToRgb(h, s, l);
        return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    function ensureUniqueColor(candidate, usedColors, fallbackFactory) {
        if (!usedColors.has(candidate)) {
            return candidate;
        }

        let alternative = candidate;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            alternative = fallbackFactory(attempt);
            if (!usedColors.has(alternative)) {
                return alternative;
            }
        }
        return alternative;
    }

    function getSchemeAnchors(baseHue, scheme) {
        switch (scheme) {
            case 'complementary':
                return [baseHue, baseHue + 180];
            case 'analogous':
                return [baseHue - 30, baseHue, baseHue + 30];
            case 'analog_complementary':
                return [baseHue - 30, baseHue, baseHue + 30, baseHue + 180];
            case 'split_complementary':
                return [baseHue, baseHue + 150, baseHue + 210];
            case 'triad':
                return [baseHue, baseHue + 120, baseHue + 240];
            case 'tetrad':
                return [baseHue, baseHue + 90, baseHue + 180, baseHue + 270];
            default:
                return [baseHue];
        }
    }

    function generateMonochromaticPalette(count, baseHue) {
        const colors = [];
        const usedColors = new Set();
        const saturationBase = randomInt(45, 75);
        const lightnessFrom = randomInt(24, 36);
        const lightnessTo = randomInt(68, 82);

        for (let i = 0; i < count; i += 1) {
            const position = count > 1 ? i / (count - 1) : 0.5;
            const saturation = clamp(
                saturationBase + Math.round(Math.sin(position * Math.PI) * 12) + randomInt(-6, 6),
                25,
                90
            );
            const lightness = clamp(
                Math.round(lightnessFrom + position * (lightnessTo - lightnessFrom)) + randomInt(-4, 4),
                14,
                90
            );
            const hue = normalizeHue(baseHue + randomInt(-2, 2));
            const color = ensureUniqueColor(
                hslToHex(hue, saturation, lightness),
                usedColors,
                (attempt) => hslToHex(
                    hue + (attempt + 1) * 4,
                    clamp(saturation + randomInt(-8, 8), 20, 92),
                    clamp(lightness + (attempt % 2 === 0 ? 6 : -6), 12, 92)
                )
            );

            usedColors.add(color);
            colors.push(color);
        }

        return colors;
    }

    function generateAnchoredPalette(count, anchors, scheme) {
        const colors = [];
        const usedColors = new Set();
        const jitterByScheme = {
            analogous: 6,
            analog_complementary: 6,
            triad: 2,
            tetrad: 2,
        };
        const jitterRange = jitterByScheme[scheme] ?? 4;

        for (let i = 0; i < count; i += 1) {
            const anchorIndex = i % anchors.length;
            const variationLayer = Math.floor(i / anchors.length);
            const hue = normalizeHue(anchors[anchorIndex] + randomInt(-jitterRange, jitterRange));
            const saturation = clamp(randomInt(58, 85) - variationLayer * 4 + randomInt(-3, 3), 30, 92);
            const direction = (anchorIndex + variationLayer) % 2 === 0 ? 1 : -1;
            const lightness = clamp(
                randomInt(42, 62) + direction * variationLayer * 8 + randomInt(-4, 4),
                18,
                86
            );
            const color = ensureUniqueColor(
                hslToHex(hue, saturation, lightness),
                usedColors,
                (attempt) => hslToHex(
                    hue + (attempt + 1) * 3,
                    clamp(saturation + randomInt(-6, 6), 25, 95),
                    clamp(lightness + (attempt % 2 === 0 ? 7 : -7), 14, 90)
                )
            );

            usedColors.add(color);
            colors.push(color);
        }

        return colors;
    }

    function generateFreePalette(count) {
        const colors = [];
        const usedColors = new Set();

        for (let i = 0; i < count; i += 1) {
            const color = ensureUniqueColor(
                rgbToHex(randomInt(0, 255), randomInt(0, 255), randomInt(0, 255)),
                usedColors,
                () => rgbToHex(randomInt(0, 255), randomInt(0, 255), randomInt(0, 255))
            );

            usedColors.add(color);
            colors.push(color);
        }

        return colors;
    }

    function generatePaletteByScheme(count, scheme) {
        if (scheme === 'free') {
            return generateFreePalette(count);
        }

        const baseHue = randomInt(0, 359);
        if (scheme === 'monochromatic') {
            return generateMonochromaticPalette(count, baseHue);
        }

        const anchors = getSchemeAnchors(baseHue, scheme).map(normalizeHue);
        return generateAnchoredPalette(count, anchors, scheme);
    }

    function isSchemeAllowedForCount(scheme, count) {
        const requiredCount = SCHEME_REQUIRED_COUNTS[scheme];
        return !requiredCount || requiredCount === count;
    }

    function updateSchemeAvailability(showFeedback = false) {
        if (!colorSchemeSelect || !colorCountSelect) {
            return;
        }

        const count = parseInt(colorCountSelect.value, 10);
        const selectedScheme = colorSchemeSelect.value;

        Array.from(colorSchemeSelect.options).forEach((option) => {
            const requiredCount = SCHEME_REQUIRED_COUNTS[option.value];
            option.disabled = !!requiredCount && requiredCount !== count;
        });

        if (!isSchemeAllowedForCount(selectedScheme, count)) {
            const selectedSchemeName = getSchemeDisplayName(selectedScheme);
            colorSchemeSelect.value = 'monochromatic';

            if (showFeedback) {
                showToast(
                    t(
                        'scheme_switched_to_monochromatic',
                        'Схема "{scheme}" недоступна при {count} цветах. Выбрана монохромная.',
                        { scheme: selectedSchemeName, count }
                    ),
                    'error'
                );
            }
        }
    }

    if (colorCountSelect) {
        colorCountSelect.addEventListener('change', () => updateSchemeAvailability(true));
    }
    updateSchemeAvailability(false);

    generateBtn.addEventListener('click', () => {
        const count = parseInt(colorCountSelect.value, 10);
        const selectedScheme = colorSchemeSelect ? colorSchemeSelect.value : 'free';

        if (!isSchemeAllowedForCount(selectedScheme, count)) {
            const schemeName = getSchemeDisplayName(selectedScheme);
            const requiredCount = SCHEME_REQUIRED_COUNTS[selectedScheme] || count;
            showToast(
                t(
                    'scheme_requires_exact_count',
                    'Схема "{scheme}" доступна только при {count} цветах.',
                    { scheme: schemeName, count: requiredCount }
                ),
                'error'
            );
            updateSchemeAvailability(false);
            return;
        }

        currentColors = generatePaletteByScheme(count, selectedScheme);
        displayPalette(currentColors);
    });

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

    function showToast(message, type = 'success') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `position-fixed bottom-0 end-0 m-3 p-3 ${type === 'error' ? 'bg-danger' : 'bg-success'} text-white rounded shadow`;
        toast.style.zIndex = '1060';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 2000);
    }

    function displayPalette(colors) {
        colorPalette.innerHTML = '';

        if (!Array.isArray(colors) || colors.length === 0) {
            currentColors = [];
            return;
        }

        currentColors = colors.map(color => normalizeHexColor(color) || '#000000');

        currentColors.forEach((color, index) => {
            const item = document.createElement('div');
            item.className = 'palette-edit-item';
            item.innerHTML = `
                <button type="button" class="palette-edit-preview" title="${t('copy_hex_title', 'Скопировать HEX')}"></button>
                <div class="palette-edit-controls">
                    <input type="color" class="palette-edit-picker" value="${color.toLowerCase()}" aria-label="${t('color_picker_label', 'Выбор цвета {index}', { index: index + 1 })}">
                    <input type="text" class="palette-edit-hex" value="${color}" maxlength="7" spellcheck="false" aria-label="${t('color_hex_label', 'HEX цвета {index}', { index: index + 1 })}">
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
                        showToast(t('hex_validation_error', 'Введите корректный HEX-код, например #A1B2C3'), 'error');
                    }
                    return false;
                }

                currentColors[index] = normalized;
                preview.style.backgroundColor = normalized;
                picker.value = normalized.toLowerCase();
                hexInput.value = normalized;
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

        const actionsSection = document.getElementById('actionsSection');
        if (actionsSection) {
            actionsSection.classList.remove('d-none');
        }
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast(t('hex_copied', 'HEX код скопирован!'));
        } catch (err) {
            console.error(t('copy_error', 'Ошибка копирования:'), err);
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast(t('hex_copied', 'HEX код скопирован!'));
        }
    }

    if (savePaletteBtn) {
        savePaletteBtn.addEventListener('click', () => {
            if (currentColors.length === 0) {
                showToast(t('generate_palette_first', 'Сначала сгенерируйте палитру!'), 'error');
                return;
            }

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
            }

            const paletteNameInput = document.getElementById('paletteName');
            if (paletteNameInput) {
                paletteNameInput.value = '';
            }
        });
    }

    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', async () => {
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
                        colors: currentColors,
                        lang: currentLang,
                    })
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
                    } catch (_e) {
                        // Ignore parse errors.
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
                console.error('Random palette save error:', error);
                showToast(t('save_palette_error', 'Ошибка при сохранении палитры'), 'error');
            }
        });
    }

    exportOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
            e.preventDefault();

            if (currentColors.length === 0) {
                showToast(t('generate_palette_first', 'Сначала сгенерируйте палитру!'), 'error');
                return;
            }

            const format = e.target.dataset.format;

            try {
                const response = await fetch(`/api/export?format=${format}`, {
                    method: 'POST',
                    headers: withCsrfHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ colors: currentColors })
                });

                if (!response.ok) {
                    let errorMessage = t('export_error', 'Ошибка при экспорте');
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                    } catch (_error) {
                        // Ignore parse errors.
                    }
                    showToast(errorMessage, 'error');
                    return;
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `palette.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Random palette export error:', error);
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
            }
        });
    });
});
