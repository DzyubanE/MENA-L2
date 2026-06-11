// ==UserScript==
// @name         Google Sheets: Merge/Unmerge Hotkeys
// @namespace    https://github.com/DzyubanE/
// @version      1.1
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
      const text = item.innerText || item.textContent || '';
      if (text.includes(labelSubstring)) {
        item.click();
        return true;
      }
    }
    return false;
  }

  function openFormatMenu() {
    const menuItems = document.querySelectorAll('#docs-menubar .menu-button');
    for (const btn of menuItems) {
      const text = btn.innerText || btn.textContent || '';
      if (text.trim() === 'Формат' || text.trim() === 'Format') {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function runMergeAction(labelTop, labelSub) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    setTimeout(() => {
      if (!openFormatMenu()) return;

      setTimeout(() => {
        const items = document.querySelectorAll('.goog-menuitem');
        for (const item of items) {
          const text = item.innerText || item.textContent || '';
          if (text.includes(labelTop)) {
            item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

            setTimeout(() => {
              if (!clickMenuItem(labelSub)) {
                item.click();
              }
            }, 200);
            return;
          }
        }
      }, 200);
    }, 50);
  }

  function mergeAll() {
    runMergeAction('Объединить ячейки', 'Объединить всё');
    setTimeout(() => runMergeAction('Merge cells', 'Merge all'), 50);
  }

  function unmergeAll() {
    runMergeAction('Объединить ячейки', 'Разъединить');
    setTimeout(() => runMergeAction('Merge cells', 'Unmerge'), 50);
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
