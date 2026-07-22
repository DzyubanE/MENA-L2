// ==UserScript==
// @name         Dark Theme Recolor Team B BETA
// @namespace    team-bestie
// @version      1.0.0
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/dark-theme-recolor.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/dark-theme-recolor.user.js
// @description  Перекрашивает встроенную тёмную тему сайта в более тёмную и контрастную
// @author       You
// @match        https://th-managment.com/*
// @match        https://my-managment.com/*
// @match        https://managment.io/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window._THEME !== 'dark') return;

  const style = document.createElement('style');
  style.id = 'b-dark-recolor';
  style.textContent = `
    :root {
      --dark-theme-color-1: #0d1117 !important;
      --dark-theme-color-2: #1c2128 !important;
      --dark-theme-color-3: #30363d !important;
      --dark-theme-color-4: #8b949e !important;
      --dark-theme-color-5: #6e7681 !important;
      --dark-theme-color-6: #3d444d !important;
      --dark-theme-text-color-1: #e6edf3 !important;
      --dark-theme-text-color-2: #c9d1d9 !important;
      --dark-theme-text-color-4: #c9d1d9 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
})();
