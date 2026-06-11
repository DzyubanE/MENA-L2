// ==UserScript==
// @name         Google Sheets: Merge/Unmerge Hotkeys
// @namespace    https://github.com/DzyubanE/
// @version      1.7
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
  console.log('[MergeScript] loaded ✅');

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

  function runMergeAction(labelSub) {
    // Закрываем всё открытое
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    setTimeout(() => {
      // Открываем меню Формат
      const formatBtn = [...document.querySelectorAll('#docs-menubar .menu-button')]
        .find(b => b.innerText.trim() === 'Формат' || b.innerText.trim() === 'Format');
      if (!formatBtn) { console.log('[MergeScript] Формат не найден'); return; }
      simulateClick(formatBtn);

      setTimeout(() => {
        // Наводим на «Объединить ячейки»
        const mergeItem = findMenuItem('Объединить ячейки') || findMenuItem('Merge cells');
        if (!mergeItem) { console.log('[MergeScript] Объединить ячейки не найден'); return; }
        console.log('[MergeScript] нашли:', mergeItem.textContent.trim());
        simulateClick(mergeItem);

        setTimeout(() => {
          // Кликаем нужный пункт подменю
          const subItem = findMenuItem(labelSub);
          if (!subItem) { console.log('[MergeScript] подменю не найдено:', labelSub); return; }
          console.log('[MergeScript] клик:', subItem.textContent.trim());
          simulateClick(subItem);
        }, 500);
      }, 500);
    }, 50);
  }

  function mergeAll()   { runMergeAction('Объединить все');         }
  function unmergeAll() { runMergeAction('Отменить объединение'); }

  document.addEventListener('keydown', function (e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Alt+Q / Alt+Й — объединить
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && ['q', 'й'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      mergeAll();
      return;
    }

    // Alt+W / Alt+Ц — разъединить
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && ['w', 'ц'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
      unmergeAll();
      return;
    }
  }, true);

})();
