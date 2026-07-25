(function () {
  'use strict';

  var STORAGE_KEY = 'pattens.theme';
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var metaThemeColor = document.querySelector('meta[name="theme-color"]');

  function readTheme() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (error) {
      return 'dark';
    }
  }

  function renderToggle(theme) {
    if (!toggle) return;
    var isLight = theme === 'light';
    toggle.setAttribute('aria-pressed', String(isLight));
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.innerHTML = isLight
      ? '<i data-lucide="moon" class="h-4 w-4"></i>'
      : '<i data-lucide="sun" class="h-4 w-4"></i>';
    window.lucide?.createIcons();
  }

  /**
   * Applies the selected visual theme and remembers the preference locally.
   * @param {'dark'|'light'} theme The theme to apply.
   */
  function applyTheme(theme) {
    var nextTheme = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = nextTheme;
    if (metaThemeColor) metaThemeColor.setAttribute('content', nextTheme === 'light' ? '#f5f4f1' : '#0f172a');
    renderToggle(nextTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch (error) {
      return;
    }
  }

  /**
   * Switches between the light and dark themes.
   */
  function toggleTheme() {
    applyTheme(root.dataset.theme === 'light' ? 'dark' : 'light');
  }

  if (toggle) toggle.addEventListener('click', toggleTheme);
  applyTheme(readTheme());

  window.Pattens = window.Pattens || {};
  window.Pattens.theme = {
    applyTheme: applyTheme,
    toggleTheme: toggleTheme
  };
}());
