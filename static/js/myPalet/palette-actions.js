/*
 * Модуль: `static/js/myPalet/palette-actions.js`.
 * Назначение: Модуль клиентской логики раздела «Мои палитры».
 */

import { withCsrfHeaders } from '../security/csrf.js';

const t = window.t || ((key, fallback) => fallback || key);
const currentLang = window.currentLang || 'en';

/**
 * Выполняет операцию `createPaletteActions` для соответствующего сценария интерфейса.
 */
export function createPaletteActions({ state, showToast }) {
    function buildDownloadFilename(name, format) {
        const safeName = (name || '')
            .trim()
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/^\.+|\.+$/g, '');

        return `${safeName || 'palette'}.${format}`;
    }

    function exportPalette(format, colors, name) {
        if (!format) {
            showToast(t('export_error', 'Ошибка при экспорте'), 'error');
            return Promise.resolve();
        }

        return fetch(`/api/export?format=${format}`, {
            method: 'POST',
            headers: withCsrfHeaders({
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ colors }),
        }).then(async response => {
            if (!response.ok) {
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = buildDownloadFilename(name, format);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1500);
        });
    }

    function deletePalette(id, name) {
        state.currentDeleteId = id;
        state.currentDeleteName = name;

        const deleteModalText = document.getElementById('deleteModalText');
        if (deleteModalText) {
            deleteModalText.textContent = `${t('delete_modal_prompt', 'Вы уверены, что хотите удалить палитру')} "${name}"?`;
        }

        const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
        deleteModal.show();
    }

    function confirmDelete() {
        if (!state.currentDeleteId) {
            return;
        }

        const idToDelete = state.currentDeleteId;

        const deleteModalElement = document.getElementById('deleteModal');
        const deleteModal = bootstrap.Modal.getInstance(deleteModalElement);
        if (deleteModal) {
            deleteModal.hide();
        }

        fetch(`/api/palettes/delete/${idToDelete}`, {
            method: 'DELETE',
            headers: withCsrfHeaders({
                'Content-Type': 'application/json',
            }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast(t('palette_deleted', 'Палитра удалена!'));
                    setTimeout(() => {
                        location.reload();
                    }, 500);
                } else {
                    showToast(`${t('delete_error_prefix', 'Ошибка при удалении:')} ${data.error}`, 'error');
                }
            })
            .catch(error => {
                console.error('Delete palette error:', error);
                showToast(t('delete_error', 'Произошла ошибка при удалении'), 'error');
            });
    }

    return {
        exportPalette,
        deletePalette,
        confirmDelete,
    };
}
