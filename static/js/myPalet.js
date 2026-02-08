// Скрипт для страницы "Мои палитры"
let currentDeleteId = null;
let currentDeleteName = null;
let currentRenameId = null;

document.addEventListener('DOMContentLoaded', function() {
    // Обработчик события закрытия модального окна удаления
    const deleteModalElement = document.getElementById('deleteModal');
    if (deleteModalElement) {
        deleteModalElement.addEventListener('hidden.bs.modal', function () {
            // Сбрасываем переменные при закрытии
            currentDeleteId = null;
            currentDeleteName = null;
        });
    }
    
    // Обработчик события закрытия модального окна переименования
    const renameModalElement = document.getElementById('renameModal');
    if (renameModalElement) {
        renameModalElement.addEventListener('hidden.bs.modal', function () {
            // Сбрасываем переменные при закрытии
            currentRenameId = null;
        });
    }

    // Обработчик подтверждения удаления палитры
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            confirmDelete();
        });
    }

    // Обработчик подтверждения переименования палитры
    const confirmRenameBtn = document.getElementById('confirmRenameBtn');
    if (confirmRenameBtn) {
        confirmRenameBtn.addEventListener('click', function() {
            confirmRename();
        });
    }

    // Фильтрация и сортировка палитр
    const searchInput = document.getElementById('paletteSearch');
    const colorCountFilter = document.getElementById('colorCountFilter');
    const sortSelect = document.getElementById('paletteSort');
    const palettesContainer = document.getElementById('palettesContainer');
    const visibleCountEl = document.getElementById('paletteCountVisible');
    const totalCountEl = document.getElementById('paletteCountTotal');

    // Обновление счётчика палитр
    function updateCounts() {
        const cards = document.querySelectorAll('.palette-card');
        const total = cards.length;
        let visible = 0;

        cards.forEach(card => {
            if (!card.classList.contains('d-none')) {
                visible += 1;
            }
        });

        if (visibleCountEl) {
            visibleCountEl.textContent = visible.toString();
        }
        if (totalCountEl) {
            totalCountEl.textContent = total.toString();
        }
    }

    // Применить текущие фильтры к карточкам палитр
    function applyFilters() {
        const searchValue = (searchInput?.value || '').toLowerCase().trim();
        const countValue = colorCountFilter?.value || '';

        const cards = document.querySelectorAll('.palette-card');
        cards.forEach(card => {
            const name = (card.dataset.name || '').toLowerCase();
            const colorCount = card.dataset.colorCount || '';

            const matchesName = !searchValue || name.includes(searchValue);
            const matchesCount = !countValue || colorCount === countValue;

            if (matchesName && matchesCount) {
                card.classList.remove('d-none');
            } else {
                card.classList.add('d-none');
            }
        });

        updateCounts();
    }

    // Сортировка карточек палитр
    function applySort() {
        if (!palettesContainer || !sortSelect) return;

        const cards = Array.from(palettesContainer.querySelectorAll('.palette-card'));
        const sortValue = sortSelect.value;

        const getCreatedAt = (card) => {
            const raw = card.dataset.createdAt || '0';
            const num = Number(raw);
            return Number.isNaN(num) ? 0 : num;
        };

        cards.sort((a, b) => {
            switch (sortValue) {
                case 'created_asc':
                    return getCreatedAt(a) - getCreatedAt(b);
                case 'created_desc':
                    return getCreatedAt(b) - getCreatedAt(a);
                case 'name_asc': {
                    const na = (a.dataset.name || '').localeCompare(b.dataset.name || '', 'ru');
                    return na;
                }
                case 'name_desc': {
                    const nd = (b.dataset.name || '').localeCompare(a.dataset.name || '', 'ru');
                    return nd;
                }
                case 'colors_asc': {
                    const ca = Number(a.dataset.colorCount || '0');
                    const cb = Number(b.dataset.colorCount || '0');
                    return ca - cb;
                }
                case 'colors_desc': {
                    const cda = Number(a.dataset.colorCount || '0');
                    const cdb = Number(b.dataset.colorCount || '0');
                    return cdb - cda;
                }
                default:
                    // По умолчанию — как новые сначала
                    return getCreatedAt(b) - getCreatedAt(a);
            }
        });

        cards.forEach(card => palettesContainer.appendChild(card));
    }

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    if (colorCountFilter) {
        colorCountFilter.addEventListener('change', applyFilters);
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            applySort();
            applyFilters();
        });
    }

    // Инициализация сортировки и фильтров при загрузке страницы
    if (palettesContainer) {
        applySort();
    }
    applyFilters();
    
    // Делегирование событий для динамически создаваемых элементов (кнопки экспорта, переименования и удаления)
    document.addEventListener('click', async function(e) {
        const target = e.target;

        // Проверяем, была ли нажата ссылка экспорта конкретной палитры
        if (target.classList.contains('export-option')) {
            e.preventDefault();
            const format = target.dataset.format;
            const colors = JSON.parse(target.dataset.colors);
            const name = target.dataset.name;
            
            try {
                console.log(`Экспорт ${name} в формате ${format}`, colors);
                
                const response = await fetch(`/api/export?format=${format}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ colors: colors })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                console.error('Не удалось экспортировать палитру, статус:', response.status);
                    showToast('Ошибка при экспорте', 'error');
                }
            } catch (error) {
                console.error('Ошибка при экспорте палитры:', error);
                showToast('Ошибка при экспорте', 'error');
            }
        } else if (target.classList.contains('btn-delete-palette')) {
            // Кнопка удаления палитры
            const id = target.dataset.paletteId;
            const name = target.dataset.paletteName;
            deletePalette(id, name);
        } else if (target.classList.contains('btn-rename-palette')) {
            // Кнопка переименования палитры
            const id = target.dataset.paletteId;
            const name = target.dataset.paletteName;
            renamePalette(id, name);
        }
    });
});

// Копирование HEX-цветов палитры в буфер обмена (по одному цвету в строке)
function copyPalette(colors) {
    const colorArray = colors.split(' ');
    navigator.clipboard.writeText(colorArray.join('\n')).then(() => {
        showToast('Цвета скопированы в буфер обмена!');
    });
}

// Открыть модальное окно подтверждения удаления палитры
function deletePalette(id, name) {
    currentDeleteId = id;
    currentDeleteName = name;
    const deleteModalText = document.getElementById('deleteModalText');
    if (deleteModalText) {
        deleteModalText.textContent = `Вы уверены, что хотите удалить палитру "${name}"?`;
    }
    const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    deleteModal.show();
}

// Отправка запроса на удаление палитры и обновление списка
function confirmDelete() {
    if (!currentDeleteId) {
        return;
    }
    
    const idToDelete = currentDeleteId;
    
    // Закрываем модальное окно через Bootstrap API
    const deleteModalElement = document.getElementById('deleteModal');
    const deleteModal = bootstrap.Modal.getInstance(deleteModalElement);
    if (deleteModal) {
        deleteModal.hide();
    }
    
    fetch(`/api/palettes/delete/${idToDelete}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Палитра удалена!');
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            showToast('Ошибка при удалении: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка при удалении палитры:', error);
        showToast('Произошла ошибка при удалении', 'error');
    });
}

// Открыть модальное окно переименования палитры
function renamePalette(id, name) {
    currentRenameId = id;
    const input = document.getElementById('newPaletteName');
    if (input) {
        input.value = name;
        input.focus();
    }
    const renameModal = new bootstrap.Modal(document.getElementById('renameModal'));
    renameModal.show();
}

// Отправка запроса на переименование палитры
function confirmRename() {
    if (!currentRenameId) {
        return;
    }

    const input = document.getElementById('newPaletteName');
    const newName = (input?.value || '').trim();

    if (!newName) {
        showToast('Название палитры не может быть пустым.', 'error');
        return;
    }

    const idToRename = currentRenameId;
    
    // Закрываем модальное окно через Bootstrap API
    const renameModalElement = document.getElementById('renameModal');
    const renameModal = bootstrap.Modal.getInstance(renameModalElement);
    if (renameModal) {
        renameModal.hide();
    }

    fetch(`/api/palettes/rename/${idToRename}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
    })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    showToast('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                    window.location.href = '/login';
                    return null;
                }
                return response.json().then(data => {
                    throw new Error(data.error || 'Ошибка при переименовании палитры');
                }).catch(() => {
                    throw new Error('Ошибка при переименовании палитры');
                });
            }
            return response.json();
        })
        .then(data => {
            if (!data) return; // Если была ошибка авторизации
            
            if (data.success) {
                showToast('Название палитры обновлено!');
                // Обновляем заголовок и data-атрибут в карточке без перезагрузки
                const card = document.querySelector(`.palette-card[data-palette-id="${idToRename}"]`);
                if (card) {
                    const titleEl = card.querySelector('.card-title');
                    if (titleEl) titleEl.textContent = newName;
                    card.dataset.name = newName.toLowerCase();
                    card.dataset.paletteName = newName;
                    // Обновляем data-атрибут кнопок
                    const renameBtn = card.querySelector(`button.btn-rename-palette[data-palette-id="${idToRename}"]`);
                    if (renameBtn) {
                        renameBtn.dataset.paletteName = newName;
                    }
                    const deleteBtn = card.querySelector(`button.btn-delete-palette[data-palette-id="${idToRename}"]`);
                    if (deleteBtn) {
                        deleteBtn.dataset.paletteName = newName;
                    }
                }
            } else {
                showToast(data.error || 'Ошибка при переименовании палитры', 'error');
            }
        })
        .catch(error => {
            console.error('Ошибка при переименовании палитры:', error);
            showToast(error.message || 'Произошла ошибка при переименовании палитры', 'error');
        });
}

// Функция для показа небольших уведомлений (toast)
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