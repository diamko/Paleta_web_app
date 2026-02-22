/*
 * Модуль: `static/js/palette/state.js`.
 * Назначение: Модуль клиентской логики страницы извлечения и редактирования палитры.
 */

export function createPaletteState() {
    return {
        currentImageFile: null,
        currentColors: [],
        paletteControls: [],
        markerPositions: [],
        markerElements: [],
        activeMarkerIndex: -1,
        draggingMarkerIndex: -1,
        draggingPointerId: null,
    };
}
