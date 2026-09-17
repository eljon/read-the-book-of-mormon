/**
 * Block-letter geometry for "I HAVE READ THE BOOK OF MORMON".
 *
 * Every letter is built from strokes (bars, tapered legs, donut arcs) and each
 * stroke is sliced into cells. Across the 24 letters the cells total exactly
 * 239 -- one per chapter of the Book of Mormon -- so the phrase itself is the
 * progress chart.
 *
 * All letters are drawn in a local box: y from 0 (top) to 140 (baseline).
 */

export const LETTER_HEIGHT = 140;

const round = (n) => Math.round(n * 100) / 100;
const fmt = (p) => `${round(p[0])},${round(p[1])}`;
const constant = (v) => () => v;

/**
 * `w`/`h` describe the room actually available for a label, which for a slanted
 * cell is much less than its bounding box. Callers pass the true stroke
 * dimensions; otherwise the bounding box is used.
 */
function polygon(points, w, h, shear) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    d: `M${points.map(fmt).join('L')}Z`,
    cx: xs.reduce((a, b) => a + b, 0) / xs.length,
    cy: ys.reduce((a, b) => a + b, 0) / ys.length,
    w: w ?? Math.max(...xs) - Math.min(...xs),
    h: h ?? Math.max(...ys) - Math.min(...ys),
    // How far the stroke slides sideways/downwards across the cell, so labels
    // can be shrunk to stay inside slanted pieces.
    shearX: shear?.shearX ?? 0,
    shearY: shear?.shearY ?? 0,
  };
}

/** Slice the band between two x-boundary functions into `n` cells, top to bottom. */
function taperY(out, leftAt, rightAt, y0, y1, n, reverse = false) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const a = y0 + ((y1 - y0) * i) / n;
    const b = y0 + ((y1 - y0) * (i + 1)) / n;
    const mid = (a + b) / 2;
    // Width measured across the middle of the slice, plus how fast both edges
    // slide sideways: together they bound what a label can occupy.
    const width = rightAt(mid) - leftAt(mid);
    const slide =
      (Math.abs(leftAt(b) - leftAt(a)) + Math.abs(rightAt(b) - rightAt(a))) / (2 * Math.abs(b - a));
    cells.push(polygon(
      [[leftAt(a), a], [rightAt(a), a], [rightAt(b), b], [leftAt(b), b]],
      width, b - a, { shearX: slide },
    ));
  }
  out.push(...(reverse ? cells.reverse() : cells));
}

/** Slice the band between two y-boundary functions into `n` cells, left to right. */
function taperX(out, topAt, bottomAt, x0, x1, n, reverse = false) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n;
    const b = x0 + ((x1 - x0) * (i + 1)) / n;
    const mid = (a + b) / 2;
    const height = bottomAt(mid) - topAt(mid);
    const drop =
      (Math.abs(topAt(b) - topAt(a)) + Math.abs(bottomAt(b) - bottomAt(a))) / (2 * Math.abs(b - a));
    cells.push(polygon(
      [[a, topAt(a)], [b, topAt(b)], [b, bottomAt(b)], [a, bottomAt(a)]],
      b - a, height, { shearY: drop },
    ));
  }
  out.push(...(reverse ? cells.reverse() : cells));
}

const vbar = (out, x, y, w, h, n, reverse) =>
  taperY(out, constant(x), constant(x + w), y, y + h, n, reverse);

const hbar = (out, x, y, w, h, n, reverse) =>
  taperX(out, constant(y), constant(y + h), x, x + w, n, reverse);

/** Wedges of an elliptical donut, sweeping clockwise from a0 to a1 (degrees, 0 = east). */
function arcBand(out, cx, cy, rxOuter, ryOuter, rxInner, ryInner, a0, a1, n, reverse = false) {
  const at = (rx, ry, deg) => {
    const t = (deg * Math.PI) / 180;
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
  };
  const cells = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const b = a0 + ((a1 - a0) * (i + 1)) / n;
    const outerA = at(rxOuter, ryOuter, a);
    const outerB = at(rxOuter, ryOuter, b);
    const innerB = at(rxInner, ryInner, b);
    const innerA = at(rxInner, ryInner, a);
    const large = Math.abs(b - a) > 180 ? 1 : 0;
    const mid = at((rxOuter + rxInner) / 2, (ryOuter + ryInner) / 2, (a + b) / 2);
    cells.push({
      d:
        `M${fmt(outerA)}A${round(rxOuter)},${round(ryOuter)} 0 ${large} 1 ${fmt(outerB)}` +
        `L${fmt(innerB)}A${round(rxInner)},${round(ryInner)} 0 ${large} 0 ${fmt(innerA)}Z`,
      cx: mid[0],
      cy: mid[1],
      shearX: 0,
      shearY: 0,
      w: Math.hypot(
        at((rxOuter + rxInner) / 2, (ryOuter + ryInner) / 2, a)[0] - mid[0],
        at((rxOuter + rxInner) / 2, (ryOuter + ryInner) / 2, a)[1] - mid[1],
      ) * 2,
      h: Math.min(rxOuter - rxInner, ryOuter - ryInner),
    });
  }
  out.push(...(reverse ? cells.reverse() : cells));
}

/**
 * Letter builders. Each returns its advance width and pushes its cells in the
 * order chapters should be numbered through the letter.
 */
const LETTERS = {
  I(out) {
    vbar(out, 0, 0, 34, 140, 5);
    return 34;
  },

  H(out) {
    vbar(out, 0, 0, 30, 140, 4);
    hbar(out, 30, 55, 40, 30, 1);
    vbar(out, 70, 0, 30, 140, 4);
    return 100;
  },

  A(out) {
    const outerLeft = (y) => 38 - (38 * y) / 140;
    const outerRight = (y) => 66 + (38 * y) / 140;
    const innerLeft = (y) => 52 - (20 * (y - 36)) / 104;
    const innerRight = (y) => 52 + (20 * (y - 36)) / 104;
    // apex, left leg, crossbar, right leg
    out.push(polygon([[38, 0], [66, 0], [outerRight(36), 36], [outerLeft(36), 36]], 28, 36));
    taperY(out, outerLeft, innerLeft, 36, 140, 4);
    out.push(polygon([
      [innerLeft(104), 104], [innerRight(104), 104],
      [innerRight(126), 126], [innerLeft(126), 126],
    ], innerRight(115) - innerLeft(115), 22));
    taperY(out, innerRight, outerRight, 36, 140, 4);
    return 104;
  },

  V(out) {
    const outerLeft = (y) => (38 * y) / 140;
    const innerLeft = (y) => 30 + (22 * y) / 104;
    const innerRight = (y) => 74 - (22 * y) / 104;
    const outerRight = (y) => 104 - (38 * y) / 140;
    // down the left leg, through the point, back up the right leg
    taperY(out, outerLeft, innerLeft, 0, 104, 4);
    out.push(polygon([
      [outerLeft(104), 104], [outerRight(104), 104], [66, 140], [38, 140],
    ], 28, 36));
    taperY(out, innerRight, outerRight, 0, 104, 4, true);
    return 104;
  },

  E(out) {
    vbar(out, 0, 0, 30, 140, 4);
    hbar(out, 30, 0, 58, 30, 2);
    hbar(out, 30, 55, 50, 30, 2);
    hbar(out, 30, 110, 58, 30, 2);
    return 88;
  },

  F(out) {
    vbar(out, 0, 0, 30, 140, 5);
    hbar(out, 30, 0, 58, 30, 2);
    hbar(out, 30, 55, 50, 30, 2);
    return 88;
  },

  T(out) {
    hbar(out, 0, 0, 96, 30, 3);
    vbar(out, 33, 30, 30, 110, 6);
    return 96;
  },

  D(out) {
    vbar(out, 0, 0, 30, 140, 4);
    arcBand(out, 30, 70, 70, 70, 40, 40, -90, 90, 6);
    return 100;
  },

  B(out) {
    vbar(out, 0, 0, 30, 140, 3);
    arcBand(out, 30, 35, 66, 35, 38, 13, -90, 90, 4);
    arcBand(out, 30, 105, 70, 35, 42, 13, -90, 90, 4);
    return 100;
  },

  R(out) {
    vbar(out, 0, 0, 30, 140, 4);
    arcBand(out, 30, 36, 66, 36, 36, 14, -90, 90, 3);
    taperX(out, (x) => 72 + ((x - 30) * 38) / 66, (x) => 102 + ((x - 30) * 38) / 66, 30, 96, 3);
    return 100;
  },

  O(out) {
    arcBand(out, 52, 70, 52, 70, 22, 40, -90, 270, 11);
    return 104;
  },

  K(out) {
    vbar(out, 0, 0, 30, 140, 4);
    // upper arm read inward from the top right, then the lower arm outward
    taperX(out, (x) => 36 - (36 * (x - 30)) / 66, (x) => 70 - (36 * (x - 30)) / 66, 30, 96, 3, true);
    taperX(out, (x) => 70 + (36 * (x - 30)) / 66, (x) => 104 + (36 * (x - 30)) / 66, 30, 96, 2);
    return 96;
  },

  M(out) {
    vbar(out, 0, 0, 30, 140, 4);
    taperX(out, (x) => (x - 30) * 1.9375, (x) => (x - 30) * 1.9375 + 44, 30, 62, 2);
    taperX(out, (x) => 62 - (x - 62) * 1.9375, (x) => 106 - (x - 62) * 1.9375, 62, 94, 2);
    vbar(out, 94, 0, 30, 140, 4);
    return 124;
  },

  N(out) {
    vbar(out, 0, 0, 30, 140, 4);
    taperX(out, (x) => (x - 30) * 2, (x) => (x - 30) * 2 + 52, 30, 74, 2);
    vbar(out, 74, 0, 30, 140, 4);
    return 104;
  },
};

export function buildLetter(character) {
  const build = LETTERS[character];
  if (!build) throw new Error(`No glyph defined for "${character}"`);
  const cells = [];
  const width = build(cells);
  return { character, width, cells };
}

export const ROWS_WIDE = ['I HAVE', 'READ THE', 'BOOK OF', 'MORMON'];
export const ROWS_NARROW = ['I HAVE', 'READ', 'THE', 'BOOK', 'OF', 'MORMON'];

const GAP = { letter: 18, word: 46, row: 44 };

/**
 * Position every letter of the phrase and hand back cells numbered 0..238 in
 * reading order. The letter sequence is identical for every row layout, so a
 * cell always maps to the same chapter.
 */
export function layoutPhrase(rows) {
  const built = rows.map((row) => [...row].map((ch) => (ch === ' ' ? null : buildLetter(ch))));

  const widthOf = (items) => {
    let width = 0;
    let previous = null;
    for (const item of items) {
      if (!item) {
        width += GAP.word;
        previous = null;
      } else {
        if (previous) width += GAP.letter;
        width += item.width;
        previous = item;
      }
    }
    return width;
  };

  const totalWidth = Math.max(...built.map(widthOf));
  const totalHeight = rows.length * LETTER_HEIGHT + (rows.length - 1) * GAP.row;

  const letters = [];
  let index = 0;

  built.forEach((items, rowIndex) => {
    let x = (totalWidth - widthOf(items)) / 2;
    const y = rowIndex * (LETTER_HEIGHT + GAP.row);
    let previous = null;
    for (const item of items) {
      if (!item) {
        x += GAP.word;
        previous = null;
        continue;
      }
      if (previous) x += GAP.letter;
      letters.push({
        character: item.character,
        x,
        y,
        width: item.width,
        cells: item.cells.map((cell) => ({ ...cell, index: index++ })),
      });
      x += item.width;
      previous = item;
    }
  });

  return { width: totalWidth, height: totalHeight, letters, cellCount: index };
}
