// ==UserScript==
// @name         Google Sheets: Merge/Unmerge Hotkeys
// @namespace    https://github.com/DzyubanE/
// @version      1.6
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

  function clickMenuItem(labelSubstring) {
    const items = document.querySelectorAll('.goog-menuitem');
    for (const item of items) {
      const text = item.textContent.trim();
      if (text.includes(labelSubstring)) {
        item.click();
        return true;
      }
    }
    return false;
  }

  function openFormatMenu() {
    const btns = document.querySelectorAll('#docs-menubar .menu-button');
    for (const btn of btns) {
      if (btn.innerText.trim() === 'Формат' || btn.innerText.trim() === 'Format') {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function runMergeAction(labelTop, labelSub) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    setTimeout(() => {
      if (!openFormatMenu()) {
        console.log('[MergeScript] Формат не найден');
        return;
      }
      console.log('[MergeScript] Формат открыт, ищем:', labelTop);

      setTimeout(() => {
        const items = document.querySelectorAll('.goog-menuitem');
        for (const item of items) {
          if (item.textContent.trim().includes(labelTop)) {
            console.log('[MergeScript] нашли:', item.textContent.trim());
            item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            setTimeout(() => {
              const ok = clickMenuItem(labelSub);
              console.log('[MergeScript] клик по подменю', labelSub, ok ? '✅' : '❌');
            }, 600);
            return;
          }
        }
        console.log('[MergeScript] пункт не найден среди', items.length, 'элементов');
      }, 600);
    }, 50);
  }

  function mergeAll() {
    console.log('[MergeScript] mergeAll');
    runMergeAction('Объединить ячейки', 'Объединить все');
    setTimeout(() => runMergeAction('Merge cells', 'Merge all'), 100);
  }

  function unmergeAll() {
    console.log('[MergeScript] unmergeAll');
    runMergeAction('Объединить ячейки', 'Отменить объединение');
    setTimeout(() => runMergeAction('Merge cells', 'Unmerge'), 100);
  }

  document.addEventListener('keydown', function (e) {
    const tag = document.activeElement && document.activeElement.tagName;
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
