/**
 * Tests for the site theme toggle.
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const themeCode = fs.readFileSync(path.join(__dirname, '..', '..', 'legacy-static', 'src', 'theme', 'theme.js'), 'utf8');

function setupTheme() {
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#0f172a">';
  document.body.innerHTML = '<button id="themeToggle" type="button"><span>Light</span></button>';
  window.localStorage.clear();
  window.Pattens = {};
  window.lucide = { createIcons: jest.fn() };
  (0, eval)(themeCode);
  return window.Pattens.theme;
}

describe('Theme toggle', () => {
  test('switches to light mode and updates the accessible toggle state', () => {
    const theme = setupTheme();

    theme.applyTheme('light');

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.getElementById('themeToggle').getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('themeToggle').getAttribute('aria-label')).toBe('Switch to dark mode');
    expect(document.querySelector('meta[name="theme-color"]').content).toBe('#f5f4f1');
  });

  test('toggles from the default dark mode to light mode', () => {
    const theme = setupTheme();

    theme.toggleTheme();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('pattens.theme')).toBe('light');
  });
});
