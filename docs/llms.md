# Gambix — LLM Reference (llms.txt)

> Single-file complete reference for AI models. Source of truth: class `Gambix` in `ts/index.ts` + `ts/src/types/types.ts` + `ts/src/config/defaults.ts`. Only direct `Gambix` methods and `on*` subscriptions below are public. Raw internal events (`interaction:*`, `board:*`, `drawing:*`) are NOT public API — never suggest them.

## 1. What Gambix is

- Name: gambix, v1.0.0. Dependency-free chessboard UI library (ESM bundle: `dist/bundle.js`, built with esbuild from `ts/index.ts`).
- UI ONLY: rendering, drag/click movement, arrows, highlights, promotion UI, animations, plugins. NO chess rules, NO legality checking, NO turn/check/mate logic.
- Full game = Gambix (view) + external logic lib (e.g. chess.js, chessops). Gambix never validates moves by itself.
- Repository: https://github.com/mohamed33elwardani/GambixJS/tree/master
- Constructor: `new Gambix(element: string, props: ChessOptions = {})`. Throws if selector not found. Config deep-merges over DEFAULT_CONFIG.

## 2. Install / minimal usage

```bash
npm i gambixjs
```

```js
import Gambix from "gambixjs";
const board = new Gambix("#chess", {
  fen: "start",
  theme: { boardSize: 600, orientation: "white" },
  interaction: { control: "both", moveMechanic: "both" },
});
board.loadFEN("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
console.log(board.getFEN());
board.destroy();
```

## 3. Config schema (ChessOptions, all optional)

```ts
type ChessOptions = {
  fen?: string; // "start" | full FEN. default STANDARD_FEN
  theme?: {
    orientation?: "white" | "black";        // default "white"
    boardSize?: number;                     // default 600
    boardType?: "standard" | "customizable"; // default "customizable"
    responsive?: boolean; autoResize?: boolean; // default autoResize true (responsive is accepted in ChessOptions.theme but has no effect in ts/ — use autoResize)
    squares?: Partial<{ type: "color"|"image"; light: string; dark: string }>;
    coord?: Partial<{ show: boolean; placement: "inside"|"outside"; light: string; dark: string; color?: string }>;
    pieces?: { type?: "images"|"svg"; assets?: { white?: Partial<PieceAssets>; black?: Partial<PieceAssets> } };
  };
  interaction?: Partial<{ control: "white"|"black"|"both"|"none"; moveMechanic: "drag"|"click"|"both"; boardType?: "standard"|"customizable"; snapback?: { duration?: number; easing?: string } }>;
  drawing?: Partial<{ enabled: boolean; lineColor?: string; lineWidth?: number; buttons?: Array<{ button: string; color: string; lineWidth?: number }> }>;
  highlights?: Partial<{ enabled: boolean; lastMove: HighlightStyle; selectedPiece: HighlightStyle; inCheck: HighlightStyle; checkmate: { winner: HighlightStyle; loser: HighlightStyle }; legalMoves: { enable: boolean; color: string; dotSize: number; ringSize: number }; rightClick: Array<{ button: string; color: string }> }>;
  animations?: { enabled: boolean; move: { duration?: number; easing?: string; enabled?: boolean }; capture: {...}; spawn: {...}; snapback: {...}; autoSpeed: boolean };
  plugins?: GambixPlugin[];
  // onX callbacks (same signatures as on* methods below):
  onPieceSelected?: (d: { square: string; piece: string | null }) => string[] | void;
  onSquareSelected?: (d: { square: string; piece: string | null }) => void;
  onMoveRequested?: (d: { from: string; to: string; promotion?: string | null }) => boolean | void | Promise<boolean|void>;
  onFenChanged?: (fen: string) => void;
  onDragStart?: (d: { square: string; piece: string | null }) => void;
  onDragEnd?: (d: { from: string; to: string | null; piece: string | null }) => void;
  onPromotionRequested?: (d: { from: string; to: string; color: string; piece: string | null }) => string | false | void | Promise<string|false|void>;
  onPromotionSelected?: (d: { from: string; to: string; promotion: string }) => void;
  onPromotionCancelled?: (d: { from: string; to: string }) => void;
  onDrawStart?: (d: { from: string; to: string }) => void;
  onDrawMove?: (d: { from: string; to: string }) => void;
  onDrawEnd?: (d: { from: string; to: string }) => void;
  onDrawCleared?: () => void;
  onArrowAdded?: (d: { from: string; to: string; color: string }) => void;
  onArrowRemoved?: (d: { from: string; to: string }) => void;
  onArrowsCleared?: () => void;
  onHighlightToggled?: (d: { square: string; active: boolean; color?: string }) => void;
  onHighlightsCleared?: () => void;
  onSquareHighlight?: (square: string) => void;
  onPiecePlaced?: (d: { to: string; piece: string }) => void;
  onPieceRemoved?: (d: { from: string }) => void;
  onKeyPressed?: (key: string) => void;
  onKeyUp?: (key: string) => void;
  onMoveAnimatedEnd?: (d: { from: string; to: string; isCapture: boolean }) => void;
  onSnapbackTriggered?: (d: { from: string; to: string | null }) => void;
};
```

DEFAULT_CONFIG values: theme.orientation "white", boardType "customizable", boardSize 600, autoResize true, squares color #ebecd0/#739552, coord show/inside, pieces images (lichess cburnett SVGs); interaction control "both", moveMechanic "both" (no default snapback in interaction — snapback default 150ms ease-out lives under animations.snapback); drawing enabled true, lineColor/lineWidth unset by default (fall back to buttons[0] at runtime), buttons [mainColor rgba(255,170,0,0.8), Control rgba(248,85,63,0.8), Shift rgba(72,193,249,0.8), Alt rgba(159,207,63,0.8)] each lineWidth 2.5; highlights enabled, lastMove color rgba(255,255,51,0.5), selectedPiece rgba(0,255,64,0.5), inCheck blink rgba(255,0,0,1), checkmate winner blink rgba(0,206,0,0.81) loser blink rgba(204,0,0,0.81), legalMoves enable/color rgba(0,0,0,0.15)/dotSize 20/ringSize 4, rightClick 4 buttons [mainColor rgba(248,85,63,0.8), Control rgba(255,170,0,0.8), Shift rgba(72,193,249,0.8), Alt rgba(159,207,63,0.8)]; animations enabled, move 800ms ease-in-out, capture 280ms, spawn 120ms ease-in, snapback 150ms ease-out, autoSpeed true.

GambixPlugin: `{ readonly name: string; install(ctx: { root: HTMLElement; eventBus: EventBus<ChessEvents>; board: Board }): void; destroy?(): void }`.

## 4. Public methods (complete, from ts/index.ts)

```
// lifecycle / plugins
destroy(): void
usePlugin(plugin: GambixPlugin): void
// state
getFEN(): string
loadFEN(fen: string): boolean
getBoard(): Array<{ square: string; piece: string | null }>
getPiece(square: string): { type: string; color: string } | null
// view
getTheme(): ThemeConfig
setTheme(theme: Partial<ThemeConfig>): void
reStyleBoard(whiteSquareColor: string, blackSquareColor: string): void
reStyleCoords(cfg: Partial<ThemeConfig["coord"]>): void
reStylePiece(cfg: Partial<ThemeConfig["pieces"]>): void
resize(width: number): void
enableAutoResize(): void
disableAutoResize(): void
flipBoard(): void
getOrientation(): "white" | "black"
// interaction
enableInteractionFor(player: "white"|"black"|"both"): void
disableInteractionFor(): void
getPlayer(): "white"|"black"|"both"|"none"
getInteractionSettings(): InteractionConfig
rejectMove(): void
rejectMoveFrom(from: string, to?: string | null): void
// promotion
choosePromotion(from: string, to: string, promotion: string): void
cancelPromotion(): void
getPromotionPending(): { from: string; to: string; color: string } | null
// arrows
drawArrow(start: string, end: string, color?: string, width?: number): boolean
removeArrow(start: string, end: string): boolean
clearArrows(): void
clearArrowsAll(): void
getArrows(): Array<{ from: string; to: string; color: string; persistent: boolean }>
enableDraw(): void
disableDraw(): void
// highlights
setHighlight(square: string, color?: string): void
removeHighlight(square: string): void
clearHighlights(): void
clearHighlightsAll(): void
getHighlights(): HighlightRecord[]  // { square, kind, color? }, kind = user|locked|selected|lastmove|check|checkmate-winner|checkmate-loser|legal-dot|legal-ring
enableHighlights(): void
disableHighlights(): void
setLastMove(from: string | null, to: string | null): void
getLastMove(): { from: string; to: string } | null
setCheck(square: string | null): void
clearCheck(): void
setCheckmate(winnerSquare: string | null, loserSquare: string | null): void
clearCheckmate(): void
setLegalMoves(squares: string[]): void
clearLegalMoves(): void
setLegalMoveRatio(dotRatio: number, ringRatio: number): void
updateLegalMoveScale(): void
// animations
enableAnimations(): void
disableAnimations(): void
updateAnimationConfig(cfg: BoardAnimationOptions): void
```

## 5. Public subscriptions onAPI (complete — each returns () => void)

```
onPieceSelected(cb: (d: { square: string; piece: string | null }) => string[] | void): () => void  // return string[] => auto-renders legal dots/rings
onSquareSelected(cb: (d: { square: string; piece: string | null }) => void): () => void
onMoveRequested(cb: (d: { from: string; to: string; promotion?: string | null }) => boolean | void | Promise<boolean|void>): () => void  // return false (or Promise false) => auto snapback
onFenChanged(cb: (fen: string) => void): () => void
onDragStart(cb: (d: { square: string; piece: string | null }) => void): () => void
onDragEnd(cb: (d: { from: string; to: string | null; piece: string | null }) => void): () => void
onPromotionRequested(cb: (d: { from: string; to: string; color: string; piece: string | null }) => string | false | void | Promise<string|false|void>): () => void
onPromotionSelected(cb: (d: { from: string; to: string; promotion: string }) => void): () => void
onPromotionCancelled(cb: (d: { from: string; to: string }) => void): () => void
onDrawStart(cb: (d: { from: string; to: string }) => void): () => void
onDrawMove(cb: (d: { from: string; to: string }) => void): () => void
onDrawEnd(cb: (d: { from: string; to: string }) => void): () => void
onDrawCleared(cb: () => void): () => void
onArrowAdded(cb: (d: { from: string; to: string; color: string }) => void): () => void
onArrowRemoved(cb: (d: { from: string; to: string }) => void): () => void
onArrowsCleared(cb: () => void): () => void
onHighlightToggled(cb: (d: { square: string; active: boolean; color?: string }) => void): () => void
onHighlightsCleared(cb: () => void): () => void
onSquareHighlight(cb: (square: string) => void): () => void
onPiecePlaced(cb: (d: { to: string; piece: string }) => void): () => void  // customizable boardType only
onPieceRemoved(cb: (d: { from: string }) => void): () => void              // customizable boardType only
onKeyPressed(cb: (key: string) => void): () => void
onKeyUp(cb: (key: string) => void): () => void
onMoveAnimatedEnd(cb: (d: { from: string; to: string; isCapture: boolean }) => void): () => void
onSnapbackTriggered(cb: (d: { from: string; to: string | null }) => void): () => void
on<T>(event: string, cb: (payload: any) => void): () => void
off<T>(event: string, cb: (payload: any) => void): void
once<T>(event: string, cb: (payload: any) => void): () => void
```

Public instance fields (read-mostly): `rootElement`, `theme`, `board`, `interactionSettings`, `interaction?`, `drawing`, `draw?`, `highlights`, `highlighter`, `plugins`.

## 6. Canonical logic integration (chess.js)

```js
import Gambix from "./dist/bundle.js";
import { Chess } from "https://esm.sh/chess.js@1.4.0";
const board = new Gambix("#chess", { fen: "start" });
const logic = new Chess();
board.onPieceSelected(({ square, piece }) => {
  if (!piece) {
    board.clearLegalMoves();
    return;
  }
  return logic.moves({ square, verbose: true }).map((m) => m.to);
});
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
    board.clearLegalMoves();
    board.setLastMove(from, to);
  } catch {
    board.rejectMoveFrom(from, to);
  }
});
```

Rules for codegen: (1) Always pair with external logic lib — never invent move validation. (2) After successful logic.move, MUST call loadFEN(logic.fen()) + setLastMove. (3) On illegal move MUST call rejectMoveFrom(from, to). (4) Legal hints ONLY via returning string[] from onPieceSelected or setLegalMoves(). (5) Check/mate visuals ONLY via setCheck/setCheckmate driven by logic lib. (6) Only use methods/events listed above.

License: MIT (c) 2026 Mohamed Mustafa El-Wardani.
