/*
 * Модуль: `static/js/main.js`.
 * Назначение: Глобальные UI-сценарии, уведомления и общие обработчики интерфейса.
 */

var t = window.t || ((key, fallback) => fallback || key);

window.addEventListener('scroll', function () {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

document.querySelectorAll('.btn-primary:not(#reanalyzeBtn), .btn-outline-primary:not(#reanalyzeBtn), .btn-secondary:not(#reanalyzeBtn)').forEach(button => {
    button.addEventListener('mouseenter', function () {
        if (!this.id.includes('reanalyze')) {
            this.style.transform = 'translateY(-3px)';
        }
    });

    button.addEventListener('mouseleave', function () {
        if (!this.id.includes('reanalyze')) {
            this.style.transform = 'translateY(0)';
        }
    });
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function () {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
    });
});

const logo = document.querySelector('.header__logo');
if (logo) {
    logo.addEventListener('mouseenter', () => {
        const logoImg = logo.querySelector('.header_img');
        if (logoImg) {
            logoImg.style.transform = 'rotate(-5deg) scale(1.05)';
        }
    });

    logo.addEventListener('mouseleave', () => {
        const logoImg = logo.querySelector('.header_img');
        if (logoImg) {
            logoImg.style.transform = 'rotate(0) scale(1)';
        }
    });
}


/* ===== ТЕМА ===== */
(function initTheme() {
    const STORAGE_KEY = 'paleta-theme';
    const html = document.documentElement;
    const darkMq = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(mode) {
        if (mode === 'dark') {
            html.setAttribute('data-theme', 'dark');
            html.setAttribute('data-bs-theme', 'dark');
        } else if (mode === 'light') {
            html.setAttribute('data-theme', 'light');
            html.setAttribute('data-bs-theme', 'light');
        } else {
            html.removeAttribute('data-theme');
            html.setAttribute('data-bs-theme', darkMq.matches ? 'dark' : 'light');
        }
    }

    function updateIcon(mode) {
        const icon = document.getElementById('themeIcon');
        if (!icon) return;
        icon.className = mode === 'dark' ? 'fas fa-moon'
            : mode === 'light' ? 'fas fa-sun'
            : 'fas fa-circle-half-stroke';
    }

    function getStoredTheme() {
        return localStorage.getItem(STORAGE_KEY) || 'system';
    }

    function setStoredTheme(mode) {
        if (mode === 'system') {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, mode);
        }
    }

    const initial = getStoredTheme();
    applyTheme(initial);

    darkMq.addEventListener('change', () => {
        if (getStoredTheme() === 'system') applyTheme('system');
    });

    document.addEventListener('DOMContentLoaded', () => {
        updateIcon(getStoredTheme());
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                const cycle = { system: 'dark', dark: 'light', light: 'system' };
                const next = cycle[getStoredTheme()] || 'system';
                setStoredTheme(next);
                applyTheme(next);
                updateIcon(next);
            });
        }
    });
})();

document.addEventListener('DOMContentLoaded', function () {
    if (typeof bootstrap === 'undefined') {
        console.error(t('bootstrap_missing', 'Bootstrap не загружен!'));
    } else {
        console.log(t('bootstrap_loaded', 'Bootstrap загружен успешно'));
    }

    const saveModalElement = document.getElementById('saveModal');
    if (saveModalElement) {
        saveModalElement.addEventListener('hidden.bs.modal', function () {
            const paletteNameInput = document.getElementById('paletteName');
            if (paletteNameInput) paletteNameInput.value = '';
        });
    }

    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '/' && (currentPath === href || currentPath.startsWith(href + '/'))) {
            link.classList.add('active');
        }
    });

    const logoutForm = document.getElementById('logoutForm');
    if (logoutForm) {
        logoutForm.addEventListener('submit', () => {
            localStorage.removeItem('lastImageFilename');
            localStorage.removeItem('lastPalette');
            localStorage.removeItem('lastImageDataURL');
            localStorage.removeItem('createPalette_colors');
        });
    }
});

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
