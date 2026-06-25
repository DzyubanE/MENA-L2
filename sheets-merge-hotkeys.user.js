// ==UserScript==
// @name         Google Sheets: Merge/Unmerge Hotkeys
// @namespace    https://github.com/DzyubanE/
// @version      2.0
// @description  Alt+Q — объединить ячейки, Alt+W — разъединить (Google Sheets)
// @author       You
// @match        https://docs.google.com/spreadsheets/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=docs.google.com
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  window.__mergeScriptLoaded = true;

  function simulateClick(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseenter',{ bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }

  function findMenuItem(substring) {
    return [...document.querySelectorAll('.goog-menuitem')]
      .find(i => i.textContent.trim().includes(substring));
  }

  // Прячем все открытые меню на время выполнения
  function hideMenus() {
    const style = document.createElement('style');
    style.id = '__mergeHideMenus';
    style.textContent = '.goog-menu { opacity: 0 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
  }

  function showMenus() {
    document.getElementById('__mergeHideMenus')?.remove();
  }

  function runMergeAction(labelSub) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    hideMenus();

    setTimeout(() => {
      const formatBtn = [...document.querySelectorAll('#docs-menubar .menu-button')]
        .find(b => b.innerText.trim() === 'Формат' || b.innerText.trim() === 'Format');
      if (!formatBtn) { showMenus(); return; }
      simulateClick(formatBtn);

      setTimeout(() => {
        const mergeItem = findMenuItem('Объединить ячейки') || findMenuItem('Merge cells');
        if (!mergeItem) { showMenus(); return; }
        simulateClick(mergeItem);

        setTimeout(() => {
          const subItem = findMenuItem(labelSub);
          if (!subItem) { showMenus(); return; }
          simulateClick(subItem);
          showMenus();
        }, 150);
      }, 150);
    }, 50);
  }

  function mergeAll()   { runMergeAction('Объединить все');      }
  function unmergeAll() { runMergeAction('Отменить объединение'); }

  document.addEventListener('keydown', function (e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && ['q', 'й'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      mergeAll();
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && ['w', 'ц'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      unmergeAll();
      return;
    }
  }, true);

})();
