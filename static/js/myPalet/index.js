/*
 * Модуль: `static/js/myPalet/index.js`.
 * Назначение: Модуль клиентской логики раздела «Мои палитры».
 */

import { copyPalette } from './clipboard.js';
import { createFiltersController } from './filters.js';
import { showToast } from './notifications.js';
import { createPaletteActions } from './palette-actions.js';
import { createPaletteEditor } from './palette-editor.js';
import { createMyPaletState } from './state.js';

const t = window.t || ((key, fallback) => fallback || key);

function collectMyPaletElements(root = document) {
    return {
        deleteModalElement: root.getElementById('deleteModal'),
        renameModalElement: root.getElementById('renameModal'),
        confirmDeleteBtn: root.getElementById('confirmDeleteBtn'),
        confirmRenameBtn: root.getElementById('confirmRenameBtn'),
        searchInput: root.getElementById('paletteSearch'),
        colorCountFilter: root.getElementById('colorCountFilter'),
        sortSelect: root.getElementById('paletteSort'),
        palettesContainer: root.getElementById('palettesContainer'),
        visibleCountEl: root.getElementById('paletteCountVisible'),
        totalCountEl: root.getElementById('paletteCountTotal'),
    };
}

/**
 * Выполняет операцию `initMyPaletPage` для соответствующего сценария интерфейса.
 */
export function initMyPaletPage() {
    const elements = collectMyPaletElements();

    if (!elements.palettesContainer && !elements.deleteModalElement && !elements.renameModalElement) {
        return;
    }

    const state = createMyPaletState();
    const filtersController = createFiltersController(elements);
    const actions = createPaletteActions({ state, showToast });
    const editor = createPaletteEditor({ showToast });

    if (elements.deleteModalElement) {
        elements.deleteModalElement.addEventListener('hidden.bs.modal', () => {
            state.currentDeleteId = null;
            state.currentDeleteName = null;
        });
    }

    if (elements.renameModalElement) {
        elements.renameModalElement.addEventListener('hidden.bs.modal', () => {
            state.currentRenameId = null;
        });
    }

    if (elements.confirmDeleteBtn) {
        elements.confirmDeleteBtn.addEventListener('click', () => {
            actions.confirmDelete();
        });
    }

    if (elements.confirmRenameBtn) {
        elements.confirmRenameBtn.addEventListener('click', () => {
            actions.confirmRename();
        });
    }

    filtersController.bind();

    document.addEventListener('click', async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const exportOption = target ? target.closest('.export-option') : null;
        if (exportOption) {
            event.preventDefault();
            const format = exportOption.dataset.format;
            const name = exportOption.dataset.name;
            let colors = [];

            try {
                colors = JSON.parse(exportOption.dataset.colors || '[]');
            } catch (_error) {
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
                return;
            }

            try {
                await actions.exportPalette(format, colors, name);
            } catch (error) {
                console.error('My palettes export error:', error);
                showToast(t('export_error', 'Ошибка при экспорте'), 'error');
            }
            return;
        }

        const deleteButton = target ? target.closest('.btn-delete-palette') : null;
        if (deleteButton) {
            actions.deletePalette(deleteButton.dataset.paletteId, deleteButton.dataset.paletteName);
            return;
        }

        const renameButton = target ? target.closest('.btn-rename-palette') : null;
        if (renameButton) {
            actions.renamePalette(renameButton.dataset.paletteId, renameButton.dataset.paletteName);
            return;
        }

        const editButton = target ? target.closest('.btn-edit-palette') : null;
        if (editButton) {
            editor.openEditor(editButton.dataset.paletteId);
            return;
        }

        const cancelButton = target ? target.closest('.btn-cancel-edit') : null;
        if (cancelButton) {
            editor.closeEditor(cancelButton.dataset.paletteId);
            return;
        }

        const saveButton = target ? target.closest('.btn-save-colors') : null;
        if (saveButton) {
            editor.saveColors(saveButton.dataset.paletteId);
            return;
        }

        const addButton = target ? target.closest('.btn-add-color') : null;
        if (addButton) {
            editor.addColor(addButton.dataset.paletteId);
            return;
        }

        const removeButton = target ? target.closest('.btn-remove-color') : null;
        if (removeButton) {
            editor.removeColor(removeButton.dataset.paletteId, parseInt(removeButton.dataset.index, 10));
            return;
        }

        const gradientButton = target ? target.closest('.btn-gradient-fill') : null;
        if (gradientButton) {
            editor.applyGradient(gradientButton.dataset.paletteId);
            return;
        }
    });

    window.copyPalette = (colors) => copyPalette(colors, showToast);
}
