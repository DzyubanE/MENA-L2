// ==UserScript==
// @name         Google Sheets: Merge/Unmerge Hotkeys
// @namespace    https://github.com/DzyubanE/
// @version      1.2
// @description  Ctrl+E — объединить ячейки, Alt+E — разъединить (Google Sheets)
// @author       You
// @match        https://docs.google.com/spreadsheets/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=docs.google.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

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
    // Закрываем всё открытое
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    setTimeout(() => {
      if (!openFormatMenu()) return;

      // Ждём появления меню Формат
      setTimeout(() => {
        const items = document.querySelectorAll('.goog-menuitem');
        for (const item of items) {
          if (item.textContent.trim().includes(labelTop)) {
            item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            // Ждём появления подменю
            setTimeout(() => {
              clickMenuItem(labelSub);
            }, 250);
            return;
          }
        }
      }, 250);
    }, 50);
  }

  function mergeAll() {
    // RU: «Объединить все» / EN: «Merge all»
    runMergeAction('Объединить ячейки', 'Объединить все');
    setTimeout(() => runMergeAction('Merge cells', 'Merge all'), 100);
  }

  function unmergeAll() {
    // RU: «Отменить объединение ячеек» / EN: «Unmerge»
    runMergeAction('Объединить ячейки', 'Отменить объединение');
    setTimeout(() => runMergeAction('Merge cells', 'Unmerge'), 100);
  }

  document.addEventListener('keydown', function (e) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Ctrl+E — объединить
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'e') {
      e.preventDefault();
      e.stopPropagation();
      mergeAll();
      return;
    }

    // Alt+E — разъединить
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'e') {
      e.preventDefault();
      e.stopPropagation();
      unmergeAll();
      return;
    }
  }, true);

})();
