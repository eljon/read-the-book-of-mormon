/**
 * The Book of Mormon: 15 books, 239 chapters, in canonical order.
 * Colors run through the spectrum in reading order so the chart fills
 * in like a rainbow as chapters are completed.
 */
export const BOOKS = [
  { name: '1 Nephi',         abbr: '1 Ne',   chapters: 22, color: '#d64545' },
  { name: '2 Nephi',         abbr: '2 Ne',   chapters: 33, color: '#dd6b2a' },
  { name: 'Jacob',           abbr: 'Jacob',  chapters: 7,  color: '#a8751a', chartAbbr: 'Jac' },
  { name: 'Enos',            abbr: 'Enos',   chapters: 1,  color: '#7c8420' },
  { name: 'Jarom',           abbr: 'Jarom',  chapters: 1,  color: '#4f8a2c' },
  { name: 'Omni',            abbr: 'Omni',   chapters: 1,  color: '#2e9b5e' },
  { name: 'Words of Mormon', abbr: 'W of M', chapters: 1,  color: '#17998f', chartAbbr: 'WoM' },
  { name: 'Mosiah',          abbr: 'Mosiah', chapters: 29, color: '#2b8ac4', chartAbbr: 'Mos' },
  { name: 'Alma',            abbr: 'Alma',   chapters: 63, color: '#3c6fd1', chartAbbr: 'Alm' },
  { name: 'Helaman',         abbr: 'Hel',    chapters: 16, color: '#6258d4' },
  { name: '3 Nephi',         abbr: '3 Ne',   chapters: 30, color: '#8c4fcc' },
  { name: '4 Nephi',         abbr: '4 Ne',   chapters: 1,  color: '#b344bd' },
  { name: 'Mormon',          abbr: 'Morm',   chapters: 9,  color: '#cc3f91' },
  { name: 'Ether',           abbr: 'Ether',  chapters: 15, color: '#c7405f', chartAbbr: 'Eth' },
  { name: 'Moroni',          abbr: 'Moro',   chapters: 10, color: '#8c6239' },
];

/** Flat, ordered list of every chapter in the book. */
export const CHAPTERS = [];
BOOKS.forEach((book, bookIndex) => {
  for (let ch = 1; ch <= book.chapters; ch++) {
    CHAPTERS.push({
      index: CHAPTERS.length,
      bookIndex,
      book: book.name,
      abbr: book.abbr,
      color: book.color,
      chartAbbr: book.chartAbbr || book.abbr,
      chapter: ch,
      single: book.chapters === 1,
      isBookStart: ch === 1,
      label: book.chapters === 1 ? `${book.name} 1` : `${book.name} ${ch}`,
    });
  }
});

export const TOTAL = CHAPTERS.length; // 239

/** Index of the first chapter of each book, for jump links and list rendering. */
export const BOOK_OFFSETS = (() => {
  const offsets = [];
  let running = 0;
  for (const book of BOOKS) { offsets.push(running); running += book.chapters; }
  return offsets;
})();

/** Black or white text, whichever reads better on the given fill. */
export function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return lum > 0.42 ? '#14181d' : '#ffffff';
}
