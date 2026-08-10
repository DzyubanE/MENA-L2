// ==UserScript==
// @name         Edit Helper Team B BETA
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @description  Двойное подтверждение + шаблоны комментариев + копирование данных тикета + превью вложений
// @author       You
// @match        https://th-managment.com/en/admin/backoffice/paymentsupport
// @match        https://my-managment.com/en/admin/backoffice/paymentsupport
// @match        https://managment.io//en/admin/backoffice/paymentsupport
// @match        https://th-managment.com/en/admin/backoffice/ExtendedPaymentRequestList
// @match        https://my-managment.com/en/admin/backoffice/ExtendedPaymentRequestList
// @match        https://managment.io//en/admin/backoffice/ExtendedPaymentRequestList
// @icon         https://raw.githubusercontent.com/DzyubanE/MENA-L2/refs/heads/main/apply-confirm.png
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const isDark = window._THEME === 'dark';
  const P = isDark ? {
    overlay1: 'rgba(1,4,9,0.55)', overlay2: 'rgba(1,4,9,0.65)',
    modalBg: '#1c2128', border: '#30363d', headerBorder: '#30363d',
    text: '#e6edf3', textDim: '#8b949e', textMuted: '#adb8c9',
    input: '#0d1117', panel: '#161b22',
    optHover: '#0d2a2d', optSelected: '#0d2a2d',
    radioChecked: '#0d2a2d', radioCheckedText: '#7fbbef',
    rmHoverBg: '#3a1414', rmHoverBorder: '#6b2626', rmHoverText: '#ea8886',
    addHoverBg: '#0d2429',
    backBorder: '#30363d', backBg: '#21262d', backText: '#c9d1d9',
    warnBg: '#3a2a08', warnBorder: '#a56c00', warnText: '#f0bc63',
  } : {
    overlay1: 'rgba(59,67,84,0.45)', overlay2: 'rgba(59,67,84,0.55)',
    modalBg: '#fcfcfd', border: '#dbdfe6', headerBorder: '#edeef2',
    text: '#3b4354', textDim: '#9fa8bc', textMuted: '#4f5b71',
    input: '#fff', panel: '#f6f7f8',
    optHover: '#f8feff', optSelected: '#edfbfc',
    radioChecked: '#edfbfc', radioCheckedText: '#2674ab',
    rmHoverBg: '#fce8e8', rmHoverBorder: '#f5c0c0', rmHoverText: '#ea8886',
    addHoverBg: '#f8feff',
    backBorder: '#bdc3d1', backBg: '#edeef2', backText: '#464f61',
    warnBg: '#fff8ed', warnBorder: '#ffa500', warnText: '#7a4f00',
  };

  const STATUSES_REQUIRE_TXN_IDS = ['219', '60', '221', '61', '225', '63', '231', '66'];
  const STATUSES_WITH_COMMENTS_IDS = ['209', '55', '207', '210', '90', '216', '98', '243', '72', '240', '97'];

  const COMMENTS_209 = [
    { label: 'Корректировка даты', full: 'Sir, please check the date and time. They have been corrected.', hasInput: false },
    { label: 'Другой субагент', full: 'Sir, please check this ticket. The payment was made to your wallet.', hasInput: false },
    { label: 'Корректировка суммы', full: 'Sir, please check the amount. It has been corrected.', hasInput: false },
    { label: 'Ошибка агента (найдено зачисление)', full: null, hasInput: true, inputPlaceholder: 'Номер транзакции', template: (val) => `Sir, please check ${val || '(вставьте транзакцию)'} and set the right status.` },
    { label: 'Ошибка агента (не найдено зачисление)', full: 'Sir, please attach the approved transaction related to the payment from the ticket or set the right status.', hasInput: false }
  ];

  const COMMENTS_207 = [
    { label: 'Ниже лимита', full: 'Sir, the amount is below the limit, please refund the money to the user and provide a screenshot.' },
    { label: 'Выше лимита', full: 'Sir, the amount is above the limit, please refund the money to the user and provide a screenshot.' }
  ];

  const COMMENTS_240 = [
    { label: 'Ожидание ответа из Передачи смены', full: 'waiting for agent' },
    { label: 'Ожидание ответа от старших / передача старшим', full: 'waiting for senior' },
    { label: 'Передача старшим для создания транзакции', full: 'waiting for NR' },
    { label: 'Агент дважды выставляет неверный статус без корректной информации', full: 'Waiting for TA' },
    { label: 'Не получается изменить субагента в Deposits Recalculation', full: 'Waiting for MN' }
  ];

  const COMMENT_243_TEMPLATE = (val) => `Credited to another account - ${val || '(номер транзакции)'}`;

  // ─── Копирование данных тикета ────────────────────────────────────────────

  const TICKET_COPY_EMPTY = '—';

  // Варианты комментария в первой строке. choices рисуются переключателями
  // внутри варианта, template собирает из них итоговый текст.
  const TICKET_COPY_COMMENTS = [
    { label: 'Без комментария', template: null },
    {
      label: 'Лимит + возврат из Request for a refund',
      choices: [
        { key: 'limit',  title: 'Сумма',       options: ['ниже лимита', 'выше лимита'] },
        { key: 'status', title: 'Вернулся в',  options: ['Received (M)', 'Approved (M)'] },
      ],
      template: (c) => `сумма ${c.limit}, уже ранее был в Request for a refund (M), вернулся в ${c.status} уточните, пожалуйста, получал ли агент средства?`,
    },
    {
      label: 'Подозрительный скриншот',
      template: () => 'уточните, пожалуйста, получал ли агент средства? Скриншот выглядит подозрительно.',
    },
  ];

  function statusId(status) {
    if (!status) return null;
    const m = status.match(/^(\d+)/);
    return m ? m[1] : null;
  }

  function statusMatches(status, ids) {
    const id = statusId(status);
    return id ? ids.includes(id) : false;
  }

  function withPrefix(text) {
    if (!text) return text;
    return '// ' + text;
  }

  const css = `
    .--cmt-trigger-wrap {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      width: 100%;
      margin: 8px 0 6px 0;
    }
    .--cmt-trigger-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: #32c2d2;
      color: #fff;
      font-family: Inter, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: background 0.18s, box-shadow 0.18s;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    .--cmt-trigger-btn:hover {
      background: #269eab;
      box-shadow: 0 3px 10px rgba(50,194,210,0.40);
    }
    .--cmt-trigger-btn svg { flex-shrink: 0; opacity: 0.9; }

    .--cmt-copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px solid ${P.backBorder};
      border-radius: 6px;
      background: ${P.backBg};
      color: ${P.backText};
      font-family: Inter, system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.02em;
      transition: border-color 0.18s, color 0.18s, background 0.18s;
    }
    .--cmt-copy-btn:hover { border-color: #32c2d2; color: #32c2d2; }
    .--cmt-copy-btn svg { flex-shrink: 0; opacity: 0.9; }

    #__cmt-modal .choice-block { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    #__cmt-modal .choice-block:last-child { margin-bottom: 0; }
    #__cmt-modal .choice-block > span.choice-title {
      font-size: 10px; color: ${P.textDim}; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    #__cmt-modal .choice-block .radio-row { margin-bottom: 0; }
    #__cmt-modal .preview-box.preview-multiline { font-size: 12px; line-height: 1.7; }
    #__cmt-modal .missing-box {
      margin-top: 10px; padding: 8px 11px; border-radius: 6px;
      background: ${P.warnBg}; border: 1px solid ${P.warnBorder};
      color: ${P.warnText}; font-size: 11px; line-height: 1.5;
    }
    #__cmt-modal button.btn-insert.copied { background: #3fb950; box-shadow: none; }

    #__cmt-overlay {
      position: fixed;
      inset: 0;
      background: ${P.overlay1};
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: ${P.text};
    }
    #__cmt-modal {
      background: ${P.modalBg};
      border-radius: 10px;
      border: 1px solid ${P.border};
      padding: 22px 26px;
      max-width: 480px;
      width: 92%;
      box-sizing: border-box;
      max-height: 90vh;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    #__cmt-modal .modal-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid ${P.headerBorder};
    }
    #__cmt-modal .modal-header-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #32c2d2;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #__cmt-modal h3 { margin: 0; font-size: 13px; font-weight: 600; color: ${P.text}; line-height: 1.3; }
    #__cmt-modal .modal-subtitle { font-size: 11px; color: ${P.textDim}; margin-top: 2px; }
    #__cmt-modal .section-label {
      font-size: 10px;
      font-weight: 700;
      color: ${P.textDim};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 14px 0 7px;
    }
    #__cmt-modal .comment-options { display: flex; flex-direction: column; gap: 5px; }
    #__cmt-modal .comment-option {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 9px 12px;
      border: 1px solid ${P.border};
      border-radius: 7px;
      cursor: pointer;
      background: ${P.input};
      text-align: left;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: ${P.text};
      line-height: 1.4;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
      position: relative;
    }
    #__cmt-modal .comment-option:hover { border-color: #32c2d2; background: ${P.optHover}; box-shadow: 0 2px 6px rgba(50,194,210,0.10); }
    #__cmt-modal .comment-option.selected { border-color: #32c2d2; background: ${P.optSelected}; }
    #__cmt-modal .comment-option.selected::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: #32c2d2;
      border-radius: 7px 0 0 7px;
    }
    #__cmt-modal .opt-label { font-weight: 600; color: ${P.text}; font-size: 12px; }
    #__cmt-modal .opt-preview { color: ${P.textDim}; font-size: 11px; margin-top: 3px; line-height: 1.5; font-family: Inter, system-ui, sans-serif; }
    #__cmt-modal .txn-input-wrap {
      display: none;
      flex-direction: column;
      gap: 4px;
      margin-top: 9px;
      padding-top: 9px;
      border-top: 1px dashed ${P.border};
    }
    #__cmt-modal .txn-input-wrap.visible { display: flex; }
    #__cmt-modal .txn-input-wrap label { font-size: 10px; color: ${P.textDim}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    #__cmt-modal .field-inp {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      border: 1px solid ${P.border};
      border-radius: 6px;
      font-family: Inter, system-ui, sans-serif;
      font-size: 12px;
      color: ${P.text};
      background: ${P.input};
      outline: none;
    }
    #__cmt-modal .field-inp:focus { border-color: #32c2d2; box-shadow: 0 0 0 2px rgba(50,194,210,0.12); }
    #__cmt-modal .preview-wrap {
      margin-top: 12px;
      border-radius: 7px;
      overflow: hidden;
      border: 1px solid ${P.border};
    }
    #__cmt-modal .preview-label {
      padding: 5px 10px;
      background: ${P.panel};
      font-size: 10px;
      font-weight: 700;
      color: ${P.textDim};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid ${P.border};
    }
    #__cmt-modal .preview-box {
      padding: 9px 11px;
      background: ${P.panel};
      font-size: 12px;
      color: ${P.text};
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
      min-height: 30px;
      font-family: Inter, system-ui, sans-serif;
    }
    #__cmt-modal .radio-row {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border: 1px solid ${P.border};
      border-radius: 7px;
      overflow: hidden;
    }
    #__cmt-modal .radio-row label {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      color: ${P.textDim};
      background: ${P.panel};
      transition: background 0.15s, color 0.15s;
      border-right: 1px solid ${P.border};
    }
    #__cmt-modal .radio-row label:last-child { border-right: none; }
    #__cmt-modal .radio-row input[type=radio] { display: none; }
    #__cmt-modal .radio-row label:has(input:checked) { background: ${P.radioChecked}; color: ${P.radioCheckedText}; font-weight: 600; }
    #__cmt-modal .ticket-ids { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
    #__cmt-modal .ticket-id-row { display: flex; gap: 6px; align-items: center; }
    #__cmt-modal .ticket-id-row input {
      flex: 1; padding: 6px 10px; border: 1px solid ${P.border}; border-radius: 6px;
      font-family: Inter, system-ui, sans-serif; font-size: 12px; color: ${P.text};
      background: ${P.input}; outline: none; box-sizing: border-box;
    }
    #__cmt-modal .ticket-id-row input:focus { border-color: #32c2d2; }
    #__cmt-modal .btn-rm {
      padding: 5px 9px; border: 1px solid ${P.border}; border-radius: 5px;
      background: ${P.panel}; color: ${P.textDim}; cursor: pointer; font-size: 14px;
      line-height: 1; font-family: Inter, system-ui, sans-serif; transition: all 0.15s;
    }
    #__cmt-modal .btn-rm:hover { background: ${P.rmHoverBg}; color: ${P.rmHoverText}; border-color: ${P.rmHoverBorder}; }
    #__cmt-modal .btn-add-ticket {
      padding: 5px 12px; border: 1px dashed ${P.backBorder}; border-radius: 6px;
      background: transparent; color: ${P.textDim}; cursor: pointer; font-size: 11px;
      font-family: Inter, system-ui, sans-serif; margin-bottom: 12px; transition: all 0.15s;
    }
    #__cmt-modal .btn-add-ticket:hover { border-color: #32c2d2; color: #32c2d2; background: ${P.addHoverBg}; }
    #__cmt-modal .txn-approved-wrap { display: none; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    #__cmt-modal .txn-approved-wrap.visible { display: flex; }
    #__cmt-modal .txn-approved-wrap label { font-size: 10px; color: ${P.textDim}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    #__cmt-modal .btn-row {
      display: flex; gap: 8px; justify-content: flex-end;
      margin-top: 16px; border-top: 1px solid ${P.headerBorder}; padding-top: 14px;
    }
    #__cmt-modal button.btn-back {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid ${P.backBorder}; background: ${P.backBg}; color: ${P.backText};
    }
    #__cmt-modal button.btn-insert {
      padding: 6px 18px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 600;
      cursor: pointer; border: none; background: #32c2d2; color: #fff;
      display: flex; align-items: center; gap: 5px;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    #__cmt-modal button:hover { opacity: 0.85; }

    #__apply-overlay {
      position: fixed; inset: 0; background: ${P.overlay2}; z-index: 999999;
      display: flex; align-items: center; justify-content: center;
      font-family: Inter, system-ui, sans-serif; font-size: 12px; color: ${P.text};
    }
    #__apply-modal {
      background: ${P.modalBg}; border-radius: 10px; border: 1px solid ${P.border};
      padding: 24px 28px; max-width: 400px; width: 92%; box-sizing: border-box;
    }
    #__apply-modal h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: ${P.text}; }
    #__apply-modal .info-box {
      padding: 9px 12px; background: ${P.panel}; border: 1px solid ${P.border};
      border-radius: 6px; font-size: 12px; color: ${P.textMuted}; margin-bottom: 14px; line-height: 1.6;
    }
    #__apply-modal .info-box strong { color: ${P.text}; }
    #__apply-modal .warn-box {
      padding: 10px 12px; background: ${P.warnBg}; border: 1px solid ${P.warnBorder};
      border-radius: 6px; color: ${P.warnText}; font-size: 12px; line-height: 1.5; margin-bottom: 14px;
    }
    #__apply-modal .warn-box strong { color: ${P.warnText}; }
    #__apply-modal .btn-row {
      display: flex; gap: 8px; justify-content: flex-end;
      border-top: 1px solid ${P.headerBorder}; padding-top: 14px; margin-top: 4px;
    }
    #__apply-modal button.btn-back {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid ${P.backBorder}; background: ${P.backBg}; color: ${P.backText};
    }
    #__apply-modal button.btn-confirm {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 600;
      cursor: pointer; border: none; background: #32c2d2; color: #fff;
      box-shadow: 0 2px 6px rgba(50,194,210,0.30);
    }
    #__apply-modal button.btn-force {
      padding: 6px 16px; border-radius: 6px; font-size: 12px;
      font-family: Inter, system-ui, sans-serif; font-weight: 500;
      cursor: pointer; border: 1px solid ${P.backBorder}; background: ${P.backBg}; color: ${P.backText};
    }
    #__apply-modal button:hover { opacity: 0.85; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ─── Хелперы ───────────────────────────────────────────────────────────────

  function mk(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function getSelectedStatus() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (!title || !title.textContent.trim().startsWith('Status')) continue;
      const sp = group.querySelector('.multiselect__single span');
      if (sp && sp.textContent.trim()) return sp.textContent.trim();
      const s = group.querySelector('.multiselect__single');
      if (s && s.textContent.trim()) return s.textContent.trim();
      const t = group.querySelector('.multiselect__tag span');
      if (t && t.textContent.trim()) return t.textContent.trim();
      return null;
    }
    return null;
  }

  function getTransactionId() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (!title || title.textContent.trim() !== 'Transaction ID') continue;
      const inp = group.querySelector('input[type="text"]');
      return inp ? inp.value.trim() : null;
    }
    return null;
  }

  function getCommentTextarea() {
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (title && title.textContent.trim() === 'Comment (internal)') {
        return group.querySelector('textarea');
      }
    }
    return null;
  }

  function appendComment(textarea, text) {
    if (!textarea || !text) return;
    textarea.value = textarea.value ? textarea.value + '\n' + text : text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isTargetApplyButton(el) {
    const btn = el.closest('button');
    if (!btn) return null;
    const label = btn.querySelector('.btn-label');
    const text = label ? label.textContent.trim() : btn.textContent.trim();
    if (text !== 'Apply') return null;
    const inputGroup = btn.closest('.input-group');
    if (!inputGroup || inputGroup.classList.contains('btn-block')) return null;
    const filterBlock = inputGroup.parentElement;
    if (!filterBlock || !filterBlock.classList.contains('filter') || !filterBlock.classList.contains('btn-block')) return null;
    const modalContent = btn.closest('.modal_content');
    if (!modalContent) return null;
    const modalTitle = modalContent.querySelector('.title');
    if (!modalTitle || !modalTitle.textContent.trim().startsWith('Change ticket')) return null;
    return btn;
  }

  // ─── Модалка комментария ───────────────────────────────────────────────────

  function removeCmtModal() {
    const el = document.getElementById('__cmt-overlay');
    if (el) el.remove();
  }

  function makePreviewWrap(initialText) {
    const wrap = mk('div', 'preview-wrap');
    const label = mk('div', 'preview-label'); label.textContent = 'Итоговый комментарий';
    const box = mk('div', 'preview-box'); box.textContent = initialText || '';
    wrap.appendChild(label); wrap.appendChild(box);
    return { wrap, box };
  }

  function makeSimpleOptions(items, modal, pvBox) {
    const optsWrap = mk('div', 'comment-options');
    let selectedFull = null;

    items.forEach((item) => {
      const optBtn = mk('button', 'comment-option');
      const optLabel = mk('div', 'opt-label'); optLabel.textContent = item.label;
      const optPreview = mk('div', 'opt-preview'); optPreview.textContent = withPrefix(item.full);
      optBtn.appendChild(optLabel);
      optBtn.appendChild(optPreview);
      optBtn.addEventListener('click', () => {
        optsWrap.querySelectorAll('.comment-option').forEach(o => o.classList.remove('selected'));
        optBtn.classList.add('selected');
        selectedFull = withPrefix(item.full);
        pvBox.textContent = selectedFull;
      });
      optsWrap.appendChild(optBtn);
    });

    modal.appendChild(optsWrap);
    return () => selectedFull;
  }

  function showCommentModal(status, textarea) {
    removeCmtModal();

    const overlay = mk('div'); overlay.id = '__cmt-overlay';
    const modal = mk('div'); modal.id = '__cmt-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const header = mk('div', 'modal-header');
    const iconWrap = mk('div', 'modal-header-icon');
    iconWrap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const headerText = mk('div');
    const h3 = mk('h3'); h3.textContent = 'Шаблонный комментарий';
    const sub = mk('div', 'modal-subtitle'); sub.textContent = status || '';
    headerText.appendChild(h3); headerText.appendChild(sub);
    header.appendChild(iconWrap); header.appendChild(headerText);
    modal.appendChild(header);

    let getComment = () => null;
    const sid = statusId(status);

    // ── 209 / 55 ──
    if (['209', '55'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Выберите вариант';
      modal.appendChild(lbl);

      const optsWrap = mk('div', 'comment-options');
      let selectedIdx = null;
      let txnInputEl = null;
      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');

      COMMENTS_209.forEach((item, i) => {
        const optBtn = mk('button', 'comment-option');
        const optLabel = mk('div', 'opt-label'); optLabel.textContent = item.label;
        const optPreview = mk('div', 'opt-preview');
        optPreview.textContent = withPrefix(item.hasInput ? item.template('') : item.full);
        optBtn.appendChild(optLabel); optBtn.appendChild(optPreview);

        if (item.hasInput) {
          const txnWrap = mk('div', 'txn-input-wrap');
          const txnLbl = mk('label'); txnLbl.textContent = 'Номер транзакции';
          txnInputEl = mk('input', 'field-inp');
          txnInputEl.type = 'text'; txnInputEl.placeholder = item.inputPlaceholder;
          txnInputEl.addEventListener('click', e => e.stopPropagation());
          txnInputEl.addEventListener('input', () => {
            const t = withPrefix(item.template(txnInputEl.value.trim()));
            optPreview.textContent = t;
            if (selectedIdx === i) pvBox.textContent = t;
          });
          txnWrap.appendChild(txnLbl); txnWrap.appendChild(txnInputEl);
          optBtn.appendChild(txnWrap);
        }

        optBtn.addEventListener('click', () => {
          optsWrap.querySelectorAll('.comment-option').forEach(o => {
            o.classList.remove('selected');
            const tw = o.querySelector('.txn-input-wrap');
            if (tw) tw.classList.remove('visible');
          });
          optBtn.classList.add('selected');
          selectedIdx = i;
          if (item.hasInput) {
            optBtn.querySelector('.txn-input-wrap').classList.add('visible');
            pvBox.textContent = withPrefix(item.template(txnInputEl ? txnInputEl.value.trim() : ''));
          } else {
            pvBox.textContent = withPrefix(item.full);
          }
        });

        optsWrap.appendChild(optBtn);
      });

      modal.appendChild(optsWrap);
      modal.appendChild(pvWrap);

      getComment = () => {
        if (selectedIdx === null) return null;
        const item = COMMENTS_209[selectedIdx];
        return item.hasInput ? withPrefix(item.template(txnInputEl ? txnInputEl.value.trim() : '')) : withPrefix(item.full);
      };
    }

    // ── 207 ──
    if (['207'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Выберите вариант';
      modal.appendChild(lbl);
      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');
      const getSelected = makeSimpleOptions(COMMENTS_207, modal, pvBox);
      modal.appendChild(pvWrap);
      getComment = getSelected;
    }

    // ── 210 / 90 ──
    if (['210', '90'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Original Ticket ID';
      modal.appendChild(lbl);

      const inp = mk('input', 'field-inp');
      inp.type = 'text'; inp.placeholder = 'Номер оригинального тикета';
      inp.style.marginBottom = '4px';

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap(withPrefix('Original Ticket — '));
      inp.addEventListener('input', () => {
        pvBox.textContent = withPrefix(`Original Ticket — ${inp.value.trim() || '(не указан)'}`);
      });

      modal.appendChild(inp); modal.appendChild(pvWrap);
      getComment = () => withPrefix(`Original Ticket — ${inp.value.trim() || '(не указан)'}`);
    }

    // ── 216 / 98 ──
    if (['216', '98'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Тип';
      modal.appendChild(lbl);

      const radioRow = mk('div', 'radio-row');
      function makeRadio(value, labelText, checked) {
        const l = mk('label');
        const r = mk('input'); r.type = 'radio'; r.name = '__216type'; r.value = value;
        if (checked) r.checked = true;
        const sp = mk('span'); sp.textContent = labelText;
        l.appendChild(r); l.appendChild(sp);
        return { l, r };
      }
      const { l: l1, r: r1 } = makeRadio('no', 'Нет одобренной транзакции', true);
      const { l: l2, r: r2 } = makeRadio('yes', 'Есть одобренная транзакция', false);
      radioRow.appendChild(l1); radioRow.appendChild(l2);
      modal.appendChild(radioRow);

      const txnApprWrap = mk('div', 'txn-approved-wrap');
      const txnApprLbl = mk('label'); txnApprLbl.textContent = 'Номер одобренной транзакции';
      const txnApprInp = mk('input', 'field-inp');
      txnApprInp.type = 'text'; txnApprInp.placeholder = 'например: 21078117761';
      txnApprWrap.appendChild(txnApprLbl); txnApprWrap.appendChild(txnApprInp);
      modal.appendChild(txnApprWrap);

      const ticketLbl = mk('div', 'section-label'); ticketLbl.textContent = 'Ticket ID';
      modal.appendChild(ticketLbl);

      const ticketContainer = mk('div', 'ticket-ids');
      modal.appendChild(ticketContainer);
      let ticketInputs = [];

      const btnAdd = mk('button', 'btn-add-ticket'); btnAdd.textContent = '+ Добавить тикет';
      modal.appendChild(btnAdd);

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');
      modal.appendChild(pvWrap);

      function update216() {
        const ids = ticketInputs.map(i => i.value.trim()).filter(Boolean);
        let raw;
        if (r2.checked) {
          raw = `To Antifraud / Spam of complaints with approved payment ${txnApprInp.value.trim() || '(номер транзакции)'} / ${ids.join(' / ') || '(тикеты)'}`;
        } else {
          raw = `To Antifraud / Who is the owner of payments? Received/Not Received / ${ids.join(' / ') || '(тикеты)'}`;
        }
        pvBox.textContent = withPrefix(raw);
      }

      function addTicketRow(val) {
        const row = mk('div', 'ticket-id-row');
        const inp = mk('input'); inp.type = 'text'; inp.placeholder = 'Ticket ID'; inp.value = val || '';
        inp.addEventListener('input', update216);
        ticketInputs.push(inp);
        const rm = mk('button', 'btn-rm'); rm.textContent = '×';
        rm.addEventListener('click', () => { ticketInputs = ticketInputs.filter(i => i !== inp); row.remove(); update216(); });
        row.appendChild(inp); row.appendChild(rm);
        ticketContainer.appendChild(row);
        update216();
      }

      addTicketRow('');
      btnAdd.addEventListener('click', () => addTicketRow(''));
      r1.addEventListener('change', () => { txnApprWrap.classList.remove('visible'); update216(); });
      r2.addEventListener('change', () => { txnApprWrap.classList.add('visible'); update216(); });
      txnApprInp.addEventListener('input', update216);
      update216();

      getComment = () => pvBox.textContent.trim();
    }

    // ── 243 / 72 ──
    if (['243', '72'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Номер транзакции';
      modal.appendChild(lbl);

      const inp = mk('input', 'field-inp');
      inp.type = 'text'; inp.placeholder = 'Номер транзакции';
      inp.style.marginBottom = '4px';

      const { wrap: pvWrap, box: pvBox } = makePreviewWrap(withPrefix(COMMENT_243_TEMPLATE('')));
      inp.addEventListener('input', () => {
        pvBox.textContent = withPrefix(COMMENT_243_TEMPLATE(inp.value.trim()));
      });

      modal.appendChild(inp); modal.appendChild(pvWrap);
      getComment = () => withPrefix(COMMENT_243_TEMPLATE(inp.value.trim()));
    }

    // ── 240 / 97 ──
    if (['240', '97'].includes(sid)) {
      const lbl = mk('div', 'section-label'); lbl.textContent = 'Выберите вариант';
      modal.appendChild(lbl);
      const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');
      const getSelected = makeSimpleOptions(COMMENTS_240, modal, pvBox);
      modal.appendChild(pvWrap);
      getComment = getSelected;
    }

    // Кнопки
    const btnRow = mk('div', 'btn-row');
    const backBtn = mk('button', 'btn-back'); backBtn.textContent = '← Назад';
    backBtn.addEventListener('click', removeCmtModal);
    btnRow.appendChild(backBtn);

    const insertBtn = mk('button', 'btn-insert');
    insertBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Вставить`;
    insertBtn.addEventListener('click', () => {
      const text = getComment();
      if (text) appendComment(textarea, text);
      removeCmtModal();
    });
    btnRow.appendChild(insertBtn);

    modal.appendChild(btnRow);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeCmtModal(); });
  }

  // ─── Данные тикета ────────────────────────────────────────────────────────

  // На странице может быть несколько .modal_content (история тикета и т.п.),
  // поэтому корень берём от самой кнопки, а не первый попавшийся в документе.
  function ticketModalRoot(el) {
    return (el && el.closest && el.closest('.modal_content'))
        || (getCommentTextarea() || {}).closest?.('.modal_content')
        || document.querySelector('.modal_content')
        || document;
  }

  // Заголовки приходят с &nbsp;, разным регистром и разными апострофами
  // (User's wallet / User’s wallet) — сравниваем по нормализованному виду.
  function normTitle(text) {
    return (text || '')
      .replace(/ /g, ' ')
      .replace(/[’‘`´]/g, "'")
      .replace(/:\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Ищем в модалке, а если не нашли — по всему документу: открытая
  // форма редактирования всё равно одна.
  function findGroup(root, title) {
    const wanted = normTitle(title);
    const scopes = root === document ? [document] : [root, document];
    for (const scope of scopes) {
      for (const group of scope.querySelectorAll('.input-group')) {
        const t = group.querySelector('.title');
        if (t && normTitle(t.textContent) === wanted) return group;
      }
    }
    return null;
  }

  function inputValueByTitle(root, title) {
    const group = findGroup(root, title);
    if (!group) return '';
    const inp = group.querySelector('input.mx-input, input[type="text"]:not(.multiselect__input)');
    return inp ? inp.value.trim() : '';
  }

  function selectValueByTitle(root, title) {
    const group = findGroup(root, title);
    if (!group) return '';
    const single = group.querySelector('.multiselect__single');
    return single ? single.textContent.trim() : '';
  }

  // Шапка тикета: <span class="success-txt"><strong>User ID:</strong> 1765155209</span>
  function headerValue(root, label) {
    const wanted = normTitle(label);
    const scopes = root === document ? [document] : [root, document];
    for (const scope of scopes) {
      for (const sp of scope.querySelectorAll('.success-txt')) {
        const strong = sp.querySelector('strong');
        if (!strong || normTitle(strong.textContent) !== wanted) continue;
        const value = sp.textContent.replace(strong.textContent, '').trim();
        if (value) return value;
      }
    }
    return '';
  }

  function collectTicketData(root) {
    return {
      subagent:    selectValueByTitle(root, 'Subagent') || headerValue(root, 'Subagent'),
      userId:      headerValue(root, 'User ID') || inputValueByTitle(root, 'User ID'),
      amount:      inputValueByTitle(root, 'Amount by receipt'),
      date:        inputValueByTitle(root, 'Payment creation date'),
      agentWallet: inputValueByTitle(root, 'Agent wallet'),
      userWallet:  inputValueByTitle(root, "User's wallet"),
    };
  }

  function buildTicketText(data, comment) {
    const v = (x) => x || TICKET_COPY_EMPTY;
    const head = comment ? `${v(data.subagent)} // ${comment}` : v(data.subagent);
    return [
      head,
      `User ID: ${v(data.userId)}`,
      `Amount: ${v(data.amount)}`,
      `Time of deposit: ${v(data.date)}`,
      `Agent wallet: ${v(data.agentWallet)}`,
      `User Wallet number: ${v(data.userWallet)}`,
    ].join('\n');
  }

  function missingFields(data) {
    return [
      ['Subagent', data.subagent],
      ['User ID', data.userId],
      ['Amount by receipt', data.amount],
      ['Payment creation date', data.date],
      ['Agent wallet', data.agentWallet],
      ["User's wallet", data.userWallet],
    ].filter(([, value]) => !value).map(([label]) => label);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => copyTextFallback(text));
    }
    return Promise.resolve(copyTextFallback(text));
  }

  function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* браузер запретил — текст остаётся в окне */ }
    ta.remove();
  }

  // ─── Модалка копирования данных тикета ────────────────────────────────────

  function showCopyModal(sourceEl) {
    const root = ticketModalRoot(sourceEl);
    const data = collectTicketData(root);

    removeCmtModal();

    const overlay = mk('div'); overlay.id = '__cmt-overlay';
    const modal = mk('div'); modal.id = '__cmt-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const header = mk('div', 'modal-header');
    const iconWrap = mk('div', 'modal-header-icon');
    iconWrap.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const headerText = mk('div');
    const h3 = mk('h3'); h3.textContent = 'Данные тикета';
    const sub = mk('div', 'modal-subtitle');
    const modalTitle = Array.from(root.querySelectorAll('.title'))
      .find(t => t.textContent.trim().startsWith('Change ticket'));
    sub.textContent = modalTitle ? modalTitle.textContent.trim() : '';
    headerText.appendChild(h3); headerText.appendChild(sub);
    header.appendChild(iconWrap); header.appendChild(headerText);
    modal.appendChild(header);

    const lbl = mk('div', 'section-label'); lbl.textContent = 'Комментарий';
    modal.appendChild(lbl);

    const optsWrap = mk('div', 'comment-options');
    modal.appendChild(optsWrap);

    const { wrap: pvWrap, box: pvBox } = makePreviewWrap('');
    pvBox.classList.add('preview-multiline');
    pvWrap.querySelector('.preview-label').textContent = 'Что будет скопировано';
    modal.appendChild(pvWrap);

    let selectedIdx = 0;
    const choiceRadios = new Map();   // индекс варианта → { key: [radio, ...] }

    function commentText() {
      const item = TICKET_COPY_COMMENTS[selectedIdx];
      if (!item || !item.template) return null;
      const values = {};
      (item.choices || []).forEach(ch => {
        const radios = (choiceRadios.get(selectedIdx) || {})[ch.key] || [];
        const checked = radios.find(r => r.checked);
        values[ch.key] = checked ? checked.value : ch.options[0];
      });
      return item.template(values);
    }

    function updatePreview() {
      pvBox.textContent = buildTicketText(data, commentText());
    }

    TICKET_COPY_COMMENTS.forEach((item, i) => {
      const optBtn = mk('button', 'comment-option');
      const optLabel = mk('div', 'opt-label'); optLabel.textContent = item.label;
      optBtn.appendChild(optLabel);

      if (item.template) {
        const optPreview = mk('div', 'opt-preview');
        const previewValues = {};
        (item.choices || []).forEach(ch => { previewValues[ch.key] = ch.options[0]; });
        optPreview.textContent = item.template(previewValues);
        optBtn.appendChild(optPreview);
      }

      if (item.choices) {
        const choicesWrap = mk('div', 'txn-input-wrap');
        const byKey = {};
        item.choices.forEach(ch => {
          const block = mk('div', 'choice-block');
          const title = mk('span', 'choice-title'); title.textContent = ch.title;
          const radioRow = mk('div', 'radio-row');
          byKey[ch.key] = ch.options.map((opt, oi) => {
            const l = mk('label');
            const r = mk('input');
            r.type = 'radio'; r.name = `__tc-${i}-${ch.key}`; r.value = opt;
            if (oi === 0) r.checked = true;
            r.addEventListener('change', updatePreview);
            const sp = mk('span'); sp.textContent = opt;
            l.appendChild(r); l.appendChild(sp);
            l.addEventListener('click', e => e.stopPropagation());
            radioRow.appendChild(l);
            return r;
          });
          block.appendChild(title); block.appendChild(radioRow);
          choicesWrap.appendChild(block);
        });
        choiceRadios.set(i, byKey);
        optBtn.appendChild(choicesWrap);
      }

      optBtn.addEventListener('click', () => {
        optsWrap.querySelectorAll('.comment-option').forEach(o => {
          o.classList.remove('selected');
          const cw = o.querySelector('.txn-input-wrap');
          if (cw) cw.classList.remove('visible');
        });
        optBtn.classList.add('selected');
        const own = optBtn.querySelector('.txn-input-wrap');
        if (own) own.classList.add('visible');
        selectedIdx = i;
        updatePreview();
      });

      if (i === selectedIdx) optBtn.classList.add('selected');
      optsWrap.appendChild(optBtn);
    });

    updatePreview();

    const missing = missingFields(data);
    if (missing.length) {
      const box = mk('div', 'missing-box');
      box.innerHTML = `⚠ Не заполнено: <strong>${missing.join(', ')}</strong>`;
      modal.appendChild(box);
    }

    const btnRow = mk('div', 'btn-row');
    const backBtn = mk('button', 'btn-back'); backBtn.textContent = '← Назад';
    backBtn.addEventListener('click', removeCmtModal);
    btnRow.appendChild(backBtn);

    const copyBtn = mk('button', 'btn-insert');
    const copyBtnHtml = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Копировать`;
    copyBtn.innerHTML = copyBtnHtml;
    copyBtn.addEventListener('click', () => {
      copyText(pvBox.textContent).then(() => {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Скопировано`;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = copyBtnHtml;
        }, 1500);
      });
    });
    btnRow.appendChild(copyBtn);

    modal.appendChild(btnRow);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeCmtModal(); });
  }

  // ─── Инжект кнопки над textarea ───────────────────────────────────────────

  function updateCommentButton() {
    let commentGroup = null;
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (title && title.textContent.trim() === 'Comment (internal)') {
        commentGroup = group; break;
      }
    }
    if (!commentGroup) return;

    const textarea = commentGroup.querySelector('textarea');
    if (!textarea) return;

    let wrap = commentGroup.querySelector('.--cmt-trigger-wrap');
    if (!wrap) {
      wrap = mk('div', '--cmt-trigger-wrap');
      const titleEl = commentGroup.querySelector('.title');
      if (titleEl && titleEl.nextSibling) {
        commentGroup.insertBefore(wrap, titleEl.nextSibling);
      } else {
        commentGroup.insertBefore(wrap, textarea);
      }
    }

    // Шаблонный комментарий — только для статусов из списка
    const hasTemplate = statusMatches(getSelectedStatus(), STATUSES_WITH_COMMENTS_IDS);
    const tplBtn = wrap.querySelector('.--cmt-trigger-btn');
    if (hasTemplate && !tplBtn) {
      const btn = mk('button', '--cmt-trigger-btn');
      btn.type = 'button';
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Добавить шаблонный комментарий`;
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        showCommentModal(getSelectedStatus(), textarea);
      });
      wrap.insertBefore(btn, wrap.firstChild);
    } else if (!hasTemplate && tplBtn) {
      tplBtn.remove();
    }

    // Копирование данных тикета — доступно всегда
    if (!wrap.querySelector('.--cmt-copy-btn')) {
      const copyBtn = mk('button', '--cmt-copy-btn');
      copyBtn.type = 'button';
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Копировать данные тикета`;
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        showCopyModal(copyBtn);
      });
      wrap.appendChild(copyBtn);
    }
  }

  // ─── Автоподстановка статуса ──────────────────────────────────────────────

  // Если Status пустой, при Apply подставляем первый доступный из списка:
  // в разных тикетах доступен либо 240, либо 97.
  const AUTO_STATUS_IDS = ['240', '97'];

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function multiselectValue(group) {
    const single = group.querySelector('.multiselect__single');
    return single ? single.textContent.trim() : '';
  }

  // В списке статусы подписаны названиями, но начинаются с номера,
  // поэтому ищем строку, которая начинается с нужного id.
  function optionMatchesId(text, id) {
    return new RegExp(`^\\s*${id}(\\D|$)`).test((text || '').trim());
  }

  async function selectStatusById(group, id) {
    const ms = group.querySelector('.multiselect');
    const search = group.querySelector('.multiselect__input');
    if (!ms || !search || ms.classList.contains('multiselect--disabled')) return null;

    search.focus();
    ms.dispatchEvent(new Event('focusin', { bubbles: true }));
    await delay(60);

    // ввод номера отфильтровывает список до нужного статуса
    search.value = id;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await delay(150);

    const option = Array.from(group.querySelectorAll('.multiselect__option'))
      .find(o => optionMatchesId(o.textContent, id));

    if (option) {
      ['mousedown', 'mouseup', 'click'].forEach(type => {
        option.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      });
      await delay(150);
    }

    if (search.value) {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    search.blur();
    ms.dispatchEvent(new Event('focusout', { bubbles: true }));
    await delay(60);

    const value = multiselectValue(group);
    return statusMatches(value, [id]) ? value : null;
  }

  async function autoSelectStatus(sourceEl) {
    const group = findGroup(ticketModalRoot(sourceEl), 'Status');
    if (!group || multiselectValue(group)) return null;
    for (const id of AUTO_STATUS_IDS) {
      const value = await selectStatusById(group, id);
      if (value) return value;
    }
    return null;
  }

  // ─── Модалка подтверждения Apply ──────────────────────────────────────────

  function removeApplyModal() {
    const el = document.getElementById('__apply-overlay');
    if (el) el.remove();
  }

  function doConfirm(btn) {
    btn.dataset.__bypass = '1';
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    delete btn.dataset.__bypass;
  }

  function showApplyModal(btn, status, txnId, autoStatus) {
    removeApplyModal();

    const overlay = mk('div'); overlay.id = '__apply-overlay';
    const modal = mk('div'); modal.id = '__apply-modal';
    overlay.appendChild(modal); document.body.appendChild(overlay);

    const txnMissing = (!txnId || txnId === '') && statusMatches(status, STATUSES_REQUIRE_TXN_IDS);
    const txnPresent = txnId && txnId !== '' && statusMatches(status, STATUSES_REQUIRE_TXN_IDS);

    const h3 = mk('h3'); h3.textContent = 'Подтверждение действия';
    modal.appendChild(h3);

    const infoBox = mk('div', 'info-box');
    if (txnPresent) {
      infoBox.innerHTML = `Отправить в Статус: <strong>${status}</strong><br>с Transaction ID — <strong>${txnId}</strong>`;
    } else {
      infoBox.innerHTML = `Статус: <strong>${status || '[не выбран]'}</strong>`;
    }
    modal.appendChild(infoBox);

    if (autoStatus) {
      const ab = mk('div', 'warn-box');
      ab.innerHTML = `Статус не был выбран — подставлен <strong>${autoStatus}</strong>. Если нужен другой, нажмите «Назад» и выберите вручную.`;
      modal.appendChild(ab);
    }

    if (txnMissing) {
      const wb = mk('div', 'warn-box');
      wb.innerHTML = `⚠ Поле <strong>Transaction ID</strong> не заполнено. Для статуса <strong>${status}</strong> это поле обязательно.`;
      modal.appendChild(wb);
    }

    const btnRow = mk('div', 'btn-row');
    const backBtn = mk('button', 'btn-back'); backBtn.textContent = '← Назад';
    backBtn.addEventListener('click', removeApplyModal);
    btnRow.appendChild(backBtn);

    if (txnMissing) {
      const forceBtn = mk('button', 'btn-force'); forceBtn.textContent = 'Всё равно отправить';
      forceBtn.addEventListener('click', () => { removeApplyModal(); doConfirm(btn); });
      btnRow.appendChild(forceBtn);
    } else {
      const confirmBtn = mk('button', 'btn-confirm'); confirmBtn.textContent = 'Да, отправить';
      confirmBtn.addEventListener('click', () => { removeApplyModal(); doConfirm(btn); });
      btnRow.appendChild(confirmBtn);
    }

    modal.appendChild(btnRow);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeApplyModal(); });
  }

  // ─── Перехват Apply ────────────────────────────────────────────────────────

  document.addEventListener('mousedown', (e) => {
    const btn = isTargetApplyButton(e.target);
    if (!btn) return;
    e.preventDefault();

    if (getSelectedStatus()) {
      showApplyModal(btn, getSelectedStatus(), getTransactionId());
      return;
    }
    // статус не выбран — сначала подставляем свой, потом спрашиваем
    autoSelectStatus(btn).then(autoStatus => {
      showApplyModal(btn, getSelectedStatus(), getTransactionId(), autoStatus);
    });
  }, true);

  document.addEventListener('click', (e) => {
    const btn = isTargetApplyButton(e.target);
    if (!btn) return;
    if (btn.dataset.__bypass) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ─── Превью вложений в окне редактирования ────────────────────────────────
  //
  // Тот же движок, что в плагине File Preview, но по ссылкам внутри модалки:
  // сам File Preview работает только по ячейкам таблицы.

  (function initModalFilePreview() {
    // ------------------------------------------------------------------
    // НАСТРОЙКИ
    // ------------------------------------------------------------------
    const CONFIG = {
      filePreview: {
        // Максимальная ширина картинки в попапе (px)
        maxWidth: 400,
        // Задержка перед скрытием попапа, чтобы успеть довести до него мышь (мс)
        hideDelay: 200,
        // Какие расширения считать картинками (для них доступен полноэкранный режим)
        imageExts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
        // Какие расширения считать видео (показывается иконка + имя файла)
        videoExts: ['mp4', 'webm', 'mov', 'avi'],
        // Масштабирование в полноэкранном режиме
        zoom: {
          // Во сколько раз меняется масштаб за одно деление колеса мыши
          step: 1.15,
          // Минимальный масштаб. 1 — картинка, вписанная в экран
          min: 1,
          // Предел увеличения
          max: 8,
        },
      },
      // Подробный лог в консоль (F12 → Console)
      debug: false,
    };

    // ------------------------------------------------------------------
    // ОБЩЕЕ
    // ------------------------------------------------------------------

    const isDark = window._THEME === 'dark';

    const T = isDark ? {
      bg: '#1C2128',
      border: '#30363D',
      text: '#C9D1D9',
      textStrong: '#E6EDF3',
      textDim: '#8B949E',
      imgBg: '#0D1117',
      shadow: '0 8px 24px rgba(0,0,0,0.45)',
    } : {
      bg: '#fff',
      border: '#DFE1E6',
      text: '#42526E',
      textStrong: '#172B4D',
      textDim: '#8993A4',
      imgBg: '#F7F8FA',
      shadow: '0 8px 24px rgba(0,0,0,0.18)',
    };

    const ACCENT = '#2ABFCF';
    const ACCENT_HOVER = '#1fa8b8';

    function log(...args) {
      if (CONFIG.debug) console.log('[EditHelper]', ...args);
    }

    function addStyle(id, css) {
      if (document.getElementById(id)) return false;
      const el = document.createElement('style');
      el.id = id;
      el.textContent = css;
      document.head.appendChild(el);
      return true;
    }

    // Держит элемент в пределах экрана: возвращает координаты левого верхнего угла
    function clampToViewport(left, top, width, height, margin) {
      const m = margin === undefined ? 12 : margin;
      if (left + width > window.innerWidth - m) left = window.innerWidth - width - m;
      if (left < m) left = m;
      if (top + height > window.innerHeight - m) top = window.innerHeight - height - m;
      if (top < m) top = m;
      return { left, top };
    }

    // ==================================================================
    // ПРЕВЬЮ ВЛОЖЕНИЙ ПРИ НАВЕДЕНИИ
    // ==================================================================

    function initFilePreview() {
      const CFG = CONFIG.filePreview;

      addStyle('eh-preview-style', `
        #eh-preview-popup {
          position: fixed;
          z-index: 99999;
          background: ${T.bg};
          border: .5px solid ${T.border};
          border-radius: 10px;
          box-shadow: ${T.shadow};
          overflow: hidden;
          pointer-events: none;
          display: none;
          opacity: 0;
          transition: opacity .15s;
          max-width: ${CFG.maxWidth}px;
          width: max-content;
        }
        #eh-preview-popup.visible {
          display: block;
          opacity: 1;
          pointer-events: auto;
        }
        #eh-preview-popup img {
          display: block;
          max-width: ${CFG.maxWidth}px;
          max-height: calc(100vh - 120px);
          width: auto;
          height: auto;
          object-fit: contain;
          background: ${T.imgBg};
        }
        .eh-preview-actions {
          display: flex;
          border-bottom: .5px solid rgba(255,255,255,0.2);
        }
        .eh-preview-btn {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-right: .5px solid rgba(255,255,255,0.2);
          background: ${ACCENT};
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          white-space: nowrap;
          transition: background .12s;
          text-decoration: none;
          letter-spacing: .02em;
        }
        .eh-preview-btn:last-child { border-right: none; }
        .eh-preview-btn:hover { background: ${ACCENT_HOVER}; }
        .eh-preview-btn svg { flex-shrink: 0; pointer-events: none; }
        .eh-preview-file-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
        }
        .eh-preview-file-name {
          font-size: 12px;
          color: ${T.text};
          font-weight: 500;
          word-break: break-all;
          max-width: 300px;
        }
        .eh-preview-loading {
          padding: 20px 24px;
          font-size: 11px;
          color: ${T.textDim};
          text-align: center;
          min-width: 160px;
        }
        #eh-lightbox {
          position: fixed;
          inset: 0;
          z-index: 999999;
          background: rgba(0,0,0,0.88);
          display: none;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
        }
        #eh-lightbox.open { display: flex; }
        #eh-lightbox-img-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 100vw;
          box-sizing: border-box;
          padding: 0 16px;
        }
        /* Сцена обрезает картинку при увеличении. Картинка позиционируется
           абсолютно и центрируется через transform — так её размер можно
           задавать скриптом, не ломая раскладку соседних стрелок. */
        #eh-lightbox-stage {
          flex: 1 1 auto;
          max-width: 88vw;
          height: 76vh;
          position: relative;
          overflow: hidden;
          touch-action: none;
        }
        #eh-lightbox img {
          position: absolute;
          left: 50%;
          top: 50%;
          /* Размер задаёт скрипт — см. applyTransform */
          max-width: none;
          max-height: none;
          border-radius: 6px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          display: block;
          transform-origin: center center;
          user-select: none;
          -webkit-user-drag: none;
        }
        #eh-lightbox img.zoomed { cursor: grab; }
        #eh-lightbox img.dragging { cursor: grabbing; }
        #eh-lightbox-toolbar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: .5px solid rgba(255,255,255,0.22);
        }
        .eh-lightbox-tool {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s;
          padding: 0;
        }
        .eh-lightbox-tool:hover:not(:disabled) { background: rgba(255,255,255,0.20); }
        .eh-lightbox-tool:disabled { opacity: .3; cursor: default; }
        .eh-lightbox-sep {
          width: 1px;
          height: 18px;
          background: rgba(255,255,255,0.22);
          margin: 0 3px;
        }
        #eh-lightbox-zoom-label {
          min-width: 48px;
          padding: 5px 2px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255,255,255,0.85);
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          transition: background .15s;
        }
        #eh-lightbox-zoom-label:hover { background: rgba(255,255,255,0.20); }
        .eh-lightbox-arrow {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: .5px solid rgba(255,255,255,0.3);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s;
          flex-shrink: 0;
        }
        .eh-lightbox-arrow:hover { background: rgba(255,255,255,0.28); }
        .eh-lightbox-arrow:disabled { opacity: 0.25; cursor: default; }
        #eh-lightbox-counter {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          text-align: center;
          min-height: 16px;
        }
        #eh-lightbox-close {
          position: absolute;
          top: 18px; right: 22px;
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: .5px solid rgba(255,255,255,0.3);
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .15s;
          z-index: 1;
        }
        #eh-lightbox-close:hover { background: rgba(255,255,255,0.28); }
      `);

      const ICON_FULLSCREEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      const ICON_NEW_TAB = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
      const ICON_PDF = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
      const ICON_VIDEO = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      const ICON_ROTATE_LEFT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`;
      const ICON_ROTATE_RIGHT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
      const ICON_ZOOM_IN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
      const ICON_ZOOM_OUT = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;

      const popup = document.createElement('div');
      popup.id = 'eh-preview-popup';
      document.body.appendChild(popup);

      // ── Полноэкранный просмотр ───────────────────────────────────────

      const lightbox = document.createElement('div');
      lightbox.id = 'eh-lightbox';

      const lbClose = document.createElement('button');
      lbClose.id = 'eh-lightbox-close';
      lbClose.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

      const lbWrap = document.createElement('div');
      lbWrap.id = 'eh-lightbox-img-wrap';

      const lbPrev = document.createElement('button');
      lbPrev.className = 'eh-lightbox-arrow';
      lbPrev.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

      const lbImg = document.createElement('img');

      const lbNext = document.createElement('button');
      lbNext.className = 'eh-lightbox-arrow';
      lbNext.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

      const lbStage = document.createElement('div');
      lbStage.id = 'eh-lightbox-stage';
      lbStage.appendChild(lbImg);

      const lbCounter = document.createElement('div');
      lbCounter.id = 'eh-lightbox-counter';

      // ── Панель поворота и масштаба ───────────────────────────────────

      const toolbar = document.createElement('div');
      toolbar.id = 'eh-lightbox-toolbar';

      function makeTool(title, icon) {
        const b = document.createElement('button');
        b.className = 'eh-lightbox-tool';
        b.title = title;
        b.innerHTML = icon;
        return b;
      }

      const btnRotateL = makeTool('Повернуть влево на 90°', ICON_ROTATE_LEFT);
      const btnRotateR = makeTool('Повернуть вправо на 90°', ICON_ROTATE_RIGHT);
      const btnZoomOut = makeTool('Уменьшить', ICON_ZOOM_OUT);
      const btnZoomIn = makeTool('Увеличить', ICON_ZOOM_IN);

      const zoomLabel = document.createElement('button');
      zoomLabel.id = 'eh-lightbox-zoom-label';
      zoomLabel.title = 'Сбросить поворот и масштаб';
      zoomLabel.textContent = '100%';

      const sep = document.createElement('div');
      sep.className = 'eh-lightbox-sep';

      toolbar.appendChild(btnRotateL);
      toolbar.appendChild(btnRotateR);
      toolbar.appendChild(sep);
      toolbar.appendChild(btnZoomOut);
      toolbar.appendChild(zoomLabel);
      toolbar.appendChild(btnZoomIn);

      lbWrap.appendChild(lbPrev);
      lbWrap.appendChild(lbStage);
      lbWrap.appendChild(lbNext);
      lightbox.appendChild(lbClose);
      lightbox.appendChild(lbWrap);
      lightbox.appendChild(toolbar);
      lightbox.appendChild(lbCounter);
      document.body.appendChild(lightbox);

      let lbUrls = [];
      let lbIndex = 0;

      // Состояние просмотра текущей картинки
      let rotation = 0;   // градусы, кратно 90
      let zoom = 1;       // масштаб, заданный пользователем
      let panX = 0;       // сдвиг перетаскиванием, в пикселях экрана
      let panY = 0;

      // Пересчитывает размер и положение картинки.
      //
      // Размер задаётся в вёрстке (width/height), а не через transform: scale.
      // Это принципиально для чёткости: браузер растрирует картинку один раз
      // в её вёрстанном размере, и scale потом растягивает уже готовый растр,
      // не обращаясь к оригиналу. Вписанный в экран скриншот 2400px шириной
      // растрируется, скажем, в 912px — и при увеличении мы видим растянутые
      // 912px вместо настоящих 2400px. Если же менять именно вёрстанный
      // размер, браузер каждый раз растрирует заново из полноразмерного
      // оригинала, и вся детализация файла доходит до экрана.
      //
      // Растр крупнее натурального разрешения смысла не имеет — новых деталей
      // там взяться неоткуда, а память он съедает быстро. Поэтому вёрстанный
      // размер ограничен оригиналом, а всё, что сверх него, догоняется
      // через scale.
      function applyTransform() {
        const natW = lbImg.naturalWidth;
        const natH = lbImg.naturalHeight;
        // Пока новая картинка не загрузилась, размеры относятся к предыдущей
        if (!natW || !natH || !lbImg.complete) return;

        const stageW = lbStage.clientWidth;
        const stageH = lbStage.clientHeight;
        const upright = rotation % 180 === 0;

        // Во сколько раз ужать картинку, чтобы она целиком влезла в сцену
        // с учётом поворота. Мелкие картинки не растягиваем.
        const fit = Math.min(
          1,
          stageW / (upright ? natW : natH),
          stageH / (upright ? natH : natW)
        );

        // Размер, который картинка должна занять на экране
        const dispW = natW * fit * zoom;
        const dispH = natH * fit * zoom;

        const layoutW = Math.min(dispW, natW);
        const layoutH = layoutW * natH / natW;
        const extra = layoutW > 0 ? dispW / layoutW : 1;

        lbImg.style.width = layoutW + 'px';
        lbImg.style.height = layoutH + 'px';

        // Габарит на экране с учётом поворота — по нему ограничиваем сдвиг,
        // чтобы картинку нельзя было утащить за её собственные края
        const screenW = upright ? dispW : dispH;
        const screenH = upright ? dispH : dispW;
        const maxX = Math.max(0, (screenW - stageW) / 2);
        const maxY = Math.max(0, (screenH - stageH) / 2);
        panX = Math.min(maxX, Math.max(-maxX, panX));
        panY = Math.min(maxY, Math.max(-maxY, panY));

        // Порядок важен: -50% центрирует картинку в сцене, затем сдвиг
        // считается в координатах экрана и не «переворачивается» вместе
        // с картинкой, и только потом идут поворот и остаточный масштаб.
        lbImg.style.transform =
          `translate(-50%, -50%) translate(${Math.round(panX)}px, ${Math.round(panY)}px)`
          + ` rotate(${rotation}deg) scale(${extra.toFixed(4)})`;

        lbImg.classList.toggle('zoomed', zoom > 1);
        zoomLabel.textContent = Math.round(zoom * 100) + '%';
        btnZoomOut.disabled = zoom <= CFG.zoom.min + 1e-6;
        btnZoomIn.disabled = zoom >= CFG.zoom.max - 1e-6;
        updateCounter();
      }

      function resetView() {
        rotation = 0;
        zoom = 1;
        panX = 0;
        panY = 0;
        applyTransform();
      }

      function rotateBy(delta) {
        rotation = (rotation + delta + 360) % 360;
        // После поворота картинка перекладывается заново — сдвиг от прошлой
        // ориентации оказался бы бессмысленным
        panX = 0;
        panY = 0;
        applyTransform();
      }

      // cx, cy — точка, которая должна остаться на месте, в координатах
      // относительно центра сцены. Без них масштабируем от центра.
      function setZoom(next, cx, cy) {
        const clamped = Math.min(CFG.zoom.max, Math.max(CFG.zoom.min, next));
        if (Math.abs(clamped - zoom) < 1e-6) return;
        if (cx !== undefined) {
          const k = clamped / zoom;
          panX = cx - k * (cx - panX);
          panY = cy - k * (cy - panY);
        }
        zoom = clamped;
        applyTransform();
      }

      function stageCenterOffset(e) {
        const rect = lbStage.getBoundingClientRect();
        return {
          x: e.clientX - (rect.left + rect.width / 2),
          y: e.clientY - (rect.top + rect.height / 2),
        };
      }

      // Показываем разрешение файла: сразу видно, мелкий ли это оригинал,
      // если картинка выглядит нечёткой при увеличении
      function updateCounter() {
        const parts = [];
        if (lbUrls.length > 1) parts.push(`${lbIndex + 1} / ${lbUrls.length}`);
        if (lbImg.complete && lbImg.naturalWidth) {
          parts.push(`${lbImg.naturalWidth}×${lbImg.naturalHeight}`);
        }
        lbCounter.textContent = parts.join('  ·  ');
      }

      function updateLightbox() {
        lbImg.src = lbUrls[lbIndex];
        lbPrev.disabled = lbIndex === 0;
        lbNext.disabled = lbIndex === lbUrls.length - 1;
        lbPrev.style.visibility = lbUrls.length > 1 ? 'visible' : 'hidden';
        lbNext.style.visibility = lbUrls.length > 1 ? 'visible' : 'hidden';
        updateCounter();
        // Новая картинка — новый лист: поворот и масштаб сбрасываются
        resetView();
      }

      function openLightbox(urls, startIndex) {
        lbUrls = urls;
        lbIndex = startIndex || 0;
        updateLightbox();
        lightbox.classList.add('open');
      }

      function closeLightbox() {
        lightbox.classList.remove('open');
        lbImg.src = '';
        resetView();
      }

      // Размер картинки известен только после загрузки — тогда и считаем вписывание
      lbImg.addEventListener('load', applyTransform);
      window.addEventListener('resize', () => {
        if (lightbox.classList.contains('open')) applyTransform();
      });

      lbPrev.addEventListener('click', e => {
        e.stopPropagation();
        if (lbIndex > 0) { lbIndex--; updateLightbox(); }
      });
      lbNext.addEventListener('click', e => {
        e.stopPropagation();
        if (lbIndex < lbUrls.length - 1) { lbIndex++; updateLightbox(); }
      });
      lbClose.addEventListener('click', e => { e.stopPropagation(); closeLightbox(); });

      btnRotateL.addEventListener('click', e => { e.stopPropagation(); rotateBy(-90); });
      btnRotateR.addEventListener('click', e => { e.stopPropagation(); rotateBy(90); });
      btnZoomIn.addEventListener('click', e => { e.stopPropagation(); setZoom(zoom * CFG.zoom.step); });
      btnZoomOut.addEventListener('click', e => { e.stopPropagation(); setZoom(zoom / CFG.zoom.step); });
      zoomLabel.addEventListener('click', e => { e.stopPropagation(); resetView(); });

      // ── Масштабирование колесом мыши ─────────────────────────────────

      lightbox.addEventListener('wheel', e => {
        if (!lightbox.classList.contains('open')) return;
        // Иначе прокрутится страница под лайтбоксом
        e.preventDefault();
        const { x, y } = stageCenterOffset(e);
        setZoom(e.deltaY < 0 ? zoom * CFG.zoom.step : zoom / CFG.zoom.step, x, y);
      }, { passive: false });

      // ── Перетаскивание увеличенной картинки ──────────────────────────

      let dragging = false;
      let dragMoved = false;
      let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

      lbImg.addEventListener('mousedown', e => {
        if (zoom <= 1) return;
        e.preventDefault();
        dragging = true;
        dragMoved = false;
        dragStart = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
        lbImg.classList.add('dragging');
      });

      window.addEventListener('mousemove', e => {
        if (!dragging) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
        panX = dragStart.panX + dx;
        panY = dragStart.panY + dy;
        applyTransform();
      });

      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        lbImg.classList.remove('dragging');
      });

      lightbox.addEventListener('click', e => {
        // Если мышь отпустили за пределами картинки после перетаскивания,
        // клик всплывает до фона — закрывать лайтбокс в этом случае не нужно
        if (dragMoved) { dragMoved = false; return; }
        if (e.target === lightbox) closeLightbox();
      });

      lbImg.addEventListener('dblclick', e => { e.stopPropagation(); resetView(); });

      document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft' && lbIndex > 0) { lbIndex--; updateLightbox(); }
        if (e.key === 'ArrowRight' && lbIndex < lbUrls.length - 1) { lbIndex++; updateLightbox(); }
      });

      // ── Разбор ссылок ────────────────────────────────────────────────

      function getExt(path) {
        return (path.split('?')[0].split('.').pop() || '').toLowerCase();
      }

      function getFileName(path) {
        try {
          return decodeURIComponent(path.split('?')[0].split('/').pop() || path);
        } catch (e) {
          return path.split('?')[0].split('/').pop() || path;
        }
      }

      function isImage(path) { return CFG.imageExts.includes(getExt(path)); }
      function isVideo(path) { return CFG.videoExts.includes(getExt(path)); }
      function isPdf(path) { return getExt(path) === 'pdf'; }
      function isPreviewable(path) { return isImage(path) || isPdf(path) || isVideo(path); }

      // Ссылка может вести на вьюер вида /viewer?url=<реальный путь>.
      // Тип файла определяем по реальному пути, а открываем — исходную ссылку.
      function resolveFileUrl(anchor) {
        const href = anchor.getAttribute('href') || '';
        try {
          const abs = new URL(href, window.location.origin);
          const urlParam = abs.searchParams.get('url');
          if (urlParam) return { previewUrl: href, filePath: decodeURIComponent(urlParam) };
        } catch (e) { /* относительный или битый href — используем как есть */ }
        return { previewUrl: href, filePath: href };
      }

      // Все картинки из того же списка файлов — чтобы листать их в полноэкранном
      // режиме. В модалке это <ul class="file-preview">, в таблице — ячейка.
      function getCellImageUrls(anchor) {
        const group = anchor.closest('ul, td, .input-group');
        if (!group) return [];
        return Array.from(group.querySelectorAll('a'))
          .map(a => resolveFileUrl(a))
          .filter(({ filePath }) => isImage(filePath))
          .map(({ previewUrl }) => previewUrl);
      }

      // ── Сборка попапа ────────────────────────────────────────────────

      function makeActions(anchor, previewUrl, withFullscreen) {
        const bar = document.createElement('div');
        bar.className = 'eh-preview-actions';

        if (withFullscreen) {
          const btnFull = document.createElement('button');
          btnFull.className = 'eh-preview-btn';
          btnFull.innerHTML = `${ICON_FULLSCREEN} Fullscreen`;
          btnFull.addEventListener('click', e => {
            e.stopPropagation();
            const urls = getCellImageUrls(anchor);
            const startIdx = urls.indexOf(previewUrl);
            openLightbox(urls.length ? urls : [previewUrl], startIdx >= 0 ? startIdx : 0);
          });
          bar.appendChild(btnFull);
        }

        const btnTab = document.createElement('a');
        btnTab.className = 'eh-preview-btn';
        btnTab.href = previewUrl;
        btnTab.target = '_blank';
        btnTab.rel = 'noopener noreferrer';
        btnTab.innerHTML = `${ICON_NEW_TAB} Open in new tab`;
        bar.appendChild(btnTab);

        return bar;
      }

      function makeFileRow(icon, fileName) {
        const wrap = document.createElement('div');
        wrap.className = 'eh-preview-file-wrap';
        wrap.innerHTML = icon;
        const name = document.createElement('span');
        name.className = 'eh-preview-file-name';
        name.textContent = fileName;
        wrap.appendChild(name);
        return wrap;
      }

      let currentHref = null;
      let currentAnchor = null;
      let hideTimer = null;
      // Счётчик поколений: если мышь ушла на другую ссылку, пока грузилась картинка,
      // её onload не должен подставить чужое изображение в попап.
      let loadGeneration = 0;

      function positionPopup() {
        if (!currentAnchor) return;
        const rect = currentAnchor.getBoundingClientRect();
        const popW = popup.offsetWidth || CFG.maxWidth;
        const popH = popup.offsetHeight || 300;

        // Пробуем справа от ссылки, если не влезает — слева
        let left = rect.right + 12;
        if (left + popW > window.innerWidth - 12) left = rect.left - popW - 12;

        const pos = clampToViewport(left, rect.top, popW, popH, 12);
        popup.style.left = pos.left + 'px';
        popup.style.top = pos.top + 'px';
      }

      function buildPopup(anchor) {
        popup.innerHTML = '';
        const { previewUrl, filePath } = resolveFileUrl(anchor);

        if (isImage(filePath)) {
          popup.appendChild(makeActions(anchor, previewUrl, true));

          const loading = document.createElement('div');
          loading.className = 'eh-preview-loading';
          loading.textContent = 'Loading...';
          popup.appendChild(loading);

          const myGeneration = ++loadGeneration;
          const img = new Image();
          img.onload = () => {
            if (myGeneration !== loadGeneration) return;
            loading.remove();
            popup.appendChild(img);
            positionPopup();
          };
          img.onerror = () => {
            if (myGeneration !== loadGeneration) return;
            loading.textContent = 'Не удалось загрузить файл';
          };
          img.src = previewUrl;

        } else if (isPdf(filePath)) {
          popup.appendChild(makeActions(anchor, previewUrl, false));
          popup.appendChild(makeFileRow(ICON_PDF, getFileName(filePath)));

        } else if (isVideo(filePath)) {
          popup.appendChild(makeActions(anchor, previewUrl, false));
          popup.appendChild(makeFileRow(ICON_VIDEO, getFileName(filePath)));
        }
      }

      function showPopup(anchor) {
        const href = anchor.getAttribute('href') || '';
        if (!href) return;
        const { filePath } = resolveFileUrl(anchor);
        if (!isPreviewable(filePath)) return;

        clearTimeout(hideTimer);
        currentAnchor = anchor;

        if (href !== currentHref) {
          currentHref = href;
          buildPopup(anchor);
          positionPopup();
        }

        popup.classList.add('visible');
      }

      function hidePopup() {
        hideTimer = setTimeout(() => {
          popup.classList.remove('visible');
          loadGeneration++;
          currentHref = null;
          currentAnchor = null;
          setTimeout(() => {
            if (!popup.classList.contains('visible')) popup.innerHTML = '';
          }, 150);
        }, CFG.hideDelay);
      }

      // Пока мышь на самом попапе — не прячем, иначе до кнопок не дойти
      popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      popup.addEventListener('mouseleave', hidePopup);

      // Только ссылки внутри модалки: в таблице тем же занимается File Preview,
      // и два попапа на одной ссылке мешали бы друг другу.
      function modalAnchor(target) {
        if (!(target instanceof Element)) return null;
        const anchor = target.closest('a');
        if (!anchor || anchor.closest('td')) return null;
        return anchor.closest('.modal_content') ? anchor : null;
      }

      document.addEventListener('mouseover', e => {
        const anchor = modalAnchor(e.target);
        if (anchor) showPopup(anchor);
      });

      document.addEventListener('mouseout', e => {
        const anchor = modalAnchor(e.target);
        if (anchor) hidePopup();
      });

      log('Превью вложений включено');
    }

    // ==================================================================
    // ЗАПУСК
    // ==================================================================

    if (document.body) {
      initFilePreview();
    } else {
      document.addEventListener('DOMContentLoaded', initFilePreview, { once: true });
    }
  })();

  // ─── MutationObserver ─────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    if (document.querySelector('.modal_content')) updateCommentButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
