/*
 * Модуль: `static/js/myPalet/clipboard.js`.
 * Назначение: Модуль клиентской логики раздела «Мои палитры».
 */

const t = window.t || ((key, fallback) => fallback || key);

/**
 * Выполняет операцию `copyPalette` для соответствующего сценария интерфейса.
 */
export function copyPalette(colors, showToast) {
    const colorArray = colors.split(' ');
    navigator.clipboard.writeText(colorArray.join('\n')).then(() => {
        showToast(t('colors_copied', 'Цвета скопированы в буфер обмена!'));
    });
}
