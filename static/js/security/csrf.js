export function getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.getAttribute('content') || '' : '';
}

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
