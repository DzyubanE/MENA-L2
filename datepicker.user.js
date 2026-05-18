// ==UserScript==
// @name         Auto Datepicker for filters Team B BETA
// @version      1.0.7
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/datepicker.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/datepicker.user.js
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://managment.io/en/admin/backoffice/paymentsupport*
// @icon         https://raw.githubusercontent.com/DzyubanE/MENA-L2/refs/heads/main/datepicker.png
// @grant        none
// ==/UserScript==

// ==UserScript==
// @name         Datepicker Auto Range on Saved Filter Apply
// @version      2026-05-18
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport*
// @match        https://managment.io/en/admin/backoffice/paymentsupport*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=th-managment.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fmt(d) {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isMyTicketsSwitchOn() {
    const label = document.querySelector('.input-group.select-box .apm-form__switch');
    return label ? label.classList.contains('active') : false;
  }

  function getDateRange() {
    const now = new Date();

    if (isMyTicketsSwitchOn()) {
      const hour = now.getHours();
      const end = new Date(now);
      end.setHours(23, 59, 0, 0);

      if (hour >= 9) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return `${fmt(start)} ~ ${fmt(end)}`;
      } else {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        return `${fmt(start)} ~ ${fmt(end)}`;
      }
    }

    // Стандартный режим
    const end = new Date(now);
    end.setHours(23, 59, 0, 0);

    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);

    return `${fmt(start)} ~ ${fmt(end)}`;
  }

  function findDateInput() {
    return (
      document.querySelector('.mx-datepicker-range .mx-input') ||
      document.querySelector('.mx-datepicker .mx-input') ||
      document.querySelector('input.mx-input[name="date"]') ||
      document.querySelector('input.mx-input')
    );
  }

  function setDatepickerValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function trySetDate() {
    const input = findDateInput();
    if (!input) {
      console.warn('[DateRange] input not found');
      return false;
    }
    const value = getDateRange();
    console.log('[DateRange] setting:', value, '| switch ON:', isMyTicketsSwitchOn());
    setDatepickerValue(input, value);
    return true;
  }

  function isApplyButton(el) {
    // Кнопка Apply в модалке: type="submit" + btn-success + текст "Apply"
    // Не type="submit" — fallback по тексту внутри модалки
    if (!el) return false;
    const isSuccess = el.classList.contains('btn-success');
    const isSubmit = el.type === 'submit';
    const textMatch = el.textContent.trim() === 'Apply';
    const inModal = !!el.closest('.modal_content, .wrap-white');
    return isSuccess && (isSubmit || textMatch) && inModal;
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!isApplyButton(btn)) return;

    console.log('[DateRange] Apply clicked');

    setTimeout(() => {
      if (!trySetDate()) {
        const interval = setInterval(() => {
          if (trySetDate()) clearInterval(interval);
        }, 100);
        setTimeout(() => clearInterval(interval), 3000);
      }
    }, 300);
  }, true);

})();
