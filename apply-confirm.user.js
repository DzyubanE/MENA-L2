// ==UserScript==
// @name         Edit Helper Team B BETA
// @namespace    http://tampermonkey.net/
// @version      1.0.9
// @updateURL    https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @downloadURL  https://github.com/DzyubanE/MENA-L2/raw/refs/heads/main/apply-confirm.user.js
// @description  Двойное подтверждение + шаблоны комментариев
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
      display: block;
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

  // ─── Инжект кнопки над textarea ───────────────────────────────────────────

  function updateCommentButton() {
    const status = getSelectedStatus();
    const hasTemplate = statusMatches(status, STATUSES_WITH_COMMENTS_IDS);

    let commentGroup = null;
    for (const group of document.querySelectorAll('.input-group')) {
      const title = group.querySelector('.title');
      if (title && title.textContent.trim() === 'Comment (internal)') {
        commentGroup = group; break;
      }
    }
    if (!commentGroup) return;

    const existing = commentGroup.querySelector('.--cmt-trigger-wrap');
    if (!hasTemplate) { if (existing) existing.remove(); return; }
    if (existing) return;

    const textarea = commentGroup.querySelector('textarea');
    if (!textarea) return;

    const wrap = mk('div', '--cmt-trigger-wrap');
    const btn = mk('button', '--cmt-trigger-btn');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Добавить шаблонный комментарий`;
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      showCommentModal(getSelectedStatus(), textarea);
    });
    wrap.appendChild(btn);

    const titleEl = commentGroup.querySelector('.title');
    if (titleEl && titleEl.nextSibling) {
      commentGroup.insertBefore(wrap, titleEl.nextSibling);
    } else {
      commentGroup.insertBefore(wrap, textarea);
    }
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

  function showApplyModal(btn, status, txnId) {
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
    showApplyModal(btn, getSelectedStatus(), getTransactionId());
  }, true);

  document.addEventListener('click', (e) => {
    const btn = isTargetApplyButton(e.target);
    if (!btn) return;
    if (btn.dataset.__bypass) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ─── MutationObserver ─────────────────────────────────────────────────────

  const observer = new MutationObserver(() => {
    if (document.querySelector('.modal_content')) updateCommentButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
