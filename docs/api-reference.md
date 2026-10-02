<img src="logo.png" alt="Gambix logo" width="120" align="right" />

<pre>
 ██████   █████   ███    ███  ██████   ██  ██   ██
██       ██   ██  ████  ████  ██   ██  ██   ██ ██
██  ███  ███████  ██ ████ ██  ██████   ██    ███
██   ██  ██   ██  ██  ██  ██  ██   ██  ██   ██ ██
 ██████  ██   ██  ██      ██  ██████   ██  ██   ██

                G A M B I X . J S
</pre>

# API Reference — Public APIs Only

> **Rule:** this file covers **only** the public API defined on the `Gambix` class in `ts/index.ts`:
> direct public methods and `on*` subscriptions.
> The raw internal events (`interaction:*` / `board:*` / `drawing:*`) are **deliberately not documented here** — use the `on*` methods only.

Every `on*` method returns `unsubscribe: () => void`. Example:

```js
const off = board.onMoveRequested(({ from, to }) => {
  /* ... */
});
off(); // unsubscribe
```

---

## Constructor & Lifecycle

### `new Gambix(element, props?)`

- `element: string` — CSS selector of an existing element (throws an `Error` if not found).
- `props: ChessOptions` — config object (documented in `configuration.md`).
- Lifecycle: `destroy(): void` — tears down all listeners, animations, and plugins.
- Plugins: `usePlugin(plugin: GambixPlugin): void`.

## Board State — FEN and pieces

| Method     | Signature                                        | Description                                                      |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `getFEN`   | `() => string`                                   | Current FEN                                                      |
| `loadFEN`  | `(fen: string) => boolean`                       | Load a new position with diff animation. `false` for invalid FEN. Reloading the current FEN is a silent no-op (no redraw, no `fen-changed`) |
| `getBoard` | `() => Array<{ square, piece: string \| null }>` | All 64 squares                                                   |
| `getPiece` | `(square: string) => { type, color } \| null`    | Piece on a given square                                          |

## View — display and theme

| Method                                   | Signature                                                      | Description                                  |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| `getTheme`                               | `() => ThemeConfig`                                            | Current theme                                |
| `setTheme`                               | `(theme: Partial<ThemeConfig>) => void`                        | Partial merge + re-render                    |
| `reStyleBoard`                           | `(whiteSquareColor: string, blackSquareColor: string) => void` | Quickly change both square colors            |
| `reStyleCoords`                          | `(cfg: Partial<ThemeConfig["coord"]>) => void`                 | Coordinate settings                          |
| `reStylePiece`                           | `(cfg: Partial<ThemeConfig["pieces"]>) => void`                | Piece settings                               |
| `resize`                                 | `(width: number) => void`                                      | New size in pixels                           |
| `enableAutoResize` / `disableAutoResize` | `() => void`                                                   | Follow the parent size automatically or stop |
| `flipBoard`                              | `() => void`                                                   | Flip the board (white ⇄ black)               |
| `getOrientation`                         | `() => "white" \| "black"`                                     | Current orientation                          |

## Interaction — move control

| Method                    | Signature                                                  | Description                               |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `getPlayer`               | `() => "white" \| "black" \| "both" \| "none"`             | Current value                             |
| `enableInteractionFor`    | `(player: "white" \| "black" \| "both") => void`           | Who is allowed to move                    |
| `disableInteractionFor`   | `() => void`                                               | Disables all moves                        |
| `getInteractionSettings`  | `() => InteractionConfig`                                  | Current interaction settings              |
| `rejectMove`              | `() => void`                                               | Snap the piece back + clear legal moves   |
| `rejectMoveFrom`          | `(from: string, to?: string \| null) => void`              | Same as above but with event payload data |

## Promotion

| Method                  | Signature                                                                 | Description                                    |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `choosePromotion`       | `(from: string, to: string, promotion: string) => void`                   | Programmatic pick (`"q" \| "r" \| "b" \| "n"`). Non-promotion moves are ignored with a dev warning |
| `cancelPromotion`       | `() => void`                                                              | Cancel the pending promotion + snap back       |
| `getPromotionPending`   | `() => { from, to, color } \| null`                                       | Is a promotion pending?                        |

## Arrows / Drawing

| Method                       | Signature                                                                 | Description                         |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| `drawArrow`                  | `(start: string, end: string, color?: string, width?: number) => boolean` | Draw an arrow programmatically      |
| `removeArrow`                | `(start: string, end: string) => boolean`                                 | Remove a specific arrow             |
| `clearArrows`                | `() => void`                                                              | Clear temporary (user-drawn) arrows |
| `clearArrowsAll`             | `() => void`                                                              | Clear all (temporary + persistent)  |
| `getArrows`                  | `() => Array<{ from, to, color, persistent }>`                            | Current arrows                      |
| `enableDraw` / `disableDraw` | `() => void`                                                              | Enable/disable mouse drawing        |

## Highlights

| Method                                   | Signature                                                             | Description                                |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| `setHighlight`                           | `(square: string, color?: string) => void`                            | Persistent highlight on a square           |
| `removeHighlight`                        | `(square: string) => void`                                            | Remove a square highlight                  |
| `clearHighlights`                        | `() => void`                                                          | Clear temporary ones                       |
| `clearHighlightsAll`                     | `() => void`                                                          | Clear all                                  |
| `getHighlights`                          | `() => HighlightRecord[]`                                             | `{ square, kind, color? }[]`               |
| `enableHighlights` / `disableHighlights` | `() => void`                                                          | Highlight master switch                    |
| `setLastMove`                            | `(from: string \| null, to: string \| null) => void`                  | Color the last move (`null, null` = clear) |
| `getLastMove`                            | `() => { from, to } \| null`                                          | Last colored move                          |
| `setCheck`                               | `(square: string \| null) => void`                                    | Color check                                |
| `clearCheck`                             | `() => void`                                                          | Clear check                                |
| `setCheckmate`                           | `(winnerSquare: string \| null, loserSquare: string \| null) => void` | Color mate                                 |
| `clearCheckmate`                         | `() => void`                                                          | Clear mate                                 |
| `setLegalMoves`                          | `(squares: string[]) => void`                                         | Show dots/rings manually                   |
| `clearLegalMoves`                        | `() => void`                                                          | Clear them                                 |
| `setLegalMoveRatio`                      | `(dotRatio: number, ringRatio: number) => void`                       | Dot/ring size relative to the square       |
| `updateLegalMoveScale`                   | `() => void`                                                          | Recompute size after a manual `resize`     |

## Animations

| Method                                   | Signature                              | Description                                              |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `enableAnimations` / `disableAnimations` | `() => void`                           | Turn on/off                                              |
| `updateAnimationConfig`                  | `(cfg: BoardAnimationOptions) => void` | Partial update (`move/capture/spawn/snapback/autoSpeed`) |

## Events — `on*` subscriptions (subscribe only)

Each method returns `() => void` (unsubscribe). This is the **complete** list — nothing else:

**Selection and moves:**

- `onPieceSelected(cb: ({ square, piece }) => string[] | void)` — a returned array is auto-rendered as legal moves.
- `onSquareSelected(cb: ({ square, piece }) => void)`
- `onMoveRequested(cb: ({ from, to, promotion? }) => boolean | void | Promise<...>)` — return `false` (or a Promise of `false`) and the library snaps the piece back automatically. A rejected/thrown async handler is logged via `console.error` and treated as a rejection (snapback).
- `onFenChanged(cb: (fen: string) => void)`

**Drag:**

- `onDragStart(cb: ({ square, piece }) => void)`
- `onDragEnd(cb: ({ from, to: string | null, piece }) => void)`
- `onMoveAnimatedEnd(cb: ({ from, to, isCapture }) => void)`
- `onSnapbackTriggered(cb: ({ from, to: string | null }) => void)`

**Promotion:**

- `onPromotionRequested(cb: ({ from, to, color, piece }) => string | false | void | Promise<...>)`
- `onPromotionSelected(cb: ({ from, to, promotion }) => void)` — each choice emits exactly once (subscribe with `onPromotionSelected` only; the internal `board:promotion-chosen` mirror event is not public API)
- `onPromotionCancelled(cb: ({ from, to }) => void)`

**Drawing and arrows:**

- `onDrawStart / onDrawMove / onDrawEnd(cb: ({ from, to }) => void)`
- `onDrawCleared(cb: () => void)`
- `onArrowAdded(cb: ({ from, to, color }) => void)`
- `onArrowRemoved(cb: ({ from, to }) => void)`
- `onArrowsCleared(cb: () => void)`

**Highlights and piece placement:**

- `onHighlightToggled(cb: ({ square, active, color? }) => void)`
- `onHighlightsCleared(cb: () => void)`
- `onSquareHighlight(cb: (square: string) => void)`
- `onPiecePlaced(cb: ({ to, piece }) => void)` — `customizable` boardType only
- `onPieceRemoved(cb: ({ from }) => void)` — `customizable` boardType only. Dropping a piece outside the board emits `piece-removed` only (no `drag-end`)

**Keyboard:**

- `onKeyPressed(cb: (key: string) => void)`
- `onKeyUp(cb: (key: string) => void)`

**Generic (advanced use only):**

- `on(event, cb)` / `off(event, cb)` / `once(event, cb)` — same subscription behavior with a string event name.

> The same names are available as `onX` keys in the constructor config object (e.g. `onMoveRequested`, `onFenChanged`, ...).
