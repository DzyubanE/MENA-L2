// ==UserScript==
// @name         IR Time → МСК (время со скриншотов Ирана)
// @namespace    team-bestie
// @version      2026-10-12
// @description  Распознаёт иранские дату и время на скриншотах (персидские цифры, солнечный календарь) и переводит в московское время
// @author       You
// @match        https://*.th-managment.com/*
// @match        https://*.my-managment.com/*
// @match        https://*.managment.io/*
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* =========================================================
     НАСТРОЙКИ
     ========================================================= */
  const CFG = {
    SOURCE_TZ: 'Asia/Tehran',       // время на скриншотах
    TARGET_TZ: 'Europe/Moscow',     // куда переводим (МСК, UTC+3, без перехода на летнее время)
    TARGET_LABEL: 'МСК',            // подпись в кнопке и панели
    LANGS: 'fas+eng',               // персидский + английский
    UPSCALE: 2,                     // увеличение перед OCR — точнее, но медленнее
    MAX_SIDE: 4000,                 // предел стороны после увеличения
    MIN_IMG: 200,                   // минимальная ширина картинки (натуральная), на которой показываем кнопку
    IDLE_MS: 60000,                 // через сколько простоя выгружать OCR из памяти
    LOW_CONF: 70,                   // ниже этой уверенности OCR строка помечается
  };

  /* =========================================================
     ЦИФРЫ И РАЗБОР ТЕКСТА
     ========================================================= */

  // Персидские (۰-۹) и арабские (٠-٩) цифры → латинские, убираем RTL-маркеры
  function normDigits(s) {
    return String(s || '')
      .replace(/[\u06F0-\u06F9]/g, ch => String(ch.charCodeAt(0) - 0x06F0))
      .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/\uFF1A/g, ':');
  }

  const RE_TIME = /(?<!\d)([01]?\d|2[0-3])\s?:\s?([0-5]\d)(?:\s?:\s?([0-5]\d))?(?!\d)/g;
  const RE_YMD = /(?<!\d)(1[34]\d{2}|20\d{2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{1,2})(?!\d)/;
  const RE_DMY = /(?<!\d)(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(1[34]\d{2}|20\d{2})(?!\d)/;

  // ق.ظ = до полудня, ب.ظ = после полудня (OCR часто теряет точки)
  const RE_PM = /ب\s*\.?\s*ظ|بعد\s*از\s*ظهر|\bPM\b/i;
  const RE_AM = /ق\s*\.?\s*ظ|قبل\s*از\s*ظهر|\bAM\b/i;

  function validDate(cal, y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    if (cal === 'jalali') return d <= (m <= 6 ? 31 : 30);
    return d <= 31;
  }

  function parseDate(text) {
    let m = text.match(RE_YMD), y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = text.match(RE_DMY))) { y = +m[3]; mo = +m[2]; d = +m[1]; }
    else return null;
    const cal = y < 1600 ? 'jalali' : 'greg';
    if (!validDate(cal, y, mo, d)) return null;
    const [gy, gm, gd] = cal === 'jalali' ? jalaliToGregorian(y, mo, d) : [y, mo, d];
    return { cal, y, m: mo, d, gy, gm, gd, raw: m[0] };
  }

  function parseTimes(text) {
    const out = [];
    const pm = RE_PM.test(text), am = RE_AM.test(text);
    RE_TIME.lastIndex = 0;
    let m;
    while ((m = RE_TIME.exec(text))) {
      let h = +m[1];
      if (pm && h < 12) h += 12;
      if (am && h === 12) h = 0;
      out.push({ h, mi: +m[2], s: m[3] != null ? +m[3] : null, raw: m[0] });
    }
    return out;
  }

  /* =========================================================
     КАЛЕНДАРЬ И ЧАСОВЫЕ ПОЯСА
     ========================================================= */

  // Солнечная хиджра (иранский календарь) → григорианский
  function jalaliToGregorian(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    const ml = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13 && gd > ml[gm]; gm++) gd -= ml[gm];
    return [gy, gm, gd];
  }

  const partsFmtCache = {};
  function zoneParts(tz, utcMs) {
    const f = partsFmtCache[tz] || (partsFmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    const p = {};
    f.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = +x.value; });
    return p;
  }

  function tzOffsetMin(tz, utcMs) {
    const p = zoneParts(tz, utcMs);
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs) / 60000;
  }

  // Время «на часах» в поясе tz → момент UTC (учитывает исторические переходы на летнее время)
  function wallToUtc(tz, y, m, d, h, mi, s) {
    const guess = Date.UTC(y, m - 1, d, h, mi, s || 0);
    let utc = guess - tzOffsetMin(tz, guess) * 60000;
    utc = guess - tzOffsetMin(tz, utc) * 60000;
    return utc;
  }

  const pad = n => String(n).padStart(2, '0');

  function formatTarget(utcMs, withSeconds) {
    const p = zoneParts(CFG.TARGET_TZ, utcMs);
    const off = tzOffsetMin(CFG.TARGET_TZ, utcMs);
    const sign = off >= 0 ? '+' : '−';
    const oh = Math.floor(Math.abs(off) / 60), om = Math.abs(off) % 60;
    const zone = 'UTC' + sign + oh + (om ? ':' + pad(om) : '');
    const time = pad(p.hour) + ':' + pad(p.minute) + (withSeconds ? ':' + pad(p.second) : '');
    return { date: pad(p.day) + '.' + pad(p.month) + '.' + p.year, time, zone };
  }

  /* =========================================================
     ИЗВЛЕЧЕНИЕ ДАТЫ/ВРЕМЕНИ ИЗ РЕЗУЛЬТАТА OCR
     ========================================================= */

  function getLines(data) {
    if (Array.isArray(data.lines) && data.lines.length) return data.lines;
    const out = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => out.push(l))));
    if (!out.length && data.text) data.text.split('\n').forEach(t => out.push({ text: t, bbox: null, confidence: data.confidence }));
    return out;
  }

  function extract(lines) {
    const parsed = lines.map((l, i) => {
      const text = normDigits(l.text).trim();
      return { i, line: l, text, date: parseDate(text), times: parseTimes(text) };
    });
    const dated = parsed.filter(p => p.date);

    const now = zoneParts(CFG.SOURCE_TZ, Date.now());
    const items = [];
    const seen = new Set();

    parsed.forEach(p => {
      p.times.forEach(tm => {
        let date = p.date, dateSrc = 'line';
        if (!date && dated.length) {
          date = dated.reduce((a, b) => (Math.abs(b.i - p.i) < Math.abs(a.i - p.i) ? b : a)).date;
          dateSrc = 'near';
        }
        if (!date) {
          date = { cal: 'greg', gy: now.year, gm: now.month, gd: now.day, raw: '' };
          dateSrc = 'today';
        }
        const key = date.gy + '-' + date.gm + '-' + date.gd + ' ' + tm.h + ':' + tm.mi + ':' + tm.s;
        if (seen.has(key)) return;
        seen.add(key);

        const utc = wallToUtc(CFG.SOURCE_TZ, date.gy, date.gm, date.gd, tm.h, tm.mi, tm.s);
        const srcTime = pad(tm.h) + ':' + pad(tm.mi) + (tm.s != null ? ':' + pad(tm.s) : '');
        const gregStr = pad(date.gd) + '.' + pad(date.gm) + '.' + date.gy;
        const jalStr = date.cal === 'jalali' ? date.y + '/' + pad(date.m) + '/' + pad(date.d) : '';

        items.push({
          srcTime, gregStr, jalStr, dateSrc,
          target: formatTarget(utc, tm.s != null),
          bbox: p.line.bbox || null,
          conf: Math.round(p.line.confidence || 0),
          rawLine: p.line.text || '',
        });
      });
    });
    return items;
  }

  /* =========================================================
     ЗАГРУЗКА И ПОДГОТОВКА ИЗОБРАЖЕНИЯ
     ========================================================= */

  function fetchBlob(url) {
    if (/^(blob|data):/.test(url)) return fetch(url).then(r => r.blob());
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, responseType: 'blob', timeout: 30000,
        onload: r => (r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error('Файл не загрузился: HTTP ' + r.status))),
        onerror: () => reject(new Error('Сетевая ошибка при загрузке файла')),
        ontimeout: () => reject(new Error('Файл грузится слишком долго')),
      });
    });
  }

  async function prepare(blob) {
    let bmp;
    try { bmp = await createImageBitmap(blob); }
    catch (e) { throw new Error('Файл не является изображением'); }

    const k = Math.max(1, Math.min(CFG.UPSCALE, CFG.MAX_SIDE / Math.max(bmp.width, bmp.height)));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();

    // Оттенки серого; тёмные скриншоты инвертируем — OCR лучше читает тёмное на светлом
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      sum += g;
    }
    if (sum / (d.length / 4) < 110) {
      for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, cw: c.width, ch: c.height };
  }

  /* =========================================================
     OCR: один воркер, очередь, выгрузка при простое
     ========================================================= */

  let workerP = null, idleTimer = null, chain = Promise.resolve(), progressCb = null;

  function getWorker() {
    if (typeof Tesseract === 'undefined') {
      return Promise.reject(new Error('Tesseract.js не загрузился. Проверьте доступ к cdn.jsdelivr.net'));
    }
    if (!workerP) {
      workerP = Tesseract.createWorker(CFG.LANGS, 1, {
        logger: m => progressCb && progressCb(m),
      }).catch(e => { workerP = null; throw e; });
    }
    return workerP;
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(async () => {
      const p = workerP;
      workerP = null;
      if (p) { try { (await p).terminate(); } catch (e) { /* уже выгружен */ } }
    }, CFG.IDLE_MS);
  }

  function ocr(canvas) {
    const job = chain.then(async () => {
      clearTimeout(idleTimer);
      try {
        const w = await getWorker();
        const res = await w.recognize(canvas, {}, { text: true, blocks: true });
        return res.data;
      } finally {
        scheduleIdle();
      }
    });
    chain = job.catch(() => {});
    return job;
  }

  /* =========================================================
     ИНТЕРФЕЙС
     ========================================================= */

  GM_addStyle(`
    .irt-btn{position:fixed;z-index:2147483646;display:none;font:600 12px/1 'Segoe UI',Roboto,sans-serif;
      padding:7px 10px;border:0;border-radius:6px;background:#0052CC;color:#fff;cursor:pointer;
      box-shadow:0 2px 8px rgba(9,30,66,.25)}
    .irt-btn:hover{background:#0747A6}
    .irt-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:400px;max-height:65vh;overflow:auto;
      background:#fff;color:#172B4D;border:1px solid rgba(9,30,66,.14);border-radius:12px;
      box-shadow:0 12px 28px rgba(9,30,66,.18);font:13px/1.45 'Segoe UI',Roboto,sans-serif}
    .irt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;
      border-bottom:1px solid #EBECF0;position:sticky;top:0;background:#fff}
    .irt-title{font-weight:700;font-size:13px}
    .irt-x{border:0;background:none;font-size:18px;line-height:1;color:#5E6C84;cursor:pointer;padding:2px 6px;border-radius:6px}
    .irt-x:hover{background:#F4F5F7;color:#172B4D}
    .irt-body{padding:10px 14px 12px}
    .irt-status{color:#5E6C84}
    .irt-err{color:#AE2A19;background:#FFEDEB;border-radius:6px;padding:8px 10px}
    .irt-row{padding:8px 0;border-bottom:1px solid #EBECF0}
    .irt-row:last-child{border-bottom:0}
    .irt-src{color:#44546F}
    .irt-dst{display:flex;align-items:center;gap:8px;margin-top:2px;font-size:15px;font-weight:700}
    .irt-zone{font-size:11px;font-weight:600;color:#5E6C84}
    .irt-copy{margin-left:auto;border:1px solid #DFE1E6;background:#fff;border-radius:6px;padding:3px 8px;
      font-size:11px;color:#0052CC;cursor:pointer}
    .irt-copy:hover{border-color:#0052CC}
    .irt-note{margin-top:3px;font-size:11px;color:#974F0C}
    .irt-raw{margin-top:3px;font-size:11px;color:#7A869A;direction:auto;word-break:break-word}
    .irt-low{color:#AE2A19}
    .irt-details{margin-top:8px;font-size:11px;color:#5E6C84}
    .irt-details pre{white-space:pre-wrap;direction:auto;background:#F4F5F7;border-radius:6px;padding:8px;margin:6px 0 0;max-height:160px;overflow:auto}
    .irt-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483645}
    .irt-badge{position:fixed;pointer-events:auto;font:700 11px/1 'Segoe UI',Roboto,sans-serif;padding:3px 6px;
      border-radius:4px;background:#0052CC;color:#fff;white-space:nowrap;box-shadow:0 1px 4px rgba(9,30,66,.3)}
  `);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---------- Панель результатов ---------- */
  let panel = null;

  function openPanel() {
    if (!panel) {
      panel = el('div', 'irt-panel');
      const head = el('div', 'irt-head');
      head.append(el('div', 'irt-title', 'Иран → ' + CFG.TARGET_LABEL));
      const x = el('button', 'irt-x', '×');
      x.title = 'Закрыть';
      x.onclick = () => { panel.remove(); panel = null; clearBadges(); };
      head.append(x);
      panel.append(head, el('div', 'irt-body'));
      document.body.append(panel);
    }
    const body = panel.querySelector('.irt-body');
    return {
      status(t) { body.replaceChildren(el('div', 'irt-status', t)); },
      error(t) { body.replaceChildren(el('div', 'irt-err', t)); },
      render(items, fullText) { renderItems(body, items, fullText); },
    };
  }

  const DATE_NOTES = {
    near: 'Дата взята из соседней строки скриншота',
    today: 'Даты на скриншоте не найдено — взята сегодняшняя дата',
  };

  function renderItems(body, items, fullText) {
    body.replaceChildren();
    if (!items.length) {
      body.append(el('div', 'irt-status', 'Время на скриншоте не найдено.'));
    }
    items.forEach(it => {
      const row = el('div', 'irt-row');
      const src = el('div', 'irt-src',
        'Иран: ' + (it.jalStr ? it.jalStr + ' (' + it.gregStr + ')' : it.gregStr) + ', ' + it.srcTime);
      const dst = el('div', 'irt-dst');
      const value = it.target.date + ', ' + it.target.time;
      dst.append(el('span', null, '→ ' + value), el('span', 'irt-zone', it.target.zone));
      const copy = el('button', 'irt-copy', 'Копировать');
      copy.onclick = () => {
        navigator.clipboard.writeText(value).then(() => {
          copy.textContent = 'Скопировано';
          setTimeout(() => { copy.textContent = 'Копировать'; }, 1200);
        });
      };
      dst.append(copy);
      row.append(src, dst);
      if (DATE_NOTES[it.dateSrc]) row.append(el('div', 'irt-note', '⚠️ ' + DATE_NOTES[it.dateSrc]));
      const raw = el('div', 'irt-raw' + (it.conf < CFG.LOW_CONF ? ' irt-low' : ''),
        'OCR: «' + it.rawLine.trim() + '» · уверенность ' + it.conf + '%');
      row.append(raw);
      body.append(row);
    });
    const det = el('details', 'irt-details');
    det.append(el('summary', null, 'Весь распознанный текст'), el('pre', null, fullText || ''));
    body.append(det);
  }

  /* ---------- Бейджи поверх картинки ---------- */
  let layer = null, badgeState = null, rafId = 0;

  function clearBadges() {
    badgeState = null;
    if (layer) { layer.remove(); layer = null; }
  }

  function drawBadges(img, items, cw, ch) {
    clearBadges();
    const withBox = items.filter(i => i.bbox);
    if (!withBox.length) return;
    layer = el('div', 'irt-layer');
    const badges = withBox.map(it => {
      const b = el('div', 'irt-badge', '→ ' + it.target.time);
      b.title = it.target.date + ', ' + it.target.time + ' ' + it.target.zone;
      layer.append(b);
      return { b, bbox: it.bbox };
    });
    document.body.append(layer);
    badgeState = { img, badges, cw, ch };
    positionBadges();
  }

  function positionBadges() {
    if (!badgeState) return;
    const { img, badges, cw, ch } = badgeState;
    if (!img.isConnected) { clearBadges(); return; }
    const r = img.getBoundingClientRect();
    const visible = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    const sx = r.width / cw, sy = r.height / ch;
    badges.forEach(({ b, bbox }) => {
      b.style.display = visible ? '' : 'none';
      b.style.left = Math.round(r.left + bbox.x1 * sx + 4) + 'px';
      b.style.top = Math.round(r.top + bbox.y0 * sy) + 'px';
    });
  }

  function queueReposition() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; positionBadges(); });
  }
  addEventListener('scroll', queueReposition, true);
  addEventListener('resize', queueReposition);

  /* ---------- Запуск распознавания ---------- */
  const cache = new Map();

  async function start(src, imgEl) {
    if (!src) return;
    const ui = openPanel();
    clearBadges();

    if (cache.has(src)) {
      const c = cache.get(src);
      ui.render(c.items, c.text);
      if (imgEl) drawBadges(imgEl, c.items, c.cw, c.ch);
      return;
    }

    try {
      ui.status('Загружаю изображение…');
      const blob = await fetchBlob(src);
      const prep = await prepare(blob);

      ui.status('Готовлю распознавание…');
      progressCb = m => {
        const pct = m.progress ? ' ' + Math.round(m.progress * 100) + '%' : '';
        if (/load|initializ/i.test(m.status)) ui.status('Загружаю модель распознавания…' + pct);
        else if (/recogniz/i.test(m.status)) ui.status('Распознаю текст…' + pct);
      };
      const data = await ocr(prep.canvas);
      progressCb = null;

      const items = extract(getLines(data));
      cache.set(src, { items, text: data.text, cw: prep.cw, ch: prep.ch });
      ui.render(items, data.text);
      if (imgEl) drawBadges(imgEl, items, prep.cw, prep.ch);
    } catch (e) {
      progressCb = null;
      ui.error(e && e.message ? e.message : String(e));
    }
  }

  /* ---------- Кнопка при наведении на картинку ---------- */
  const btn = el('button', 'irt-btn', '🕐 Иран → ' + CFG.TARGET_LABEL);
  btn.title = 'Распознать иранское время на скриншоте';
  document.documentElement.append(btn);
  let hoverImg = null, hideTimer = null;

  function isCandidate(img) {
    if (!img.complete || img.naturalWidth < CFG.MIN_IMG || img.naturalHeight < 60) return false;
    if (img.closest('.irt-panel')) return false;
    const r = img.getBoundingClientRect();
    return r.width >= 60 && r.height >= 40;
  }

  function placeBtn(img) {
    const r = img.getBoundingClientRect();
    btn.style.display = 'block';
    const w = btn.offsetWidth;
    btn.style.top = Math.max(4, r.top + 6) + 'px';
    btn.style.left = Math.max(4, Math.min(innerWidth - w - 4, r.right - w - 6)) + 'px';
  }

  function hideBtnSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { btn.style.display = 'none'; hoverImg = null; }, 250);
  }

  document.addEventListener('mouseover', e => {
    const img = e.target instanceof Element ? e.target.closest('img') : null;
    if (img && isCandidate(img)) {
      clearTimeout(hideTimer);
      hoverImg = img;
      placeBtn(img);
    }
  }, true);

  document.addEventListener('mouseout', e => {
    if (e.target === hoverImg || e.target === btn) hideBtnSoon();
  }, true);

  btn.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (hoverImg) start(hoverImg.currentSrc || hoverImg.src, hoverImg);
    btn.style.display = 'none';
  });

  addEventListener('scroll', () => { btn.style.display = 'none'; }, true);

  /* ---------- Alt+клик по ссылке на файл или по картинке ---------- */
  document.addEventListener('click', e => {
    if (!e.altKey || !(e.target instanceof Element)) return;
    const img = e.target.closest('img');
    const a = e.target.closest('a[href]');
    if (!img && !a) return;
    e.preventDefault();
    e.stopPropagation();
    if (img && isCandidate(img)) start(img.currentSrc || img.src, img);
    else if (a) start(a.href, null);
  }, true);
})();
