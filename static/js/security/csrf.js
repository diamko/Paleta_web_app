/*
 * Модуль: `static/js/security/csrf.js`.
 * Назначение: Получение CSRF-токена и формирование безопасных заголовков запросов.
 */

export function getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.getAttribute('content') || '' : '';
}

/**
 * Выполняет операцию `withCsrfHeaders` для соответствующего сценария интерфейса.
 */
export function withCsrfHeaders(headers = {}) {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        return { ...headers };
    }
    return {
        ...headers,
        'X-CSRF-Token': csrfToken,
    };
}
