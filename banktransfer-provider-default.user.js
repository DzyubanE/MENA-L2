// ==UserScript==
// @name         Bank Transfer — No Default Provider Team B BETA
// @namespace    team-bestie
// @version      1.0.0
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/banktransfer-provider-default.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/banktransfer-provider-default.user.js
// @description  Убирает автоподстановку первого провайдера в Bank Transfer — поле остаётся пустым с плейсхолдером Select provider
// @author       You
// @match        https://th-managment.com/en/admin/banktransfer*
// @match        https://my-managment.com/en/admin/banktransfer*
// @match        https://managment.io/en/admin/banktransfer*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Плейсхолдеры полей, которые не должны автозаполняться первым вариантом.
  const TARGET_PLACEHOLDERS = ['select provider'];

  // Сколько миллисекунд после появления поля считаем «автоподстановкой».
  // Значение, выставленное приложением позже этого окна, уже не трогаем.
  const ARM_WINDOW_MS = 15000;

  // ── Поиск инстанса vue-multiselect ─────────────────────────────────────────
  function findMultiselectInstance(rootEl) {
    // Vue 3
    let inst = rootEl.__vueParentComponent;
    while (inst) {
      const p = inst.proxy;
      if (p && typeof p.removeElement === 'function' && 'internalValue' in p) return p;
      inst = inst.parent;
    }
    // Vue 2
    let v = rootEl.__vue__;
    while (v) {
      if (typeof v.removeElement === 'function') return v;
      v = v.$parent;
    }
    return null;
  }

  // ── Снятие выбора ──────────────────────────────────────────────────────────
  function clearSelection(rootEl) {
    const inst = findMultiselectInstance(rootEl);
    if (!inst) return false;

    const current = inst.internalValue;
    if (!current || (Array.isArray(current) && current.length === 0)) return false;

    // Штатный путь: компонент сам сообщит родителю об удалении.
    [].concat(current).forEach(option => {
      try { inst.removeElement(option, false); } catch (e) { /* no-op */ }
    });

    // Запасной путь: allowEmpty=false не даёт removeElement сработать.
    const left = inst.internalValue;
    if (left && (!Array.isArray(left) || left.length)) {
      const empty = Array.isArray(left) ? [] : null;
      try { inst.$emit('update:modelValue', empty); } catch (e) { /* no-op */ }
      try { inst.$emit('input', empty); } catch (e) { /* no-op */ }
    }

    return true;
  }

  // ── Отслеживание одного поля ───────────────────────────────────────────────
  function watch(rootEl) {
    if (rootEl.dataset.btNoDefault) return;
    rootEl.dataset.btNoDefault = '1';

    let armed = true;

    // Ручной выбор пользователя не трогаем.
    const disarm = () => { armed = false; };
    rootEl.addEventListener('pointerdown', disarm, true);
    rootEl.addEventListener('keydown', disarm, true);

    const tryClear = () => {
      if (!armed) return;
      if (!rootEl.isConnected) { stop(); return; }
      if (!rootEl.querySelector('.multiselect__single')) return;
      if (clearSelection(rootEl)) { armed = false; stop(); }
    };

    const mo = new MutationObserver(tryClear);
    mo.observe(rootEl, { childList: true, subtree: true, characterData: true });

    const timer = setTimeout(stop, ARM_WINDOW_MS);

    function stop() {
      mo.disconnect();
      clearTimeout(timer);
      rootEl.removeEventListener('pointerdown', disarm, true);
      rootEl.removeEventListener('keydown', disarm, true);
    }

    tryClear();
  }

  // ── Поиск нужных полей на странице ─────────────────────────────────────────
  function scan() {
    document.querySelectorAll('.multiselect').forEach(ms => {
      const input = ms.querySelector('input.multiselect__input');
      const ph = (input && input.getAttribute('placeholder') || '').trim().toLowerCase();
      if (!ph || !TARGET_PLACEHOLDERS.includes(ph)) return;
      watch(ms);
    });
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scan(); });
  }

  new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });
  scan();

})();
