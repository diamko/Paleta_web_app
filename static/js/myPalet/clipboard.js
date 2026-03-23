/*
 * Модуль: `static/js/myPalet/clipboard.js`.
 * Назначение: Модуль клиентской логики раздела «Мои палитры».
 */

const t = window.t || ((key, fallback) => fallback || key);

/**
 * Выполняет операцию `copyPalette` для соответствующего сценария интерфейса.
 */
export function copyPalette(colors, showToast, single = false) {
    const text = single ? colors : colors.split(' ').join('\n');
    const message = single
        ? t('hex_copied', 'HEX код скопирован!')
        : t('colors_copied', 'Цвета скопированы в буфер обмена!');
    navigator.clipboard.writeText(text).then(() => {
        showToast(message);
    });
}
