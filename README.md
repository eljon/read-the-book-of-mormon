# I Have Read the Book of Mormon

A mobile-first reading chart for the Book of Mormon. The phrase
**I HAVE READ THE BOOK OF MORMON** is drawn as block letters whose strokes are
sliced into 239 pieces, one for every chapter in the book. Tap a piece to mark
that chapter read and the letters fill in, book by book, as you go.

Inspired by the printable chart handed out in Primary and seminary classes.

## Features

- **239 tappable cells**, in canonical order from 1 Nephi 1 to Moroni 10. The
  first cell of each book is labelled with the book's abbreviation.
- **Colour by book.** Completed chapters fill with their book's colour, running
  through the spectrum in reading order, so the chart becomes a rainbow.
- **Two ways to mark.** Tap the chart directly, or open the **Books** tab for a
  large-target chapter grid with per-book progress. An **Up next** bar marks the
  next unread chapter in one tap for anyone reading straight through.
- **Pinch to zoom and drag to pan** the chart, with `-` / `Fit` / `+` controls
  for pointer devices. Vertical page scrolling stays available until you zoom in.
- **Undo** on every change, plus a confirmed reset.
- **Backup codes.** Progress lives in this browser only; the options sheet hands
  you a short code to copy to another phone or browser.
- **Works offline** and can be installed to a home screen (service worker +
  web app manifest).
- **Light and dark themes**, following the system setting unless you override it.
- **Keyboard and screen reader support** — every cell is a labelled checkbox
  ("Alma 12"), reachable by Tab and toggled with Enter or Space.

No build step, no dependencies, no tracking, no network requests.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` publishes the repository root on
every push to the default branch.

Pages has to be switched on once by hand — the workflow's token is not allowed
to do it:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Re-run the latest run from the **Actions** tab, or push again.

After that every push to the default branch publishes automatically. Pushes to
other branches never publish.

The site is then served at `https://<owner>.github.io/read-the-book-of-mormon/`.
Every path in the app is relative, so it works from that subdirectory without
configuration.

## Running locally

The app uses ES modules, so open it over HTTP rather than from the filesystem:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How the chart is built

`src/letters.js` describes each letter as strokes — vertical and horizontal
bars, tapered legs for `A V M N K`, and elliptical arc bands for the bowls of
`B D R` and the rings of `O`. Each stroke is sliced into cells, and the 24
letters hold exactly 239 of them:

```
I 5   H 9   A 10  V 9   E 10  R 10  E 10  A 10
D 10  T 9   H 9   E 10  B 11  O 11  O 11  K 9
O 11  F 9   M 12  O 11  R 10  M 12  O 11  N 10
```

Cells are numbered in reading order across the phrase and mapped straight onto
the chapter list in `src/books.js`, so a cell always means the same chapter no
matter which row layout is in use (four rows on wide screens, six on narrow
ones).

Labels are sized per cell and then measured after rendering and rescaled to the
largest size that fits, allowing for the shear of slanted pieces.

## Project layout

```
index.html              app shell
styles.css              theming and layout
src/books.js            the 15 books, 239 chapters, colours
src/letters.js          block-letter geometry and phrase layout
src/app.js              rendering, state, gestures, persistence
sw.js                   offline cache
manifest.webmanifest    installable web app metadata
```

## Storage

Progress is stored in `localStorage` under `bom-chart:v1` as a short code such
as `BOM1-ff3c…`, which is the same code the options sheet shows for backup.
Clearing site data clears progress, so copy the code if it matters to you.
