import { BOOKS, CHAPTERS, TOTAL, BOOK_OFFSETS, textOn } from './books.js';
import { layoutPhrase, ROWS_WIDE, ROWS_NARROW } from './letters.js';

/* ------------------------------------------------------------------ state */

const STORAGE_KEY = 'bom-chart:v1';
const THEME_KEY = 'bom-chart:theme';
const NARROW_BREAKPOINT = 700;

let read = new Array(TOTAL).fill(false);
const undoStack = [];

function encodeState(state) {
  let bits = state.map((v) => (v ? '1' : '0')).join('');
  while (bits.length % 4) bits += '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return `BOM1-${hex}`;
}

function decodeState(code) {
  const trimmed = String(code || '').trim().replace(/\s+/g, '');
  if (!/^BOM1-[0-9a-fA-F]+$/.test(trimmed)) return null;
  let bits = '';
  for (const ch of trimmed.slice(5).toLowerCase()) bits += parseInt(ch, 16).toString(2).padStart(4, '0');
  if (bits.length < TOTAL) return null;
  return Array.from({ length: TOTAL }, (_, i) => bits[i] === '1');
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, encodeState(read));
  } catch {
    /* private mode or storage full: the session still works, just not persisted */
  }
}

function load() {
  try {
    const restored = decodeState(localStorage.getItem(STORAGE_KEY));
    if (restored) read = restored;
  } catch {
    /* ignore unreadable storage */
  }
}

/* ------------------------------------------------------------------- dom */

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const chartWrap = $('chartWrap');
const listView = $('listView');
const chartView = $('chartView');
const toast = $('toast');
const cellNodes = new Array(TOTAL);
const labelNodes = new Array(TOTAL);
const cellGeometry = new Array(TOTAL);
const chipNodes = new Array(TOTAL);

/* ----------------------------------------------------------- chart build */

/** Width available for a label of the given height, allowing for slanted cells. */
function availableWidth(cell, lineHeight) {
  if (cell.shearY) {
    return Math.max(5, Math.min(cell.w, (cell.h - lineHeight) / cell.shearY));
  }
  if (cell.shearX) {
    return Math.max(5, cell.w - cell.shearX * lineHeight);
  }
  return cell.w;
}

/** Rough average glyph advance, refined later by measuring the rendered text. */
const advanceOf = (text) => (/^\d+$/.test(text) ? 0.62 : 0.78);

/** Largest font size that keeps `text` inside the cell, settling the width/height loop. */
function fitFont(cell, text, maxSize, heightBudget) {
  const advance = advanceOf(text);
  let size = Math.min(maxSize, heightBudget * 0.82);
  for (let pass = 0; pass < 3; pass++) {
    const width = availableWidth(cell, size * 1.2);
    size = Math.max(6.2, Math.min(maxSize, heightBudget * 0.82, (width * 0.9) / (advance * text.length)));
  }
  return size;
}

function labelFor(chapter, cell) {
  const x = cell.cx.toFixed(1);
  const y = cell.cy.toFixed(1);
  const tone = `--tc:${textOn(chapter.color)}`;

  if (chapter.single) {
    const size = fitFont(cell, chapter.chartAbbr, 13, cell.h);
    return `<text class="lab" style="${tone}" x="${x}" y="${y}" font-size="${size.toFixed(1)}">${chapter.chartAbbr}</text>`;
  }

  if (chapter.isBookStart) {
    let numSize = Math.min(12, cell.h * 0.42);
    let bookSize = numSize * 0.95;
    for (let pass = 0; pass < 3; pass++) {
      const width = availableWidth(cell, bookSize + numSize + 2);
      numSize = Math.max(6.2, Math.min(12, cell.h * 0.42, (width * 0.9) / 0.62));
      bookSize = Math.min(
        numSize * 0.95,
        cell.h * 0.38,
        (width * 0.9) / (advanceOf(chapter.chartAbbr) * chapter.chartAbbr.length),
      );
    }
    // Where two lines will not fit, the abbreviation alone still marks the book.
    if (bookSize >= 6.8 && bookSize + numSize + 2 <= cell.h * 0.95) {
      const top = cell.cy - (bookSize + numSize + 1) / 2;
      const bookY = (top + bookSize / 2).toFixed(1);
      const numY = (top + bookSize + 1 + numSize / 2).toFixed(1);
      return (
        `<text class="lab" style="${tone}" x="${x}" y="${y}">` +
        `<tspan class="bk" x="${x}" y="${bookY}" font-size="${bookSize.toFixed(1)}">${chapter.chartAbbr}</tspan>` +
        `<tspan x="${x}" y="${numY}" font-size="${numSize.toFixed(1)}">1</tspan></text>`
      );
    }
    const size = fitFont(cell, chapter.chartAbbr, 12, cell.h);
    return `<text class="lab bk" style="${tone}" x="${x}" y="${y}" font-size="${size.toFixed(1)}">${chapter.chartAbbr}</text>`;
  }

  const size = fitFont(cell, String(chapter.chapter), 14, cell.h);
  return `<text class="lab" style="${tone}" x="${x}" y="${y}" font-size="${size.toFixed(1)}">${chapter.chapter}</text>`;
}

function renderChart() {
  const rows = window.innerWidth < NARROW_BREAKPOINT ? ROWS_NARROW : ROWS_WIDE;
  const phrase = layoutPhrase(rows);
  const pad = 6;
  let svg =
    `<svg viewBox="${-pad} ${-pad} ${phrase.width + pad * 2} ${phrase.height + pad * 2}" ` +
    `role="group" aria-label="Book of Mormon reading chart">`;

  for (const letter of phrase.letters) {
    svg += `<g transform="translate(${letter.x.toFixed(1)},${letter.y.toFixed(1)})">`;
    for (const cell of letter.cells) {
      const chapter = CHAPTERS[cell.index];
      cellGeometry[cell.index] = cell;
      svg +=
        `<path class="cell" d="${cell.d}" data-i="${cell.index}" ` +
        `style="--c:${chapter.color}" ` +
        `role="checkbox" aria-checked="false" tabindex="0" aria-label="${chapter.label}"></path>` +
        labelFor(chapter, cell);
    }
    svg += '</g>';
  }
  svg += '</svg>';
  chartWrap.innerHTML = svg;

  chartWrap.querySelectorAll('.cell').forEach((node) => {
    const index = Number(node.dataset.i);
    cellNodes[index] = node;
    labelNodes[index] = node.nextElementSibling;
  });
  fitLabelsToCells();
  resetZoom();
  syncAll();
}

const MIN_LABEL_SIZE = 5.6;
const MAX_LABEL_SIZE = 14;

/**
 * Glyph metrics vary by font and character, so the estimated sizes above are
 * only a starting point. Measure what actually rendered, then scale each label
 * to the largest size that still fits its cell. Text scales linearly with font
 * size, so the limits can be solved directly rather than iterated.
 */
function fitLabelsToCells() {
  for (let index = 0; index < TOTAL; index++) {
    const text = labelNodes[index];
    const cell = cellGeometry[index];
    if (!text || !cell) continue;
    const box = text.getBBox();
    if (!box.width || !box.height) continue;

    const spans = text.querySelectorAll('tspan');
    const targets = spans.length ? [...spans] : [text];
    const sizes = targets.map((node) => parseFloat(node.getAttribute('font-size')));

    // A little breathing room so labels never touch the cell outline.
    const room = 0.9;
    const limits = [
      (cell.w * room) / box.width,
      (cell.h * 0.84) / box.height,
      MAX_LABEL_SIZE / Math.max(...sizes),
    ];
    // A slanted cell loses width as the label gets taller, and vice versa.
    if (cell.shearY) limits.push((cell.h * room) / (box.width * cell.shearY + box.height));
    if (cell.shearX) limits.push((cell.w * room) / (box.width + cell.shearX * box.height));

    const factor = Math.min(...limits);
    if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.02) continue;

    targets.forEach((node, position) => {
      node.setAttribute('font-size', Math.max(MIN_LABEL_SIZE, sizes[position] * factor).toFixed(1));
      if (node !== text) {
        const y = parseFloat(node.getAttribute('y'));
        node.setAttribute('y', (cell.cy + (y - cell.cy) * factor).toFixed(1));
      }
    });
  }
}

/* ------------------------------------------------------------ list build */

function renderList() {
  listView.innerHTML = BOOKS.map((book, bookIndex) => {
    const offset = BOOK_OFFSETS[bookIndex];
    const chips = Array.from({ length: book.chapters }, (_, i) => {
      const index = offset + i;
      const chapter = CHAPTERS[index];
      const text = book.chapters === 1 ? '1' : String(i + 1);
      return (
        `<button class="chip" type="button" role="checkbox" aria-checked="false" ` +
        `data-i="${index}" aria-label="${chapter.label}">${text}</button>`
      );
    }).join('');
    return (
      `<details class="book" data-book="${bookIndex}" style="--c:${book.color};--tc:${textOn(book.color)}">` +
      `<summary><span class="dot" aria-hidden="true"></span>` +
      `<span class="book-name">${book.name}</span>` +
      `<span class="book-count" data-count="${bookIndex}">0/${book.chapters}</span></summary>` +
      `<div class="book-bar"><i data-bar="${bookIndex}" style="width:0%"></i></div>` +
      `<div class="chips">${chips}</div></details>`
    );
  }).join('');

  listView.querySelectorAll('.chip').forEach((node) => {
    chipNodes[Number(node.dataset.i)] = node;
  });
}

/* ---------------------------------------------------------------- update */

function syncCell(index) {
  const isRead = read[index];
  const cell = cellNodes[index];
  if (cell) {
    cell.classList.toggle('read', isRead);
    cell.setAttribute('aria-checked', String(isRead));
  }
  const chip = chipNodes[index];
  if (chip) chip.setAttribute('aria-checked', String(isRead));
}

function syncBook(bookIndex) {
  const offset = BOOK_OFFSETS[bookIndex];
  const total = BOOKS[bookIndex].chapters;
  let done = 0;
  for (let i = 0; i < total; i++) if (read[offset + i]) done++;
  const count = listView.querySelector(`[data-count="${bookIndex}"]`);
  const bar = listView.querySelector(`[data-bar="${bookIndex}"]`);
  if (count) count.textContent = `${done}/${total}`;
  if (bar) bar.style.width = `${(done / total) * 100}%`;
}

function nextUnread() {
  return read.indexOf(false);
}

function syncSummary() {
  const done = read.reduce((sum, v) => sum + (v ? 1 : 0), 0);
  const pct = Math.round((done / TOTAL) * 100);
  $('progressFill').style.width = `${(done / TOTAL) * 100}%`;
  $('progressCount').textContent = `${done} of ${TOTAL} chapters`;
  $('progressPct').textContent = `${pct}%`;
  document.querySelector('.progress').classList.toggle('is-complete', done === TOTAL);

  const next = nextUnread();
  const markBtn = $('markNextBtn');
  if (next === -1) {
    $('nextChapter').textContent = 'You have read the Book of Mormon';
    document.querySelector('.next-label').textContent = 'Finished';
    markBtn.disabled = true;
    markBtn.textContent = 'Complete';
  } else {
    $('nextChapter').textContent = CHAPTERS[next].label;
    document.querySelector('.next-label').textContent = 'Up next';
    markBtn.disabled = false;
    markBtn.textContent = 'Mark read';
  }
}

function syncAll() {
  for (let i = 0; i < TOTAL; i++) syncCell(i);
  BOOKS.forEach((_, i) => syncBook(i));
  syncSummary();
}

/* --------------------------------------------------------------- actions */

let toastTimer;
function showToast(message, undoable) {
  $('toastText').textContent = message;
  $('undoBtn').hidden = !undoable;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => { toast.hidden = true; }, 220);
  }, 4000);
}

function toggle(index, { announce = true } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL) return;
  undoStack.push({ type: 'toggle', index, previous: read[index] });
  if (undoStack.length > 60) undoStack.shift();
  read[index] = !read[index];
  syncCell(index);
  syncBook(CHAPTERS[index].bookIndex);
  syncSummary();
  save();
  if (read[index]) navigator.vibrate?.(8);
  if (announce) {
    showToast(`${CHAPTERS[index].label} ${read[index] ? 'marked read' : 'cleared'}`, true);
  }
}

function undo() {
  const action = undoStack.pop();
  if (!action) return;
  if (action.type === 'toggle') {
    read[action.index] = action.previous;
    syncCell(action.index);
    syncBook(CHAPTERS[action.index].bookIndex);
  } else {
    read = action.snapshot.slice();
    syncAll();
  }
  syncSummary();
  save();
  showToast('Undone', false);
}

function flash(index) {
  const cell = cellNodes[index];
  if (!cell) return;
  cell.classList.add('flash');
  setTimeout(() => cell.classList.remove('flash'), 550);
}

/* -------------------------------------------------------------- zoom/pan */

const MIN_SCALE = 1;
const MAX_SCALE = 6;
let scale = 1;
let tx = 0;
let ty = 0;

function applyTransform() {
  chartWrap.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(3)})`;
  stage.style.touchAction = scale > 1.01 ? 'none' : 'pan-y';
}

function clampPan() {
  const w = chartWrap.offsetWidth;
  const h = chartWrap.offsetHeight;
  tx = Math.min(0, Math.max(w * (1 - scale), tx));
  ty = Math.min(0, Math.max(h * (1 - scale), ty));
}

function zoomAt(nextScale, anchorX, anchorY) {
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  const pointX = (anchorX - tx) / scale;
  const pointY = (anchorY - ty) / scale;
  scale = clamped;
  tx = anchorX - pointX * scale;
  ty = anchorY - pointY * scale;
  clampPan();
  applyTransform();
}

function resetZoom() {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

function stagePoint(event) {
  const rect = chartWrap.getBoundingClientRect();
  return { x: event.clientX - rect.left + tx, y: event.clientY - rect.top + ty };
}

const pointers = new Map();
let pinch = null;
let multiTouch = false;

stage.addEventListener('pointerdown', (event) => {
  pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    time: Date.now(),
    moved: false,
    target: event.target,
  });
  if (pointers.size === 2) {
    multiTouch = true;
    const [a, b] = [...pointers.values()];
    const rect = chartWrap.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;
    pinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      scale,
      pointX: (midX - tx) / scale,
      pointY: (midY - ty) / scale,
    };
  }
  try { stage.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
});

stage.addEventListener('pointermove', (event) => {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;
  const previousX = pointer.x;
  const previousY = pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 8) pointer.moved = true;

  if (pointers.size >= 2 && pinch) {
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const rect = chartWrap.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - rect.left + tx;
    const midY = (a.y + b.y) / 2 - rect.top + ty;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (pinch.scale * distance) / pinch.distance));
    tx = midX - pinch.pointX * scale;
    ty = midY - pinch.pointY * scale;
    clampPan();
    applyTransform();
    event.preventDefault();
    return;
  }

  if (pointers.size === 1 && scale > 1.01 && pointer.moved) {
    tx += event.clientX - previousX;
    ty += event.clientY - previousY;
    clampPan();
    applyTransform();
    event.preventDefault();
  }
});

function endPointer(event) {
  const pointer = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!pointer) return;

  const isTap = !pointer.moved && !multiTouch && Date.now() - pointer.time < 700;
  if (isTap && event.type === 'pointerup') {
    const hit = pointer.target instanceof Element ? pointer.target.closest('[data-i]') : null;
    if (hit) toggle(Number(hit.dataset.i));
  }
  if (pointers.size === 0) multiTouch = false;
}

stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

stage.addEventListener('wheel', (event) => {
  if (!event.ctrlKey && scale <= 1.01) return; // let the page scroll
  event.preventDefault();
  const point = stagePoint(event);
  zoomAt(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), point.x, point.y);
}, { passive: false });

stage.addEventListener('keydown', (event) => {
  const cell = event.target instanceof Element ? event.target.closest('[data-i]') : null;
  if (!cell) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggle(Number(cell.dataset.i));
  }
});

document.querySelectorAll('[data-zoom]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.zoom;
    if (mode === 'reset') { resetZoom(); return; }
    const centerX = chartWrap.offsetWidth / 2;
    const centerY = Math.min(chartWrap.offsetHeight, stage.clientHeight) / 2;
    zoomAt(mode === 'in' ? scale * 1.4 : scale / 1.4, centerX, centerY);
  });
});

/* ------------------------------------------------------------- list taps */

listView.addEventListener('click', (event) => {
  const chip = event.target instanceof Element ? event.target.closest('.chip') : null;
  if (chip) toggle(Number(chip.dataset.i));
});

/* ----------------------------------------------------------------- tabs */

function selectTab(name) {
  const isChart = name === 'chart';
  chartView.hidden = !isChart;
  listView.hidden = isChart;
  $('tabChart').classList.toggle('is-active', isChart);
  $('tabList').classList.toggle('is-active', !isChart);
  $('tabChart').setAttribute('aria-selected', String(isChart));
  $('tabList').setAttribute('aria-selected', String(!isChart));
  if (!isChart) openBookForNext();
}

function openBookForNext() {
  const next = nextUnread();
  if (next === -1) return;
  const target = listView.querySelector(`details[data-book="${CHAPTERS[next].bookIndex}"]`);
  if (target && !target.open) target.open = true;
}

$('tabChart').addEventListener('click', () => selectTab('chart'));
$('tabList').addEventListener('click', () => selectTab('list'));

/* -------------------------------------------------------------- controls */

$('markNextBtn').addEventListener('click', () => {
  const next = nextUnread();
  if (next === -1) return;
  toggle(next);
  flash(next);
});

$('undoBtn').addEventListener('click', undo);

$('themeBtn').addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = current ? (current === 'dark' ? 'light' : 'dark') : (systemDark ? 'light' : 'dark');
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
});

const menuDialog = $('menuDialog');

$('menuBtn').addEventListener('click', () => {
  $('backupCode').value = encodeState(read);
  menuDialog.showModal();
});

$('copyBtn').addEventListener('click', async () => {
  const field = $('backupCode');
  try {
    await navigator.clipboard.writeText(field.value);
    showToast('Backup code copied', false);
  } catch {
    field.select();
    showToast('Select and copy the code', false);
  }
});

$('restoreBtn').addEventListener('click', () => {
  const restored = decodeState($('backupCode').value);
  if (!restored) {
    showToast('That code was not recognized', false);
    return;
  }
  undoStack.push({ type: 'bulk', snapshot: read.slice() });
  read = restored;
  syncAll();
  save();
  menuDialog.close();
  showToast('Progress restored', true);
});

$('resetBtn').addEventListener('click', () => {
  if (!read.some(Boolean)) {
    showToast('Nothing to reset', false);
    return;
  }
  if (!confirm('Clear every chapter and start the chart over?')) return;
  undoStack.push({ type: 'bulk', snapshot: read.slice() });
  read = new Array(TOTAL).fill(false);
  syncAll();
  save();
  menuDialog.close();
  showToast('Chart cleared', true);
});

/* ----------------------------------------------------------------- init */

function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  } catch {
    /* ignore */
  }
}

let resizeTimer;
let wasNarrow = window.innerWidth < NARROW_BREAKPOINT;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const isNarrow = window.innerWidth < NARROW_BREAKPOINT;
    if (isNarrow !== wasNarrow) {
      wasNarrow = isNarrow;
      renderChart();
    } else {
      clampPan();
      applyTransform();
    }
  }, 180);
});

initTheme();
load();
renderList();
renderChart();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  });
}
