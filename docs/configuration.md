<img src="logo.png" alt="Gambix logo" width="120" align="right" />

<pre>
 ██████   █████   ███    ███  ██████   ██  ██   ██
██       ██   ██  ████  ████  ██   ██  ██   ██ ██
██  ███  ███████  ██ ████ ██  ██████   ██    ███
██   ██  ██   ██  ██  ██  ██  ██   ██  ██   ██ ██
 ██████  ██   ██  ██      ██  ██████   ██  ██   ██

                G A M B I X . J S
</pre>

# Configuration — The Config Object (`ChessOptions`)

The constructor looks like this:

```ts
new Gambix(element: string, props: ChessOptions = {})
```

Every field is **optional** and is deep-merged over the defaults in `ts/src/config/defaults.ts`.
So you only send what you want to change.

```js
const board = new Gambix("#chess", {
  fen: "start",
  theme: { orientation: "white", boardSize: 600 },
  interaction: { control: "both", moveMechanic: "both" },
  drawing: { enabled: true },
  highlights: { enabled: true },
  animations: { enabled: true },
});
```

---

## 1. `fen?: string`

- `"start"` or a full FEN string. Default: the standard start position.
- Default value: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
- To change the position after creation, use `loadFEN()`, not the config.

## 2. `theme?: object` — general appearance

| Key             | Type                                       | Default                      | Description                                                                             |
| --------------- | ------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| `orientation`   | `"white" \| "black"`                       | `"white"`                    | Board orientation (which side is at the bottom)                                         |
| `boardSize`     | `number`                                   | `600`                        | Board size in pixels (square)                                                           |
| `boardType`     | `"standard" \| "customizable"`             | `"customizable"`             | `customizable` allows dragging pieces from outside the board (spare trays)              |
| `autoResize`    | `boolean`                                  | `true`                       | Automatically follow the parent element size                                            |
| `responsive`    | `boolean`                                  | — (no effect)                | Accepted in `ChessOptions.theme` for typing compat only — has no effect in `ts/`; use `autoResize` |
| `squares`       | `{ type, light, dark }`                    | `color / #ebecd0 / #739552`  | Square colors (`type` is `"color"` or `"image"`)                                        |
| `coord`         | `{ show, placement, light, dark, color? }` | `show:true / inside`         | a-h / 1-8 coordinates. `placement: "inside" \| "outside"`                               |
| `pieces.type`   | `"images" \| "svg"`                        | `"images"`                   | Piece asset type                                                                        |
| `pieces.assets` | `{ white:{...}, black:{...} }`             | cburnett images from lichess | Image URLs for `pawn/rook/knight/bishop/queen/king` per color — override any single one |

Example:

```js
theme: {
  orientation: "black",
  boardSize: 560,
  boardType: "standard",
  autoResize: false,
  squares: { type: "color", light: "#ebecd0", dark: "#739552" },
  coord: { show: true, placement: "inside", light: "#739552", dark: "#ebecd0" },
  pieces: {
    type: "images",
    assets: { white: { knight: "https://.../wN.svg" } }, // partial merge is allowed
  },
}
```

> Runtime changes: `setTheme(partial)` / `reStyleBoard(light, dark)` / `reStyleCoords(cfg)` / `reStylePiece(cfg)` / `resize(width)` / `flipBoard()`.

## 3. `interaction?: object` — who moves and how

| Key            | Type                                     | Default                  | Description                                                          |
| -------------- | ---------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `control`      | `"white" \| "black" \| "both" \| "none"` | `"both"`                 | Which side is allowed to move pieces                                 |
| `moveMechanic` | `"drag" \| "click" \| "both"`            | `"both"`                 | Mouse drag and/or click-click movement                               |
| `snapback`     | `{ duration?, easing? }`                 | — (unset by default)     | Rejected-piece snapback animation (default `150ms / ease-out` lives under `animations.snapback`; merged in via `updateAnimationConfig`) |

```js
interaction: { control: "white", moveMechanic: "drag" }
```

> Runtime: `enableInteractionFor()` / `disableInteractionFor()` / `getPlayer()` / `getInteractionSettings()`.
> Reject a move manually: `rejectMove()` / `rejectMoveFrom(from, to)`.

## 4. `drawing?: object` — arrows

| Key         | Type                                   | Default                        | Description                                                                          |
| ----------- | -------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `enabled`   | `boolean`                              | `true`                         | Enable mouse drawing                                                                 |
| `lineColor` | `string`                               | — (falls back to `buttons[0]`) | Fallback default color (resolved at runtime in `arrows.ts` from `buttons[0].color`)  |
| `lineWidth` | `number`                               | — (falls back to `buttons[0]`) | Fallback default width (resolved at runtime from `buttons[0].lineWidth ?? 2.5`)      |
| `buttons`   | `Array<{ button, color, lineWidth? }>` | 4 buttons (see below)          | Each button = keyboard-button name + its own color + its own width                   |

Default:

```js
drawing: {
  enabled: true,
  buttons: [
    { button: "mainColor", color: "rgba(255, 170, 0, 0.8)", lineWidth: 2.5 },
    { button: "Control",   color: "rgba(248, 85, 63, 0.8)", lineWidth: 2.5 },
    { button: "Shift",     color: "rgba(72, 193, 249, 0.8)", lineWidth: 2.5 },
    { button: "Alt",       color: "rgba(159, 207, 63, 0.8)", lineWidth: 2.5 },
  ],
}
```

- `mainColor` = right-drag alone. The rest combine the right button with a keyboard key.
- Runtime: `drawArrow()` / `removeArrow()` / `clearArrows()` / `clearArrowsAll()` / `getArrows()` / `enableDraw()` / `disableDraw()`.

## 5. `highlights?: object` — highlighting

| Key                | Default                                                             | Description                                                     |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `enabled`          | `true`                                                              | Master switch                                                   |
| `lastMove`         | `{ enable:true, type:"color", color:"rgba(255,255,51,0.5)" }`       | Last-move squares                                               |
| `selectedPiece`    | `{ enable:true, type:"color", color:"rgba(0,255,64,0.5)" }`         | Selected piece                                                  |
| `inCheck`          | `{ enable:true, type:"blink", color:"rgba(255,0,0,1)" }`            | Check (blinking)                                                |
| `checkmate.winner` | `{ enable:true, type:"blink", color:"rgba(0,206,0,0.81)" }`         | Winner king                                                     |
| `checkmate.loser`  | `{ enable:true, type:"blink", color:"rgba(204,0,0,0.81)" }`         | Loser king                                                      |
| `legalMoves`       | `{ enable:true, color:"rgba(0,0,0,0.15)", dotSize:20, ringSize:4 }` | dots (empty square) and rings (occupied square)                 |
| `rightClick`       | 4 buttons (see below)                                               | Same per-button idea as drawing, but for right-click highlights |

Default `rightClick` (from `defaults.ts` — note the first two colors are swapped vs `drawing.buttons`):

```js
highlights: {
  rightClick: [
    { button: "mainColor", color: "rgba(248, 85, 63, 0.8)" },
    { button: "Control",   color: "rgba(255, 170, 0, 0.8)" },
    { button: "Shift",     color: "rgba(72, 193, 249, 0.8)" },
    { button: "Alt",       color: "rgba(159, 207, 63, 0.8)" },
  ],
}
```

`type` is `"color"` (static) or `"blink"` (pulsing, for check/mate only).

## 6. `animations?: object` — animations

```js
animations: {
  enabled: true,
  move:    { duration: 800, easing: "ease-in-out" },
  capture: { duration: 280, easing: "ease-in-out" },
  spawn:   { duration: 120, easing: "ease-in" },
  snapback:{ duration: 150, easing: "ease-out" },
  autoSpeed: true, // shorten duration automatically based on move distance
}
```

Runtime: `enableAnimations()` / `disableAnimations()` / `updateAnimationConfig(cfg)`.

## 7. `plugins?: GambixPlugin[]`, validators, and callbacks

```ts
interface GambixPlugin {
  readonly name: string;
  install(context: { root; eventBus; board }): void;
  destroy?(): void;
}
```

```js
const board = new Gambix("#chess", {
  plugins: [myPlugin], // or later: board.usePlugin(myPlugin)

  // Shorthands for subscribing to events from the constructor (same as on*):
  onMoveRequested: ({ from, to }) => {
    /* ... */
  },
  onPieceSelected: ({ square, piece }) => [
    /* legal squares */
  ],
  onFenChanged: (fen) => {},
});
```

All `onX` keys in the config are wired automatically to the equivalent `on*` methods (full list in `api-reference.md`).
