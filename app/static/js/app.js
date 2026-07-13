/* =========================================================================
   РАСПИСАНИЕ — клиент (production build, v2)

   Основные особенности:
   • Островковый layout: колонка «пара» (всегда 7 слотов) + столбцы-острова
     групп. Каждый остров = вертикальный список карточек-пар, соединённых
     пунктирной линией. Между парами и между островами — отступы.
   • Пагинация групп по горизонтали (N групп на страницу) + прогресс-бар,
     показывающий сколько страниц ещё осталось.
   • Плавные Apple-style анимации переключения страниц и панелей.
   • Дизайнерская анимация смены Колледж ↔ Высшее образование: заголовок
     улетает в одну сторону, новый прилетает с другой.
   • SSE-обновления + polling-fallback + автоматический reconnect с backoff.
   • Автосмена дня в полночь + guard раз в минуту.
   • F11 — фуллскрин (плюс отдельная кнопка в шапке).
   • M — показать/скрыть верхнее меню (работает на любой раскладке).
   • Клик по дате открывает системный date-picker.
   • Подсветка текущей пары — по времени, пастельно-сиреневая.
   • Автозамены названий выполняются на СТОРОНЕ СЕРВЕРА (клиент только
     форматирует уже нормализованные строки).
   ========================================================================= */
(() => {
  'use strict';

  const boot = window.__BOOT__ || {};

  // -------------------------------------------------------------------------
  // Глобальное состояние
  // -------------------------------------------------------------------------
  const state = {
    config: null,
    configVersion: -1,
    data: null,
    range: { start: null, end: null, period: boot.default_period || 'day' },

    pageIndex:  { college: 0, university: 0 },
    pageTotal:  { college: 1, university: 1 },
    activePanel: 'university',
    groupsPerPage: 3,

    // Таймеры/анимации
    pageTimer:      null,
    nowTickTimer:   null,
    dayGuardTimer:  null,
    midnightTimer:  null,
    autoScrollAnim: {},
    fallbackPollTimer: null,
    sseSource: null,
    sseReconnectAttempt: 0,
    sseReconnectTimer: null,

    // Прочее
    currentDay: null,
    renderScheduled: false,
    resizeRAF: null,
    isSwappingPanel: false,
    lastPanelSwitchAt: 0,
  };

  // -------------------------------------------------------------------------
  // Утилиты
  // -------------------------------------------------------------------------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => root.querySelectorAll(sel);

  const RU_WEEKDAYS = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'];
  const RU_MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

  function parseISO(iso) { return new Date(iso + 'T00:00:00'); }
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function startOfWeekMonday(d) {
    const r = new Date(d);
    const day = (r.getDay() + 6) % 7;
    r.setDate(r.getDate() - day);
    return r;
  }
  function fmtDateLong(iso) {
    const d = parseISO(iso);
    const wd = RU_WEEKDAYS[(d.getDay() + 6) % 7];
    return `${wd}, ${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]}`;
  }
  function fmtDateShort(iso) {
    const d = parseISO(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function fmtRange(startIso, endIso) {
    if (!startIso) return '—';
    if (!endIso || startIso === endIso) return fmtDateLong(startIso);
    return `${fmtDateShort(startIso)} — ${fmtDateShort(endIso)}, ${parseISO(endIso).getFullYear()}`;
  }
  function todayISO() { return toISO(new Date()); }

  function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Safe timeout / raf helpers with cleanup
  function nextFrame() { return new Promise(res => requestAnimationFrame(res)); }

  async function fetchJSON(url, { timeout = 20000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  // -------------------------------------------------------------------------
  // SVG-иконки (инжектим спрайт в DOM). Кешируем в localStorage — быстро.
  // -------------------------------------------------------------------------
  async function loadIconSprite() {
    try {
      const resp = await fetch('/static/img/icons.svg', { cache: 'force-cache' });
      const txt = await resp.text();
      const holder = $('#icon-sprite');
      if (holder) holder.innerHTML = txt;
    } catch (e) { console.warn('icon sprite load failed', e); }
  }

  // -------------------------------------------------------------------------
  // URL <-> state
  // -------------------------------------------------------------------------
  function readURL() {
    const p = new URLSearchParams(location.search);
    return { start: p.get('start'), end: p.get('end'), period: p.get('period') };
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.range.start)  p.set('start', state.range.start);
    if (state.range.period) p.set('period', state.range.period);
    const s = p.toString();
    history.replaceState(null, '', s ? `${location.pathname}?${s}` : location.pathname);
  }

  // -------------------------------------------------------------------------
  // Часы и статус
  // -------------------------------------------------------------------------
  function startClock() {
    const el = $('#clock');
    if (!el) return;
    if (!boot.show_clock) { el.hidden = true; return; }
    el.hidden = false;
    const tick = () => {
      const d = new Date();
      el.textContent = d.toLocaleString('ru-RU', {
        weekday: 'short', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    };
    tick();
    setInterval(tick, 15000);
  }

  function setStatus(kind, message) {
    const el = $('#status');
    if (!el) return;
    if (!boot.show_status) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'status-indicator ' + kind;
    const lab = el.querySelector('.label');
    if (lab) lab.textContent = message;
  }

  // -------------------------------------------------------------------------
  // Верхняя панель — показать/скрыть
  // -------------------------------------------------------------------------
  function toggleTopbar(forceHide) {
    const b = document.body;
    if (typeof forceHide === 'boolean') b.classList.toggle('hide-topbar', forceHide);
    else b.classList.toggle('hide-topbar');
    setTimeout(() => scheduleRender(), 360);
  }

  // -------------------------------------------------------------------------
  // Полноэкранный режим (F11 + кнопка)
  // -------------------------------------------------------------------------
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
              document.mozFullScreenElement || document.msFullscreenElement);
  }
  async function requestFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) return await el.requestFullscreen();
      if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen();
      if (el.mozRequestFullScreen) return await el.mozRequestFullScreen();
      if (el.msRequestFullscreen) return await el.msRequestFullscreen();
    } catch (e) { console.warn('requestFullscreen failed', e); }
  }
  async function exitFullscreen() {
    try {
      if (document.exitFullscreen) return await document.exitFullscreen();
      if (document.webkitExitFullscreen) return await document.webkitExitFullscreen();
      if (document.mozCancelFullScreen) return await document.mozCancelFullScreen();
      if (document.msExitFullscreen) return await document.msExitFullscreen();
    } catch (e) { console.warn('exitFullscreen failed', e); }
  }
  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreen();
    else requestFullscreen();
  }
  function updateFullscreenBtn() {
    const btn = $('#fullscreen-btn');
    if (!btn) return;
    const use = btn.querySelector('use');
    if (!use) return;
    const inFs = isFullscreen();
    use.setAttribute('href', inFs ? '#i-fullscreen-exit' : '#i-fullscreen');
    btn.title = inFs ? 'Выйти из полноэкранного режима (F11)' : 'Полноэкранный режим (F11)';
    document.body.classList.toggle('is-fullscreen', inFs);
  }

  // Скрытие курсора после бездействия в полноэкранном режиме
  let cursorHideTimer = null;
  function armCursorAutoHide() {
    document.addEventListener('mousemove', () => {
      document.body.classList.remove('cursor-hidden');
      if (cursorHideTimer) clearTimeout(cursorHideTimer);
      if (isFullscreen()) {
        cursorHideTimer = setTimeout(() => document.body.classList.add('cursor-hidden'), 3500);
      }
    }, { passive: true });
  }

  // -------------------------------------------------------------------------
  // Применение конфига
  // -------------------------------------------------------------------------
  function applyConfig(cfg) {
    const p = cfg.theme.palette || {};
    const root = document.documentElement.style;
    root.setProperty('--bg', p.background);
    root.setProperty('--surface', p.surface);
    root.setProperty('--surface-2', p.surface_2 || p.header_bg);
    root.setProperty('--text', p.text);
    root.setProperty('--text-muted', p.text_muted);
    root.setProperty('--accent-college', p.accent_college);
    root.setProperty('--accent-university', p.accent_university);
    // Пастельно-сиреневый по умолчанию
    root.setProperty('--accent-now', p.accent_now || '#b39ddb');
    root.setProperty('--lesson-bg', p.lesson_bg);
    root.setProperty('--lesson-border', p.lesson_border);
    root.setProperty('--grid-line', p.grid_line);
    root.setProperty('--header-bg', p.header_bg);

    root.setProperty('--font-family', cfg.typography.font_family);
    root.setProperty('--cell-fs',   cfg.typography.cell_font_size + 'rem');
    root.setProperty('--header-fs', cfg.typography.header_font_size + 'rem');
    root.setProperty('--title-fs',  cfg.typography.title_font_size + 'rem');

    const bg = (cfg.theme.background_image || '').trim();
    root.setProperty('--bg-image', bg ? `url("${bg}")` : 'none');
    root.setProperty('--bg-image-opacity', String(cfg.theme.background_opacity ?? 0.1));

    const disp = cfg.display || {};
    root.setProperty('--anim-ms', (disp.page_animation_ms ?? 500) + 'ms');
    root.setProperty('--micro-anim-ms', (disp.micro_anim_ms ?? 420) + 'ms');

    // Свечение островков
    root.setProperty('--island-glow-radius', (disp.island_glow_radius ?? 40) + 'px');
    root.setProperty('--island-glow-opacity', String(disp.island_glow_opacity ?? 0.35));
    // Свой цвет свечения (если задан) — переопределяем cast color через отдельные переменные,
    // но по умолчанию используем accent-цвета панелей — уже в CSS.
    if (disp.island_glow_color) {
      root.setProperty('--accent-college',    disp.island_glow_color);
      // не переопределяем university, чтобы не ломать визуальную дифференциацию;
      // если пользователю нужен точный цвет — правит overrides в теме.
    }

    document.body.dataset.layout = disp.layout || 'alternate';
    document.body.dataset.fancy  = (disp.fancy_animations === false) ? 'off' : 'on';
    document.body.dataset.glow   = disp.island_glow_enabled ? 'on' : 'off';
    document.body.dataset.glowPulse = disp.island_glow_pulse ? 'on' : 'off';
    document.body.dataset.progress = (disp.progress_bar_enabled === false) ? 'off' : 'on';

    boot.show_clock  = cfg.behavior.show_clock;
    boot.show_status = cfg.behavior.show_status_indicator;
    const c = $('#clock');  if (c) c.hidden = !boot.show_clock;
    const s = $('#status'); if (s) s.hidden = !boot.show_status;
  }

  // -------------------------------------------------------------------------
  // Slots для kind (по звонкам)
  // -------------------------------------------------------------------------
  function slotsForKind(kind, cfg) {
    const bells = (cfg && cfg.bells) || {};
    const grp = bells[kind] || {};
    const shift1 = (grp.shift1 || []).map(s => ({ ...s, shift: 1 }));
    const shift2 = (grp.shift2 || []).map(s => ({ ...s, shift: 2 }));
    return [...shift1, ...shift2];
  }

  function parseTimeRange(str) {
    if (!str) return null;
    const m = String(str).match(/(\d{1,2})[.:](\d{2})\s*[–\-]\s*(\d{1,2})[.:](\d{2})/);
    if (!m) return null;
    return { startH: +m[1], startM: +m[2], endH: +m[3], endM: +m[4] };
  }
  function isSlotNow(slotTime) {
    const t = parseTimeRange(slotTime);
    if (!t) return false;
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    return nowM >= (t.startH * 60 + t.startM) && nowM <= (t.endH * 60 + t.endM);
  }

  // -------------------------------------------------------------------------
  // Цвет по этажу
  // -------------------------------------------------------------------------
  function floorColor(room, cfg) {
    const map = (cfg && cfg.theme && cfg.theme.floor_colors) || {};
    const def = map.default || '#64748b';
    if (!room) return def;
    const m = String(room).match(/\d/);
    if (!m) return def;
    return map[m[0]] || def;
  }

  // -------------------------------------------------------------------------
  // Разбор кабинета: делит на main+tail
  // -------------------------------------------------------------------------
  const ROOM_SPLIT_RULES = [
    { re: /^(.*?)\s*(КЮ)\s*$/iu,      tail: 'КЮ' },
    { re: /^(.*?Акт\.?)\s*(зал)\s*$/iu, tail: 'зал' },
    { re: /^(.*?)\s*(зал)\s*$/iu,      tail: 'зал' },
    { re: /^(.*?)\s*(Ст\.\s*с\.?)\s*$/iu, tail: 'Ст.с' },
    { re: /^(.*?)\s*\((Ст\.\s*с\.?)\)\s*$/iu, tail: 'Ст.с' },
  ];
  function splitRoom(room) {
    if (!room) return { main: '', tail: '' };
    const s = String(room).trim();
    for (const rule of ROOM_SPLIT_RULES) {
      const m = s.match(rule.re);
      if (m && m[1] !== undefined) {
        const main = m[1].trim();
        if (main) return { main, tail: rule.tail };
      }
    }
    return { main: s, tail: '' };
  }

  function truncateSubject(text, maxChars) {
    if (!maxChars || maxChars <= 0) return text;
    const s = String(text || '');
    if (s.length <= maxChars) return s;
    return s.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
  }

  // -------------------------------------------------------------------------
  // Собираем набор слотов (объединение bells + встречающихся UR в данных)
  // -------------------------------------------------------------------------
  function buildAllSlots(kind, groups, cfg) {
    const cfgSlots = slotsForKind(kind, cfg);
    const slotByUr = new Map(cfgSlots.map(s => [s.ur, s]));
    for (const g of groups) {
      for (const dISO in g.days) {
        const gd = g.days[dISO];
        for (const urKey in gd) {
          const ur = parseInt(urKey, 10);
          if (!slotByUr.has(ur)) {
            const t = (gd[urKey][0] || {}).time || '';
            const shift = (kind === 'university' ? ur <= 4 : ur <= 3) ? 1 : 2;
            slotByUr.set(ur, { ur, time: t, shift });
          }
        }
      }
    }
    return Array.from(slotByUr.values()).sort((a, b) => a.ur - b.ur);
  }

  // -------------------------------------------------------------------------
  // Вычисление количества групп на страницу — консервативно, чтобы
  // столбцы всегда были удобны для чтения
  // -------------------------------------------------------------------------
  function computeGroupsPerPage(cfg, panelEl) {
    const disp = cfg.display || {};
    const explicit = Number(disp.groups_per_page) || 0;
    if (explicit > 0) return Math.max(1, Math.floor(explicit));

    const body = panelEl && panelEl.querySelector('.panel-body');
    const availWidth = body ? body.clientWidth : window.innerWidth;
    const slotColW = 74;
    const gap = 14;
    const outerPad = 24;
    const minCol = Math.max(180, Number(disp.group_col_min_px) || 220);

    let n = 1;
    for (let candidate = 12; candidate >= 1; candidate--) {
      const totalGap = gap * (candidate - 1);
      const colWidth = (availWidth - slotColW - gap - outerPad - totalGap) / candidate;
      if (colWidth >= minCol) { n = candidate; break; }
    }
    return clamp(n, 1, 12);
  }

  // -------------------------------------------------------------------------
  // Рендер одной страницы группы — ОСТРОВКОВЫЙ ДИЗАЙН
  //
  // Структура:
  //   .page
  //     .slots-column
  //       .slots-column-header ("Пара")
  //       .slots-column-cell × N  (по одной на слот)
  //     .groups-row
  //       .group-island × M
  //         .group-island-header (имя группы)
  //         .group-island-body
  //           .lesson-node × N (по одной на слот)
  //
  // Все острова синхронизированы по строкам с левой колонкой — используется
  // ОДИНАКОВОЕ количество строк (кол-во слотов) и одинаковый row-gap.
  // Левая колонка ВСЕГДА показывает все 7 пар (из bells).
  // -------------------------------------------------------------------------
  function renderPageContent(kind, cfg, groups, allSlots, dateIso) {
    const disp = cfg.display || {};
    const showTeacher = disp.show_teacher !== false;
    const subjectMax  = Number(disp.subject_max_chars) || 0;

    const page = document.createElement('div');
    page.className = 'page anim-' + (disp.page_animation || 'swap');

    // Собираем полный набор слотов из bells (всегда 7 для университета, 6 для колледжа
    // если только в БД не встретились какие-то другие UR — тогда объединяем).
    const bellsSlots = slotsForKind(kind, cfg);
    const bellsUrs = new Set(bellsSlots.map(s => s.ur));
    const extraSlots = allSlots.filter(s => !bellsUrs.has(s.ur));
    const slots = [...bellsSlots, ...extraSlots].sort((a, b) => a.ur - b.ur);

    // Гарантируем «7 пар слева» — если по звонкам меньше, добавляем пустые слоты.
    const desiredCount = 7;
    while (slots.length < desiredCount) {
      const nextUr = (slots.length ? slots[slots.length - 1].ur : 0) + 1;
      slots.push({ ur: nextUr, time: '', shift: nextUr <= 3 ? 1 : 2 });
    }

    page.style.setProperty('--slot-count', slots.length);
    page.style.setProperty('--groups-per-page', groups.length);

    // Левая колонка «Пара»
    const slotsCol = document.createElement('div');
    slotsCol.className = 'slots-column';
    const slotsHead = document.createElement('div');
    slotsHead.className = 'slots-column-header';
    slotsHead.textContent = 'ПАРА';
    slotsCol.appendChild(slotsHead);

    for (let si = 0; si < slots.length; si++) {
      const slot = slots[si];
      // Невидимый спейсер между ячейками (синхронизирует высоты с коннекторами в островах)
      if (si > 0) {
        const sp = document.createElement('div');
        sp.className = 'slots-column-spacer';
        slotsCol.appendChild(sp);
      }
      const c = document.createElement('div');
      const isNow = isSlotNow(slot.time);
      c.className = 'slots-column-cell' + (isNow ? ' is-now' : '');
      c.dataset.time = slot.time || '';
      c.dataset.ur = slot.ur;
      c.innerHTML =
        `<span class="slot-num-big">${slot.ur}</span>` +
        (slot.time ? `<span class="slot-num-time">${escapeHTML(slot.time)}</span>` : '');
      slotsCol.appendChild(c);
    }
    page.appendChild(slotsCol);

    // Строка островков
    const groupsRow = document.createElement('div');
    groupsRow.className = 'groups-row';

    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-message';
      empty.innerHTML = `<div class="empty-icon">🌴</div>В этот день занятий нет`;
      groupsRow.style.gridTemplateColumns = '1fr';
      groupsRow.appendChild(empty);
      page.appendChild(groupsRow);
      return page;
    }

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const island = document.createElement('div');
      island.className = 'group-island';
      island.style.setProperty('--i', String(gi));

      const head = document.createElement('div');
      head.className = 'group-island-header';
      head.innerHTML = `<span class="group-name" title="${escapeHTML(g.name)}">${escapeHTML(g.name)}</span>`;
      island.appendChild(head);

      const body = document.createElement('div');
      body.className = 'group-island-body';

      const gd = (g.days && g.days[dateIso]) || {};

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const lessons = gd[slot.ur] || [];
        const isNow = isSlotNow(slot.time);
        const isShiftDiv = i > 0 && slot.shift === 2 && slots[i - 1].shift === 1;

        const node = document.createElement('div');
        const classes = ['lesson-node'];
        if (!showTeacher) classes.push('hide-teacher');
        if (isNow) classes.push('is-now');
        if (isShiftDiv) classes.push('shift-divider');
        if (!lessons.length) classes.push('is-empty');
        node.className = classes.join(' ');
        node.dataset.time = slot.time || '';
        node.dataset.ur = slot.ur;

        if (!lessons.length) {
          node.innerHTML = `<div class="cell-empty">—</div>`;
        } else {
          const l = lessons[0];
          const roomColor = floorColor(l.room, cfg);
          const { main, tail } = splitRoom(l.room);
          const subj = truncateSubject(l.subject || '—', subjectMax);

          node.style.setProperty('--room-color', roomColor);
          const subjectHtml =
            `<div class="cell-subject">` +
              `<span class="subject-text" title="${escapeHTML(l.subject || '')}">${escapeHTML(subj)}</span>` +
            `</div>`;
          const roomHtml = main
            ? `<div class="cell-room"><div class="room-box">` +
                `<span class="room-main">${escapeHTML(main)}</span>` +
                (tail ? `<span class="room-tail">${escapeHTML(tail)}</span>` : '') +
              `</div></div>`
            : `<div class="cell-room"><div class="room-box">` +
                `<span class="room-empty">—</span>` +
              `</div></div>`;
          const teacherHtml = showTeacher
            ? (l.teacher
                ? `<div class="cell-teacher" title="${escapeHTML(l.teacher)}">` +
                    `<svg width="12" height="12" viewBox="0 0 24 24"><use href="#i-user"/></svg>` +
                    `<span class="teacher-name">${escapeHTML(l.teacher)}</span>` +
                  `</div>`
                : `<div class="cell-teacher is-empty">` +
                    `<span class="teacher-name">преподаватель не указан</span>` +
                  `</div>`)
            : '';

          node.innerHTML = subjectHtml + roomHtml + teacherHtml;
        }
        // Коннектор между карточками (кроме первой карточки)
        if (i > 0) {
          const conn = document.createElement('div');
          conn.className = 'lesson-connector' + (isShiftDiv ? ' is-shift' : '');
          body.appendChild(conn);
        }
        body.appendChild(node);
      }

      island.appendChild(body);
      groupsRow.appendChild(island);
    }

    page.appendChild(groupsRow);
    return page;
  }

  // -------------------------------------------------------------------------
  // Рендер панели (страница + пагинация + прогресс-бар)
  // -------------------------------------------------------------------------
  function renderPanel(panelKind, cfg) {
    const panelEl = $(`#panel-${panelKind}`);
    const bodyEl  = $(`#body-${panelKind}`);
    if (!panelEl || !bodyEl || !state.data) return;

    const groups = state.data[panelKind] || [];
    if (!groups.length) {
      // Полная зачистка — избегаем «серых призраков» от предыдущего рендера
      cleanupPanel(bodyEl);
      bodyEl.innerHTML = `<div class="empty-message"><div class="empty-icon">📭</div>Нет данных</div>`;
      updatePageIndicator(panelKind, 0, 1);
      updateProgressBar(panelKind, 0, 1);
      return;
    }

    const dateIso = (state.data.days && state.data.days[0] && state.data.days[0].date) || state.range.start || todayISO();
    const allSlots = buildAllSlots(panelKind, groups, cfg);

    const perPage = computeGroupsPerPage(cfg, panelEl);
    state.groupsPerPage = perPage;
    const total = Math.max(1, Math.ceil(groups.length / perPage));
    state.pageTotal[panelKind] = total;
    state.pageIndex[panelKind] = clamp(state.pageIndex[panelKind] | 0, 0, total - 1);

    const idx = state.pageIndex[panelKind];
    const slice = groups.slice(idx * perPage, idx * perPage + perPage);
    updatePageIndicator(panelKind, idx, total);
    updateProgressBar(panelKind, idx, total);

    const oldPage = bodyEl.querySelector('.page');
    const newPage = renderPageContent(panelKind, cfg, slice, allSlots, dateIso);
    animateSwap(bodyEl, oldPage, newPage, cfg);

    const animDelay = Number(cfg.display.page_animation_ms) || 500;
    setTimeout(() => setupAutoScroll(panelKind, cfg), animDelay + 250);
  }

  function updatePageIndicator(kind, idx, total) {
    const el = $(`#page-${kind}`);
    if (!el) return;
    if (total <= 1) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = `${idx + 1} / ${total}`;
  }

  // Прогресс-бар пагинации.
  // Заполняется по мере того как показываются страницы (0 → 100%).
  // Если total = 1 — прячем.
  function updateProgressBar(kind, idx, total) {
    const el = $(`#progress-${kind}`);
    if (!el) return;
    const container = el.parentElement;
    if (!container) return;
    if (total <= 1) {
      container.style.opacity = '0';
      el.style.width = '0%';
      return;
    }
    container.style.opacity = '1';
    // прогресс = (idx+1) / total * 100
    const pct = ((idx + 1) / total) * 100;
    el.style.width = pct + '%';
  }

  // Полная очистка панели (убираем все .page с любыми стадиями анимации)
  function cleanupPanel(bodyEl) {
    if (!bodyEl) return;
    // Останавливаем возможные завершения animateSwap
    const pages = bodyEl.querySelectorAll('.page');
    pages.forEach(p => { try { p.remove(); } catch {} });
  }

  // -------------------------------------------------------------------------
  // Анимированная замена страницы. КЛЮЧЕВОЙ ФИКС «серых призраков»:
  // - если после смены типа анимации/layout остались "leaving" ноды, чистим их
  // - применяем строго один класс на каждой стадии
  // -------------------------------------------------------------------------
  function animateSwap(container, oldPage, newPage, cfg) {
    const animName = (cfg.display.page_animation || 'swap');

    // Сначала — гарантированно уберём все «застрявшие» leave-элементы (не текущий oldPage).
    const stuck = container.querySelectorAll('.page.leave-to, .page.leave-from');
    stuck.forEach(el => { if (el !== oldPage) { try { el.remove(); } catch {} } });

    if (!oldPage || animName === 'none') {
      if (oldPage) { try { oldPage.remove(); } catch {} }
      container.appendChild(newPage);
      void newPage.offsetHeight;
      newPage.classList.add('enter-to');
      return;
    }

    newPage.classList.add('enter-from');
    container.appendChild(newPage);
    oldPage.classList.remove('enter-from', 'enter-to');
    oldPage.classList.add('leave-from');

    void newPage.offsetHeight;

    requestAnimationFrame(() => {
      newPage.classList.remove('enter-from');
      newPage.classList.add('enter-to');
      oldPage.classList.remove('leave-from');
      oldPage.classList.add('leave-to');
    });

    const durMs = Number(cfg.display.page_animation_ms) || 500;
    setTimeout(() => {
      // Дополнительная страховка: удаляем любые leave-элементы, которые остались.
      try { oldPage.remove(); } catch {}
      const leftovers = container.querySelectorAll('.page.leave-to, .page.leave-from');
      leftovers.forEach(el => { try { el.remove(); } catch {} });
    }, durMs + 120);
  }

  // -------------------------------------------------------------------------
  // Автоскролл (при необходимости — реже нужен в островковом дизайне,
  // так как всё вмещается на экран, но оставляем возможность)
  // -------------------------------------------------------------------------
  function stopAutoScroll(panelKind) {
    const anim = state.autoScrollAnim[panelKind];
    if (anim) {
      try { anim.cancel && anim.cancel(); } catch {}
      clearTimeout(anim.tOut);
      delete state.autoScrollAnim[panelKind];
    }
  }

  function setupAutoScroll(panelKind, cfg) {
    stopAutoScroll(panelKind);
    const disp = cfg.display || {};
    if (!disp.auto_scroll) return;
    // В островковом дизайне автоскролл отключён — весь контент по определению
    // помещается в экран за счёт grid-fr.
    // Оставлено для совместимости конфига.
  }

  // -------------------------------------------------------------------------
  // Ротация страниц + плавная смена панели в alternate
  // -------------------------------------------------------------------------
  function schedulePageRotation(cfg) {
    if (state.pageTimer) { clearTimeout(state.pageTimer); state.pageTimer = null; }
    const disp = cfg.display || {};
    const layout = disp.layout;
    const pageInterval = Math.max(3, Number(disp.page_interval_seconds) || 15) * 1000;

    function activePanels() {
      if (layout === 'alternate') return [state.activePanel];
      if (layout === 'college_only')    return ['college'];
      if (layout === 'university_only') return ['university'];
      return ['college', 'university'];
    }

    function tick() {
      const cfgLive = state.config || cfg;
      const panels = activePanels();
      let alternateDone = false;
      let anyAdvanced = false;

      for (const kind of panels) {
        const total = state.pageTotal[kind] || 1;
        const cur   = state.pageIndex[kind] || 0;
        const next  = cur + 1;
        if (next >= total) {
          state.pageIndex[kind] = 0;
          alternateDone = true;
        } else {
          state.pageIndex[kind] = next;
          anyAdvanced = true;
        }
        renderPanel(kind, cfgLive);
      }

      if (layout === 'alternate' && alternateDone && !anyAdvanced) {
        const nextKind = state.activePanel === 'college' ? 'university' : 'college';
        const hasOther = state.data && state.data[nextKind] && state.data[nextKind].length > 0;
        if (hasOther) {
          switchActivePanel(nextKind, cfgLive);
        }
      }

      state.pageTimer = setTimeout(tick, pageInterval);
    }

    state.pageTimer = setTimeout(tick, pageInterval);
  }

  // -------------------------------------------------------------------------
  // Красивая смена панели: заголовок улетает в одну сторону,
  // новый прилетает с другой.
  // -------------------------------------------------------------------------
  function switchActivePanel(nextKind, cfg) {
    if (state.isSwappingPanel) return;
    const prevKind = state.activePanel;
    if (prevKind === nextKind) return;
    state.isSwappingPanel = true;
    state.lastPanelSwitchAt = Date.now();

    const fancy = document.body.dataset.fancy !== 'off';
    const microMs = Number((cfg.display && cfg.display.micro_anim_ms) || 420);

    // Анимация ухода текущего заголовка (Колледж или Высшее)
    const prevStage = $(`#title-stage-${prevKind}`);
    const prevInner = prevStage ? prevStage.querySelector('.panel-title-inner') : null;

    if (fancy && prevInner) {
      prevInner.classList.add(prevKind === 'university' ? 'is-leaving-right' : 'is-leaving-left');
    }

    // Обновляем панель через микро-таймаут, чтобы «улёт» стартовал первым
    setTimeout(() => {
      state.activePanel = nextKind;
      document.body.dataset.activePanel = nextKind;
      state.pageIndex[nextKind] = 0;
      renderPanel(nextKind, cfg);

      // Анимация появления нового заголовка
      const nextStage = $(`#title-stage-${nextKind}`);
      const nextInner = nextStage ? nextStage.querySelector('.panel-title-inner') : null;
      if (fancy && nextInner) {
        nextInner.classList.remove('is-leaving-right', 'is-leaving-left');
        nextInner.classList.add(nextKind === 'college' ? 'is-entering-from-left' : 'is-entering-from-right');
        requestAnimationFrame(() => {
          nextInner.classList.remove('is-entering-from-left', 'is-entering-from-right');
        });
      }

      setTimeout(() => {
        // Сбрасываем состояния улёта у скрытой панели, чтобы при следующем цикле анимация запустилась чисто
        if (prevInner) prevInner.classList.remove('is-leaving-right', 'is-leaving-left');
        state.isSwappingPanel = false;
      }, microMs + 40);
    }, fancy ? Math.max(120, microMs * 0.4) : 0);
  }

  // -------------------------------------------------------------------------
  // Полный рендер
  // -------------------------------------------------------------------------
  function scheduleRender() {
    if (state.renderScheduled) return;
    state.renderScheduled = true;
    requestAnimationFrame(() => {
      state.renderScheduled = false;
      fullRender();
    });
  }

  function fullRender() {
    if (!state.config || !state.data) return;

    const dateEl = $('#date-current-text');
    if (dateEl) dateEl.textContent = fmtRange(state.data.start, state.data.end);

    const dp = $('#date-picker');
    if (dp) dp.value = state.data.start;

    const layout = state.config.display.layout;
    if (layout === 'alternate') {
      const has = k => state.data[k] && state.data[k].length > 0;
      if (!has(state.activePanel) && has(state.activePanel === 'college' ? 'university' : 'college')) {
        state.activePanel = state.activePanel === 'college' ? 'university' : 'college';
      }
      document.body.dataset.activePanel = state.activePanel;
    }

    // При полной перерисовке — сначала чистим обе панели (это лечит «серые призраки»
    // от предыдущего layout/animation)
    cleanupPanel($('#body-college'));
    cleanupPanel($('#body-university'));

    renderPanel('college',    state.config);
    renderPanel('university', state.config);

    schedulePageRotation(state.config);
  }

  // -------------------------------------------------------------------------
  // Обновление подсветки текущей пары (без полной перерисовки)
  // -------------------------------------------------------------------------
  function refreshNowHighlight() {
    const elems = document.querySelectorAll('[data-time]');
    for (const el of elems) {
      const t = el.dataset.time || '';
      const now = isSlotNow(t);
      if (el.classList.contains('lesson-node') ||
          el.classList.contains('slots-column-cell')) {
        el.classList.toggle('is-now', now);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Загрузка данных / конфига
  // -------------------------------------------------------------------------
  async function loadData({ silent = false } = {}) {
    if (!silent) { const o = $('#overlay-loading'); if (o) o.hidden = false; }
    const params = new URLSearchParams();
    if (state.range.start)  params.set('start',  state.range.start);
    if (state.range.period) params.set('period', state.range.period);
    try {
      const data = await fetchJSON('/api/schedule?' + params.toString(), { timeout: 25000 });
      state.data = data;
      state.range.start = data.start;
      state.range.end = data.end;
      state.pageIndex.college = 0;
      state.pageIndex.university = 0;
      const err = $('#overlay-error'); if (err) err.hidden = true;
      scheduleRender();
      writeURL();
    } catch (e) {
      console.warn('loadData failed', e);
      if (!state.data) {
        const err = $('#overlay-error'); if (err) err.hidden = false;
        const t = $('#overlay-error-text');
        if (t) t.textContent = 'Не удалось загрузить расписание. Повторная попытка…';
      }
    } finally {
      const o = $('#overlay-loading'); if (o) o.hidden = true;
    }
  }

  async function loadConfig() {
    try {
      const cfg = await fetchJSON('/api/config');
      if (cfg.version !== state.configVersion) {
        state.configVersion = cfg.version;
        state.config = cfg;
        applyConfig(cfg);
        if (state.data) scheduleRender();
      }
    } catch (e) { console.warn('loadConfig failed', e); }
  }

  // -------------------------------------------------------------------------
  // SSE подписка + автоперезаподключение с экспоненциальным backoff
  // -------------------------------------------------------------------------
  function subscribeSSE() {
    if (!('EventSource' in window)) { startPollingFallback(); return; }
    try {
      const es = new EventSource('/api/events');
      state.sseSource = es;

      es.addEventListener('hello', () => {
        setStatus('ok', 'подключено');
        state.sseReconnectAttempt = 0;
        stopPollingFallback();
      });
      es.addEventListener('data_updated', () => loadData({ silent: true }));
      es.addEventListener('config_updated', () => loadConfig());
      es.addEventListener('sync_error', () => setStatus('warn', 'БД: кэш'));
      es.addEventListener('ping', () => {});
      es.onerror = () => {
        console.warn('SSE error — reconnect scheduled');
        try { es.close(); } catch {}
        state.sseSource = null;
        setStatus('warn', 'переподключение…');
        startPollingFallback();
        // exponential backoff, capped at 60s
        state.sseReconnectAttempt++;
        const delay = Math.min(60000, 1500 * Math.pow(1.7, state.sseReconnectAttempt));
        if (state.sseReconnectTimer) clearTimeout(state.sseReconnectTimer);
        state.sseReconnectTimer = setTimeout(() => {
          if (!state.sseSource) subscribeSSE();
        }, delay);
      };
    } catch (e) {
      console.warn('SSE unavailable, using polling', e);
      startPollingFallback();
    }
  }

  function startPollingFallback() {
    if (state.fallbackPollTimer) return;
    const ms = Math.max(15000, (boot.client_refresh_seconds || 60) * 1000);
    const tick = async () => {
      await loadConfig();
      await loadData({ silent: true });
      state.fallbackPollTimer = setTimeout(tick, ms);
    };
    state.fallbackPollTimer = setTimeout(tick, ms);
  }
  function stopPollingFallback() {
    if (state.fallbackPollTimer) { clearTimeout(state.fallbackPollTimer); state.fallbackPollTimer = null; }
  }

  // -------------------------------------------------------------------------
  // Статус подключения
  // -------------------------------------------------------------------------
  async function pollStatus() {
    try {
      const st = await fetchJSON('/api/status');
      if (st.healthy) {
        if (state.sseSource) setStatus('ok', 'онлайн');
        else                 setStatus('warn', 'polling');
        const err = $('#overlay-error'); if (err) err.hidden = true;
      } else if (state.data) {
        setStatus('warn', 'БД: кэш');
      } else {
        setStatus('error', 'нет данных');
      }
    } catch { setStatus('error', 'сервер?'); }
    finally { setTimeout(pollStatus, 15000); }
  }

  // -------------------------------------------------------------------------
  // Навигация по датам
  // -------------------------------------------------------------------------
  const PERIOD_DAYS = { day: 1, week: 7, '2weeks': 14, '3weeks': 21, month: 30 };

  function shiftBy(deltaSign) {
    if (!state.range.start) return;
    const len = PERIOD_DAYS[state.range.period] || 7;
    const startD = parseISO(state.range.start);
    const newStart = addDays(startD, deltaSign * len);
    if (['week','2weeks','3weeks'].includes(state.range.period)) {
      state.range.start = toISO(startOfWeekMonday(newStart));
    } else {
      state.range.start = toISO(newStart);
    }
    loadData();
  }

  function jumpToToday() {
    const t = new Date();
    if (['week','2weeks','3weeks'].includes(state.range.period)) {
      state.range.start = toISO(startOfWeekMonday(t));
    } else {
      state.range.start = toISO(t);
    }
    state.currentDay = todayISO();
    loadData();
  }

  function pickDate(iso) {
    if (!iso) return;
    if (['week','2weeks','3weeks'].includes(state.range.period)) {
      state.range.start = toISO(startOfWeekMonday(parseISO(iso)));
    } else {
      state.range.start = iso;
    }
    loadData();
  }

  function openDatePicker() {
    const dp = $('#date-picker');
    if (!dp) return;
    if (typeof dp.showPicker === 'function') {
      try { dp.showPicker(); return; } catch {}
    }
    try { dp.focus(); dp.click(); } catch {}
  }

  // -------------------------------------------------------------------------
  // Автоматическая смена дня
  // -------------------------------------------------------------------------
  function scheduleMidnightRefresh() {
    if (state.midnightTimer) clearTimeout(state.midnightTimer);
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const delay = Math.max(1000, nextMidnight - now);
    state.midnightTimer = setTimeout(() => {
      const newToday = todayISO();
      if (newToday !== state.currentDay) {
        state.currentDay = newToday;
        if (state.range.period === 'day') state.range.start = newToday;
        loadData({ silent: true });
      }
      scheduleMidnightRefresh();
    }, delay);
  }
  function scheduleDayGuard() {
    if (state.dayGuardTimer) clearInterval(state.dayGuardTimer);
    state.dayGuardTimer = setInterval(() => {
      const t = todayISO();
      if (t !== state.currentDay) {
        state.currentDay = t;
        if (state.range.period === 'day') state.range.start = t;
        loadData({ silent: true });
      }
    }, 60 * 1000);
  }

  // -------------------------------------------------------------------------
  // Клавиатурные шорткаты (работают на любой раскладке через e.code)
  // F11 — fullscreen (перехватываем, чтобы работало во всех браузерах внутри app)
  // -------------------------------------------------------------------------
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const code = e.code || '';
      const key = (e.key || '').toLowerCase();

      if (code === 'F11' || key === 'f11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (code === 'KeyM' || key === 'm' || key === 'ь') {
        e.preventDefault();
        toggleTopbar();
        return;
      }
      if (code === 'ArrowLeft')  { shiftBy(-1); return; }
      if (code === 'ArrowRight') { shiftBy(+1); return; }
      if (code === 'KeyT' || key === 't' || key === 'е') { jumpToToday(); return; }
      if (code === 'KeyR' || key === 'r' || key === 'к') { loadData(); return; }
      if (code === 'Escape' || key === 'escape') {
        document.body.classList.remove('hide-topbar');
      }
    }, { passive: false });
  }

  // -------------------------------------------------------------------------
  // Ресайз окна
  // -------------------------------------------------------------------------
  function onResize() {
    if (state.resizeRAF) cancelAnimationFrame(state.resizeRAF);
    state.resizeRAF = requestAnimationFrame(() => {
      state.resizeRAF = null;
      if (state.data && state.config) fullRender();
    });
  }

  // -------------------------------------------------------------------------
  // Глобальный "safety cleanup" — раз в 20 секунд убирает «застрявшие»
  // страницы, если по какой-то причине setTimeout не сработал.
  // -------------------------------------------------------------------------
  function startGhostSweeper() {
    safeSetInterval(() => {
      const anim = Number((state.config && state.config.display && state.config.display.page_animation_ms) || 500);

      // 1) Старые leave-to/leave-from элементы
      const ghosts = document.querySelectorAll('.page.leave-to, .page.leave-from');
      ghosts.forEach(el => {
        const born = Number(el.dataset._born || 0);
        if (!born) { el.dataset._born = String(Date.now()); return; }
        if (Date.now() - born > anim * 3 + 500) {
          try { el.remove(); } catch {}
        }
      });

      // 2) Если в одном panel-body оказалось больше 1 статичной .page — чистим
      for (const kind of ['college', 'university']) {
        const body = document.getElementById('body-' + kind);
        if (!body) continue;
        const pages = body.querySelectorAll(':scope > .page');
        if (pages.length > 1) {
          for (let i = 0; i < pages.length - 1; i++) {
            const p = pages[i];
            if (!p.classList.contains('leave-from')) {
              try { p.remove(); } catch {}
            }
          }
        }
      }
    }, 4000);
  }

  // -------------------------------------------------------------------------
  // Инициализация
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Глобальный error-boundary. Не даём асинхронным ошибкам обрушить UI.
  // Логируем в console и показываем лёгкий индикатор ошибки (статус).
  // -------------------------------------------------------------------------
  function installErrorBoundary() {
    window.addEventListener('error', (e) => {
      console.error('[global error]', e.message, e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[unhandled promise]', e.reason);
    });
  }

  // Безопасный обёртка таймеров — таймер не вылетает, если коллбэк кинул ошибку
  function safeSetInterval(fn, ms) {
    return setInterval(() => {
      try { fn(); }
      catch (e) { console.error('[safeInterval] callback failed:', e); }
    }, ms);
  }
  function safeSetTimeout(fn, ms) {
    return setTimeout(() => {
      try { fn(); }
      catch (e) { console.error('[safeTimeout] callback failed:', e); }
    }, ms);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    installErrorBoundary();
    await loadIconSprite();

    const refreshBtn = $('#refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning');
      loadData().finally(() => setTimeout(() => refreshBtn.classList.remove('spinning'), 400));
    });
    const fsBtn = $('#fullscreen-btn');
    if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);

    const prev = $('#date-prev');   if (prev) prev.addEventListener('click', () => shiftBy(-1));
    const next = $('#date-next');   if (next) next.addEventListener('click', () => shiftBy(+1));
    const today = $('#date-today'); if (today) today.addEventListener('click', jumpToToday);

    const dateBtn = $('#date-current');
    if (dateBtn) dateBtn.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'date-picker') return;
      e.preventDefault();
      openDatePicker();
    });

    const dp = $('#date-picker');
    if (dp) dp.addEventListener('change', (e) => pickDate(e.target.value));

    // Фиксация: изменения состояния fullscreen — обновляем иконку
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
      .forEach(evt => document.addEventListener(evt, updateFullscreenBtn));
    armCursorAutoHide();

    // Опционально — автовход в полноэкранный режим по первому взаимодействию
    if (boot.fullscreen_on_first_interaction) {
      const once = () => {
        if (!isFullscreen()) requestFullscreen();
        window.removeEventListener('click', once);
        window.removeEventListener('keydown', once);
      };
      window.addEventListener('click', once, { once: true });
      window.addEventListener('keydown', once, { once: true });
    }

    startClock();
    bindKeyboard();
    window.addEventListener('resize', onResize);
    // При смене видимости вкладки — если вернулись после долгого отсутствия — перерисовать
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        refreshNowHighlight();
        // мягко перезапустим SSE если он отвалился
        if (!state.sseSource) subscribeSSE();
      }
    });

    const fromURL = readURL();
    state.range.start  = fromURL.start  || boot.default_start;
    state.range.period = fromURL.period || boot.default_period || 'day';
    state.currentDay = todayISO();

    if (boot.hide_topbar_on_load) document.body.classList.add('hide-topbar');

    await loadConfig();
    await loadData();

    subscribeSSE();
    pollStatus();

    state.nowTickTimer = safeSetInterval(refreshNowHighlight, 30 * 1000);
    scheduleMidnightRefresh();
    scheduleDayGuard();
    startGhostSweeper();
    updateFullscreenBtn();
  });
})();
