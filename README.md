<img src="docs/logo.png" alt="Gambix logo" width="160" align="right" />

<pre>
 ██████   █████   ███    ███  ██████   ██  ██   ██
██       ██   ██  ████  ████  ██   ██  ██   ██ ██
██  ███  ███████  ██ ████ ██  ██████   ██    ███
██   ██  ██   ██  ██  ██  ██  ██   ██  ██   ██ ██
 ██████  ██   ██  ██      ██  ██████   ██  ██   ██

                G A M B I X . J S
</pre>

**Gambix** — a modern, responsive, dependency-free chessboard UI library for JavaScript and TypeScript.

[🌐 **Live Demo & Documentation**](https://gambixjs.vercel.app)

[![npm version](https://img.shields.io/npm/v/gambixjs?color=cb3837&style=flat-square)](https://www.npmjs.com/package/gambixjs)
[![npm downloads](https://img.shields.io/npm/dt/gambixjs?style=flat-square)](https://www.npmjs.com/package/gambixjs)
[![license](https://img.shields.io/npm/l/gambixjs?style=flat-square)](https://github.com/mohamed33elwardani/GambixJS/blob/master/LICENSE)
[![bundle size](https://img.shields.io/bundlephobia/minzip/gambixjs?style=flat-square)](https://bundlephobia.com/package/gambixjs)

The library handles **rendering and interaction only** (render + drag / click + arrows + highlights + promotion + animations + plugins). It has no built-in chess logic (no move legality checking, no check/mate, no turn tracking). To build a complete game, pair it with an external logic library such as `chess.js`.

> The single source of truth for the public API is the `Gambix` class in `ts/index.ts`.
> Anything other than the direct `Gambix` methods / `on*` subscriptions is **not** part of the API.

## Features

- Full board rendering (FEN in / out) with flip, resize, and auto-resize
- Drag and/or click-to-move mechanics with snapback (piece rejection)
- Drawing arrows (right-click + Control / Shift / Alt) + square highlights
- Highlighting: last move, selected piece, legal moves (dots/rings), check, checkmate
- Promotion with a built-in vertical picker UI (`onPromotionRequested` / `onPromotionSelected`)
- Animations for moves / captures / spawns / snapbacks
- Plugin system (`usePlugin`)
- `on*`-only events (e.g. `onMoveRequested`, `onPieceSelected`) — each returns an `unsubscribe` function

## Installation

```bash
npm i gambixjs
```

Or for development / building from source via GitHub repository ([mohamed33elwardani/GambixJS](https://github.com/mohamed33elwardani/GambixJS/tree/master)):

```bash
git clone https://github.com/mohamed33elwardani/GambixJS.git
cd GambixJS
npm install
npm run build   # dist/bundle.js
npm run dev     # watch mode
```

### Quick Usage

Modern Bundler (Vite, Next.js, Webpack, etc.):

```js
import Gambix from "gambixjs";

const board = new Gambix("#chess", {
  fen: "start",
  theme: { boardSize: 600, orientation: "white" },
  interaction: { control: "both", moveMechanic: "both" },
});
```

Browser via CDN / ESM:

```html
<div id="chess"></div>
<script type="module">
  import Gambix from "https://esm.sh/gambixjs";

  const board = new Gambix("#chess", {
    fen: "start",
    theme: { boardSize: 600, orientation: "white" },
    interaction: { control: "both", moveMechanic: "both" },
  });
</script>
```

## Connecting logic (summary)

Gambix does **not** validate moves. The official pattern is:

```js
import Gambix from "./dist/bundle.js";
import { Chess } from "https://esm.sh/chess.js@1.4.0";

const board = new Gambix("#chess", { fen: "start" });
const logic = new Chess();

// 1. Show legal moves when the user selects a piece
board.onPieceSelected(({ square, piece }) => {
  if (!piece) {
    board.clearLegalMoves();
    return;
  }
  return logic.moves({ square, verbose: true }).map((m) => m.to);
});

// 2. Execute the move in the logic lib, then update the UI
board.onMoveRequested(({ from, to, promotion }) => {
  try {
    const mv = promotion
      ? logic.move({ from, to, promotion })
      : logic.move({ from, to });
    if (!mv) {
      board.rejectMoveFrom(from, to);
      return;
    }
    board.loadFEN(logic.fen());
    board.setLastMove(from, to);
  } catch {
    board.rejectMoveFrom(from, to);
  }
});
```

Full details in [`docs/quick-start.md`](docs/quick-start.md).

> After any change under `ts/`, run `npm run build` before committing so `dist/bundle.js` stays in sync with the source.

## Documentation

| File                                             | Contents                                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| [`docs/quick-start.md`](docs/quick-start.md)     | Run the library from scratch + connect it to `chess.js`                           |
| [`docs/configuration.md`](docs/configuration.md) | Full reference for the config object (`ChessOptions`) and defaults                |
| [`docs/api-reference.md`](docs/api-reference.md) | All public methods + `on*` subscriptions from `index.ts`                          |
| [`docs/llms.md`](docs/llms.md)                   | Condensed complete reference for AI models (config + APIs + integration patterns) |

## Quick example — FEN, arrows, highlights

```js
// FEN
console.log(board.getFEN());
board.loadFEN("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");

// Arrows
board.drawArrow("e2", "e4", "rgba(255,170,0,0.8)", 2.5);
board.removeArrow("e2", "e4");
board.clearArrows();

// Highlights
board.setHighlight("e4", "rgba(248,85,63,0.8)");
board.setLastMove("e2", "e4");
board.setCheck("e8");
board.clearCheck();
```

## License

MIT — © 2026 Mohamed Mustafa El-Wardani. See [`LICENSE`](LICENSE).
