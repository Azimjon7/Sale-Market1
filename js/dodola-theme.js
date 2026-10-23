(function () {
  'use strict';

  const STORAGE_KEY = 'dodola_theme';
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');

  function storedTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch {
      return null;
    }
  }

  function preferredTheme() {
    return storedTheme() || (media?.matches ? 'dark' : 'light');
  }

  function language() {
    try { return localStorage.getItem('dodola_language') === 'ru' ? 'ru' : 'uz'; }
    catch { return 'uz'; }
  }

  function labels(theme) {
    const isDark = theme === 'dark';
    const ru = language() === 'ru';
    return {
      action: ru
        ? (isDark ? 'Включить светлую тему' : 'Включить тёмную тему')
        : (isDark ? 'Kunduzgi rejimni yoqish' : 'Tungi rejimni yoqish'),
      state: ru
        ? (isDark ? 'Тёмная тема включена' : 'Светлая тема включена')
        : (isDark ? 'Tungi rejim yoqilgan' : 'Kunduzgi rejim yoqilgan')
    };
  }

  function paintControls(theme) {
    const copy = labels(theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-label', copy.action);
      button.setAttribute('title', copy.action);
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      const state = button.querySelector('.dodola-theme-toggle__state');
      if (state) state.textContent = copy.state;
    });
  }

  function apply(theme, persist) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = safeTheme;
    document.documentElement.style.colorScheme = safeTheme;
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, safeTheme); } catch {}
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = safeTheme === 'dark' ? '#120d18' : '#fcfaf7';
    paintControls(safeTheme);
    document.dispatchEvent(new CustomEvent('dodola:theme', { detail: { theme: safeTheme } }));
  }

  function createToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dodola-theme-toggle';
    button.dataset.themeToggle = '';
    button.innerHTML = '<span class="dodola-theme-toggle__icon dodola-theme-toggle__icon--moon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.7 8.7 0 1 0 20.2 15.1Z"/></svg></span><span class="dodola-theme-toggle__icon dodola-theme-toggle__icon--sun" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span><span class="dodola-theme-toggle__state"></span>';
    button.addEventListener('click', () => {
      apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
    return button;
  }

  apply(preferredTheme(), false);

  function boot() {
    const header = document.querySelector('.dodola-header__inner');
    if (header && !header.querySelector('[data-theme-toggle]')) header.append(createToggle());
    paintControls(document.documentElement.dataset.theme || preferredTheme());
    document.addEventListener('dodola:language', () => paintControls(document.documentElement.dataset.theme || preferredTheme()));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  media?.addEventListener?.('change', (event) => {
    if (!storedTheme()) apply(event.matches ? 'dark' : 'light', false);
  });

  window.DodolaTheme = Object.freeze({
    set: (theme) => apply(theme, true),
    get current() { return document.documentElement.dataset.theme || preferredTheme(); }
  });
})();
