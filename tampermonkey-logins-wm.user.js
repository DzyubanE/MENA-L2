// ==UserScript==
// @name         Логины WM → ЧЛ_Обучение (Pay_mena)
// @namespace    team-bestie
// @version      2026-11-06
// @description  Забирает пары «Pay_mena ↔ логин» со страницы «Логины в Webmanagement» и заполняет Pay_mena в чек-листах обучения и в графике. В таблицах работает в фоне, на странице Confluence — по кнопке.
// @author       You
// @match        https://doc.office.lan/spaces/MENA/pages/495715993/*
// @match        https://doc.office.lan/pages/viewpage.action?pageId=495715993*
// @match        https://docs.google.com/spreadsheets/d/1ZB6oPJGF4mxNTeRPdPPyIFrWLg0Ev6KP0xXDQ-s9cio/*
// @match        https://docs.google.com/spreadsheets/d/1IRcafvYl-3co57vrBF00KI44Lfz5GGQM8ty5aZKxiZo/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      doc.office.lan
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // URL веб-приложения Apps Script (заканчивается на /exec) и тот же токен, что в CONFIG.TOKEN
  const WEBAPP_URL = 'https://script.google.com/a/macros/mailbox366.com/s/AKfycbx5W3fd4mDFJzFSVE7yE6lRQ9Ff8UhwYXb0L6U6cigKvaL10qmPJEceNnxN6fT-bSgA/exec';
  const TOKEN = 'САФОНОВ';

  const CONFLUENCE = 'https://doc.office.lan';
  const PAGE_ID = '495715993';
  const PAGE_URL = CONFLUENCE + '/spaces/MENA/pages/' + PAGE_ID;
  const SYNC_EVERY_MIN = 30;   // как часто обновлять данные, пока таблица открыта

  const IS_SHEET = location.hostname === 'docs.google.com';

  const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();


  /* ─────────────── Разбор таблиц ─────────────── */

  // matrix: [таблица][строка][ячейка] = текст → [[логин, значение слева, статус], ...]
  function rowsFromMatrix(matrix) {
    const out = [];
    const seen = new Set();

    matrix.forEach((trs) => {
      if (trs.length < 2) return;
      const loginIdx = trs[0].map((t) => t.toLowerCase()).findIndex((t) => t.startsWith('логин'));
      if (loginIdx < 1) return; // нет столбца «Логин» или слева от него пусто

      trs.slice(1).forEach((cells) => {
        if (cells.length <= loginIdx) return;
        const left = cells[loginIdx - 1];
        const status = cells[loginIdx + 1] || '';
        if (!left) return;

        // в одной ячейке бывает несколько логинов: «BogushAL, bogush.al»
        cells[loginIdx].split(/[\s,;/]+/).filter(Boolean).forEach((login) => {
          const key = login.toLowerCase() + '|' + left;
          if (seen.has(key)) return;
          seen.add(key);
          out.push([login, left, status]);
        });
      });
    });

    return out;
  }

  // Страница Confluence открыта — читаем живой DOM
  function rowsFromDocument() {
    const root = document.querySelector('#main-content') || document.body;
    const matrix = Array.from(root.querySelectorAll('table')).map((table) =>
      Array.from(table.rows).map((tr) => Array.from(tr.cells).map((c) => clean(c.textContent)))
    );
    return rowsFromMatrix(matrix);
  }

  // Фоновая загрузка — разбираем HTML строкой.
  // DOMParser и innerHTML в Google Таблицах заблокированы политикой Trusted Types.
  function rowsFromHtml(html) {
    const decode = (s) => s
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const cellText = (cell) => clean(decode(cell.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')));

    const matrix = (html.match(/<table[\s>][\s\S]*?<\/table>/gi) || []).map((table) =>
      (table.match(/<tr[\s>][\s\S]*?<\/tr>/gi) || []).map((tr) =>
        (tr.match(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi) || []).map(cellText)
      )
    );
    return rowsFromMatrix(matrix);
  }


  /* ─────────────── Сеть ─────────────── */

  function request(opts) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest(Object.assign({
        timeout: 90000,
        onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(r) : reject(new Error('HTTP ' + r.status))),
        onerror: () => reject(new Error('нет связи с ' + new URL(opts.url).hostname)),
        ontimeout: () => reject(new Error(new URL(opts.url).hostname + ' не ответил за 90 секунд')),
      }, opts));
    });
  }

  async function loadRowsFromConfluence() {
    // 1. REST API: только тело страницы, без обвязки
    try {
      const r = await request({ method: 'GET', url: CONFLUENCE + '/rest/api/content/' + PAGE_ID + '?expand=body.view' });
      const rows = rowsFromHtml(JSON.parse(r.responseText).body.view.value);
      if (rows.length) return rows;
    } catch (e) { /* пробуем саму страницу */ }

    // 2. Сама страница
    const r = await request({ method: 'GET', url: PAGE_URL });
    const rows = rowsFromHtml(r.responseText);
    if (!rows.length) throw new Error('не удалось прочитать страницу Confluence — проверьте, что вы вошли в doc.office.lan в этом браузере');
    return rows;
  }

  async function postRows(rows) {
    if (!WEBAPP_URL) throw new Error('URL веб-приложения не указан в скрипте');
    const r = await request({
      method: 'POST',
      url: WEBAPP_URL,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ token: TOKEN, rows }),
    });
    let data;
    try {
      data = JSON.parse(r.responseText);
    } catch (e) {
      throw new Error('веб-приложение вернуло не JSON — проверьте доступ к нему («У кого есть доступ: Все») и что развёрнута новая версия');
    }
    if (!data.ok) throw new Error('ошибка веб-приложения: ' + data.error);
    return data;
  }


  /* ─────────────── Отчёт ─────────────── */

  function formatReport(d, total) {
    const lines = ['✅ Заполнено: ' + d.filled.length + '  ·  строк со страницы: ' + total];
    if (d.filled.length) lines.push(d.filled.join('\n'));
    if (d.conflicts.length) lines.push('\n⚠️ Не перезаписано (в ячейке уже другое значение): ' + d.conflicts.length + '\n' + d.conflicts.join('\n'));
    if (d.notFound.length) lines.push('\n❌ Логина нет на странице: ' + d.notFound.length + '\n' + d.notFound.join('\n'));
    if (d.skipped && d.skipped.length) lines.push('\nℹ️ Пропущены листы без столбца pay_mena: ' + d.skipped.join(', '));
    if (d.missingSheets.length) lines.push('\n❌ Не найдены листы: ' + d.missingSheets.join(', '));
    if (d.errors && d.errors.length) lines.push('\n❌ ' + d.errors.join('\n❌ '));
    return lines.join('\n');
  }


  /* ─────────────── Интерфейс (без innerHTML — в Google Таблицах он запрещён) ─────────────── */

  const css = `
    #lwm-panel { position: fixed; right: 20px; bottom: 20px; z-index: 99999;
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      font-family: 'Manrope', 'Segoe UI', Roboto, sans-serif; }
    #lwm-panel.lwm-sheet { bottom: 44px; }
    #lwm-panel .lwm-row { display: flex; gap: 6px; }
    #lwm-panel button { border: 0; border-radius: 8px; padding: 9px 14px; cursor: pointer;
      font: 600 13px/1.2 inherit; box-shadow: 0 4px 14px rgba(9,30,66,.18);
      transition: background-color .15s ease, transform .1s ease; }
    #lwm-panel button:active { transform: translateY(1px); }
    #lwm-panel button:disabled { opacity: .6; cursor: progress; }
    #lwm-send { background: #0052CC; color: #fff; }
    #lwm-send:hover { background: #0747A6; }
    #lwm-copy { background: #fff; color: #0052CC; border: 1px solid rgba(0,82,204,.25) !important; }
    #lwm-copy:hover { background: #F4F9FF; }
    #lwm-result { display: none; position: relative; max-width: 460px; max-height: 50vh; overflow: auto;
      white-space: pre-wrap; padding: 14px 34px 14px 16px; border-radius: 12px;
      font: 400 13px/1.55 inherit; color: #172B4D; background: #fff;
      border: 1px solid rgba(9,30,66,.12); box-shadow: 0 12px 28px rgba(9,30,66,.18); }
    #lwm-result.ok    { border-left: 4px solid #36B37E; }
    #lwm-result.warn  { border-left: 4px solid #FFAB00; }
    #lwm-result.error { border-left: 4px solid #DE350B; }
    #lwm-close { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; padding: 0 !important;
      background: none !important; box-shadow: none !important; color: #7A869A; font-size: 16px !important; }
    html[data-color-mode="dark"] #lwm-result { background: #22272b; color: #b6c2cf; border-color: rgba(255,255,255,.12); }
    html[data-color-mode="dark"] #lwm-copy { background: #22272b; color: #8cb4ff; border-color: rgba(87,157,255,.35) !important; }
    html[data-color-mode="dark"] #lwm-copy:hover { background: #2b3137; }
  `;

  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const resultText = el('div');
  const closeBtn = el('button', { id: 'lwm-close', title: 'Закрыть', textContent: '×' });
  const resultBox = el('div', { id: 'lwm-result' }, [closeBtn, resultText]);
  const panel = el('div', { id: 'lwm-panel', className: IS_SHEET ? 'lwm-sheet' : '' }, [resultBox]);
  document.body.appendChild(panel);

  let hideTimer = null;
  function showResult(text, kind, autoHideSec) {
    clearTimeout(hideTimer);
    resultText.textContent = text;
    resultBox.className = kind || '';
    resultBox.style.display = 'block';
    if (autoHideSec) hideTimer = setTimeout(() => { resultBox.style.display = 'none'; }, autoHideSec * 1000);
  }
  closeBtn.addEventListener('click', () => { clearTimeout(hideTimer); resultBox.style.display = 'none'; });


  /* ─────────────── Режим 1: страница Confluence (кнопки) ─────────────── */

  function initPageMode() {
    const copyBtn = el('button', { id: 'lwm-copy', textContent: 'Копировать',
      title: 'Скопировать пары «логин — Pay_mena» для вставки в лист «Логины WM»' });
    const sendBtn = el('button', { id: 'lwm-send', textContent: 'Заполнить таблицу',
      title: 'Отправить данные в таблицу и заполнить столбец F' });
    panel.appendChild(el('div', { className: 'lwm-row' }, [copyBtn, sendBtn]));

    function copy(rows, reason) {
      const tsv = [['Логин', 'Pay_mena', 'Статус']].concat(rows).map((r) => r.join('\t')).join('\n');
      GM_setClipboard(tsv, 'text');
      showResult(
        (reason ? '⚠️ ' + reason + '\n\n' : '') +
        '📋 Скопировано строк: ' + rows.length + '.\n\n' +
        '1. Откройте лист «Логины WM» (если его нет — создайте).\n' +
        '2. Встаньте в ячейку A1 и вставьте (Ctrl+V).\n' +
        '3. Запустите меню Логины WM → Заполнить Pay_mena.',
        reason ? 'warn' : 'ok'
      );
    }

    copyBtn.addEventListener('click', () => copy(rowsFromDocument(), ''));

    sendBtn.addEventListener('click', async () => {
      const rows = rowsFromDocument();
      if (!rows.length) { showResult('❌ На странице не найдено таблиц со столбцом «Логин».', 'error'); return; }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Отправляю…';
      try {
        const data = await postRows(rows);
        GM_setValue('lastSync', Date.now());
        showResult(formatReport(data, rows.length), 'ok');
      } catch (e) {
        copy(rows, e.message.charAt(0).toUpperCase() + e.message.slice(1) + '.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Заполнить таблицу';
      }
    });
  }


  /* ─────────────── Режим 2: Google Таблица (фон) ─────────────── */

  let syncing = false;

  async function sync(manual) {
    if (syncing) return;
    syncing = true;
    GM_setValue('lastSync', Date.now()); // сразу, чтобы соседние вкладки не запускали вторую синхронизацию
    if (manual) showResult('⏳ Загружаю страницу «Логины в Webmanagement»…', 'warn');
    try {
      const rows = await loadRowsFromConfluence();
      const data = await postRows(rows);
      const hasErrors = data.errors && data.errors.length;
      if (data.filled.length || data.conflicts.length || hasErrors || manual) {
        const kind = hasErrors ? 'error' : (data.conflicts.length ? 'warn' : 'ok');
        showResult('Pay_mena · ' + formatReport(data, rows.length), kind, manual || hasErrors ? 0 : 15);
      }
    } catch (e) {
      GM_setValue('lastSync', Date.now() - (SYNC_EVERY_MIN - 5) * 60000); // при ошибке повторить через 5 минут
      showResult('❌ Pay_mena: ' + e.message, 'error');
    } finally {
      syncing = false;
    }
  }

  function maybeSync() {
    const elapsed = Date.now() - (GM_getValue('lastSync', 0) || 0);
    if (elapsed >= SYNC_EVERY_MIN * 60000) sync(false);
  }

  function initSheetMode() {
    GM_registerMenuCommand('Обновить Pay_mena сейчас', () => sync(true));
    setTimeout(maybeSync, 3000);          // дать таблице загрузиться
    setInterval(maybeSync, 60 * 1000);    // проверка раз в минуту, запуск — раз в SYNC_EVERY_MIN
  }


  if (IS_SHEET) initSheetMode();
  else initPageMode();
})();
