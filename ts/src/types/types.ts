import type EventBus from "../events/event-bus.ts";
import type Board from "../ui/board.ts";

/**
 * Chess square name such as "e4".
 * Used by: PositionMap, BoardCell, FenStore.
 */
export type SquareName = string;

/**
 * Compact piece code with color prefix (e.g. "wp", "bk").
 * Used by: PositionMap, FenStore.getPieceCode, Board rendering.
 */
export type PieceCode = string;

/**
 * Map from square name to piece code or null for empties.
 * Used by: FenStore, Board props, parseFenToMap.
 */
export type PositionMap = Map<SquareName, PieceCode | null>;

/**
 * Map from square name to piece code for occupied squares only.
 * Used by: Highlights legal-move calculations.
 */
export type OccupiedMap = Map<SquareName, PieceCode>;

/**
 * Single board square paired with its current piece.
 * Used by: FenStore.getBoard, Gambix.getBoard.
 */
export interface BoardCell {
  square: string;
  piece: PieceCode | null;
}

/**
 * Describes the change between two FEN positions.
 * Used by: FenStore.setFen, Gambix.loadFEN, Board.applyFenDiff.
 */
export interface FenDiff {
  oldFen: string;
  newFen: string;
  oldMap: PositionMap;
  newMap: PositionMap;
  changed: string[];
}

/**
 * Image URLs for all six piece kinds of one color.
 * Used by: PiecesTheme assets, DEFAULT_CONFIG theme.
 */
export type PieceAssets = {
  pawn: string;
  rook: string;
  knight: string;
  bishop: string;
  queen: string;
  king: string;
};

/**
 * Theme for light and dark board squares.
 * Used by: ThemeConfig, Board.reStyle.
 */
export interface SquareTheme {
  type: "color" | "image";
  light: string;
  dark: string;
}

/**
 * Theme for rank/file coordinate labels.
 * Used by: ThemeConfig, Board coordinate rendering.
 */
export interface CoordTheme {
  show: boolean;
  placement: "inside" | "outside";
  light: string;
  dark: string;
  color?: string;
}

/**
 * Theme for piece rendering with white and black assets.
 * Used by: ThemeConfig, PromotionManager, DEFAULT_CONFIG.
 */
export interface PiecesTheme {
  type: "images" | "svg";
  assets: {
    white: PieceAssets;
    black: PieceAssets;
  };
}

/**
 * Visual board configuration including size and orientation.
 * Used by: DefaultConfig, BoardProps, Gambix theme.
 */
export interface ThemeConfig {
  orientation: BoardOrientation;
  boardSize: number;
  boardType: "standard" | "customizable";
  squares: SquareTheme;
  coord: CoordTheme;
  pieces: PiecesTheme;
  autoResize: boolean;
}

/**
 * Duration and easing settings for one animation category.
 * Used by: BoardAnimationOptions, InteractionConfig snapback.
 */
export interface AnimationCategoryConfig {
  duration?: number;
  easing?: string;
  enabled?: boolean;
}

/**
 * Global animation toggles with per-action timing configs.
 * Used by: DefaultConfig, Board animator, Gambix animations.
 */
export interface BoardAnimationOptions {
  enabled: boolean;
  move: AnimationCategoryConfig;
  capture: AnimationCategoryConfig;
  spawn: AnimationCategoryConfig;
  snapback: AnimationCategoryConfig;
  autoSpeed: boolean;
}

/**
 * Constructor props for the Board view component.
 * Used by: Board constructor, Gambix board setup.
 */
export interface BoardProps {
  element: HTMLElement | null;
  boardTheme: ThemeConfig;

  position: ReadonlyMap<string, string | null>;
  eventBus?: EventBus<ChessEvents> | undefined;
  animations?: BoardAnimationOptions | undefined;
}

/**
 * Player control and move-input mechanics for interaction.
 * Used by: DefaultConfig, Interaction, Gambix settings.
 */
export interface InteractionConfig {
  control: PlayerControl;
  moveMechanic: "drag" | "click" | "both";
  boardType?: "standard" | "customizable";

  snapback?: AnimationCategoryConfig;
}

/**
 * Arrow color and width bound to one drawing button.
 * Used by: DrawingConfig buttons, Arrows rendering.
 */
export interface DrawingConfigButtons {
  button: string;
  color: string;
  lineWidth?: number;
}

/**
 * Arrow-drawing feature flags and button mappings.
 * Used by: DefaultConfig, Arrows, Gambix drawing.
 */
export interface DrawingConfig {
  enabled: boolean;
  lineColor?: string;
  lineWidth?: number;
  buttons: DrawingConfigButtons[];
}

/**
 * Highlight style for legal-move dots and rings.
 * Used by: HighlightsConfig, Highlights display.
 */
export interface LegalMovesHighlight {
  enable: boolean;
  color: string;
  dotSize: number;
  ringSize: number;
}

/**
 * Available highlight animation styles.
 * Used by: HighlightStyle, Highlights rendering.
 */
export type HighlightType = "color" | "blink";

/**
 * Enable flag with visual style for one highlight kind.
 * Used by: HighlightsConfig, Highlights display.
 */
export interface HighlightStyle {
  enable: boolean;
  type: HighlightType;
  color: string;
}

/**
 * Separate highlight styles for checkmate winner and loser.
 * Used by: HighlightsConfig, Highlights display.
 */
export interface CheckmateHighlight {
  winner: HighlightStyle;
  loser: HighlightStyle;
}

/**
 * All square-highlight categories for last move, check and hints.
 * Used by: DefaultConfig, Highlights, Gambix highlights.
 */
export interface HighlightsConfig {
  enabled: boolean;
  lastMove: HighlightStyle;
  selectedPiece: HighlightStyle;
  inCheck: HighlightStyle;
  checkmate: CheckmateHighlight;
  legalMoves: LegalMovesHighlight;
  rightClick: {
    button: string;
    color: string;
  }[];
}

/**
 * Public constructor options accepted by the Gambix widget.
 * Used by: Gambix constructor, plugin setup.
 */
export interface ChessOptions {
  fen?: string;
  theme?: {
    orientation?: "white" | "black";
    boardSize?: number;
    boardType?: "standard" | "customizable";
    responsive?: boolean;
    autoResize?: boolean;
    squares?: Partial<SquareTheme>;
    coord?: Partial<CoordTheme>;
    pieces?: {
      type?: "images" | "svg";
      assets?: {
        white?: Partial<PieceAssets>;
        black?: Partial<PieceAssets>;
      };
    };
  };
  interaction?: Partial<InteractionConfig>;
  drawing?: Partial<DrawingConfig>;
  highlights?: Partial<HighlightsConfig>;
  animations?: BoardAnimationOptions;
  plugins?: GambixPlugin[];

  onPieceSelected?: (data: {
    square: string;
    piece: string | null;
  }) => string[] | void;
  onSquareSelected?: (data: { square: string; piece: string | null }) => void;

  onMoveRequested?: (data: {
    from: string;
    to: string;
    promotion?: string | null;
  }) => boolean | void | Promise<boolean | void>;

  onFenChanged?: (fen: string) => void;

  onDragStart?: (data: { square: string; piece: string | null }) => void;

  onDragEnd?: (data: {
    from: string;
    to: string | null;
    piece: string | null;
  }) => void;

  onPromotionRequested?: (data: {
    from: string;
    to: string;
    color: string;
    piece: string | null;
  }) => string | false | void | Promise<string | false | void>;

  onPromotionSelected?: (data: {
    from: string;
    to: string;
    promotion: string;
  }) => void;

  onPromotionCancelled?: (data: { from: string; to: string }) => void;

  onDrawStart?: (data: { from: string; to: string }) => void;
  onDrawMove?: (data: { from: string; to: string }) => void;
  onDrawEnd?: (data: { from: string; to: string }) => void;
  onDrawCleared?: () => void;
  onArrowAdded?: (data: { from: string; to: string; color: string }) => void;
  onArrowRemoved?: (data: { from: string; to: string }) => void;
  onArrowsCleared?: () => void;
  onHighlightToggled?: (data: {
    square: string;
    active: boolean;
    color?: string;
  }) => void;
  onHighlightsCleared?: () => void;
  onSquareHighlight?: (square: string) => void;
  onPiecePlaced?: (data: { to: string; piece: string }) => void;
  onPieceRemoved?: (data: { from: string }) => void;
  onKeyPressed?: (key: string) => void;
  onKeyUp?: (key: string) => void;
  onMoveAnimatedEnd?: (data: {
    from: string;
    to: string;
    isCapture: boolean;
  }) => void;
  onSnapbackTriggered?: (data: { from: string; to: string | null }) => void;
}

/**
 * Side to move or interact as white or black.
 * Used by: PlayerControl, BoardOrientation, Highlights.
 */
export type PieceColor = "white" | "black";
/**
 * Which side the user may control during interaction.
 * Used by: InteractionConfig, Gambix player controls.
 */
export type PlayerControl = PieceColor | "both" | "none";
/**
 * Board viewing direction from White or Black side.
 * Used by: ThemeConfig, Board orientation, Arrows.
 */
export type BoardOrientation = PieceColor;

/**
 * Pending promotion move awaiting the player's piece choice.
 * Used by: PromotionManager, promotion event payloads.
 */
export interface PromotionPending {
  from: string;
  to: string;
  color: string;
  piece: string | null;
}

/**
 * Callback deciding the promotion piece for a pending move.
 * Used by: ChessOptions.onPromotionRequested, PromotionManager.
 */
export type PromotionRequestHandler = (data: {
  from: string;
  to: string;
  color: string;
  piece: string | null;
}) => string | false | void | Promise<string | false | void>;

/**
 * Minimal theme slice needed to render promotion choices.
 * Used by: PromotionDeps.getTheme, PromotionManager.
 */
export interface PromotionTheme {
  orientation: "white" | "black";
  boardSize: number;
  pieces: {
    assets: {
      white: Record<string, string>;
      black: Record<string, string>;
    };
  };
}

/**
 * Board accessors injected into the promotion manager.
 * Used by: PromotionManager constructor, Gambix setup.
 */
export interface PromotionDeps {
  eventBus: EventBus<ChessEvents>;
  getPiece: (square: string) => { type: string; color: string } | null;
  getBoardElement: () => HTMLElement | null;
  getTheme: () => PromotionTheme;
  onRejectMove: (from: string, to: string | null) => void;
}

/**
 * Stored arrow with endpoints, color and marker styling.
 * Used by: Arrows.drawArrow, Gambix.getArrows.
 */
export interface ArrowRecord {
  from: string;
  to: string;
  color: string;
  persistent: boolean;

  markerId: string;

  width: number;
}

/**
 * Categories of square highlights from user marks to game state.
 * Used by: HighlightRecord, Highlights rendering.
 */
export type HighlightKind =
  | "user"
  | "locked"
  | "selected"
  | "lastmove"
  | "check"
  | "checkmate-winner"
  | "checkmate-loser"
  | "legal-dot"
  | "legal-ring";

/**
 * Single highlighted square with its kind and color.
 * Used by: Highlights display, Gambix.getHighlights.
 */
export interface HighlightRecord {
  square: string;
  kind: HighlightKind;
  color?: string;
}

/**
 * Event payload carrying one square name.
 * Used by: ChessEvents square-selected interactions.
 */
export interface SquarePayload {
  square: string;
}

/**
 * Event payload requesting a move between two squares.
 * Used by: ChessEvents move-requested, Interaction.
 */
export interface MoveRequestPayload {
  from: string;
  to: string;
  promotion?: string | null;
}

/**
 * Event payload with details for a promotion request.
 * Used by: ChessEvents promotion-requested, PromotionManager.
 */
export interface PromotionRequestPayload {
  color: string;
  from: string;
  to: string;
  piece: string | null;
}

/**
 * Event payload reporting the chosen promotion piece.
 * Used by: ChessEvents promotion-selected and promotion-chosen.
 */
export interface PromotionSelectedPayload {
  from: string;
  to: string;
  promotion: string | null;
}

/**
 * Event payload for arrow draw gestures between squares.
 * Used by: ChessEvents draw events, Arrows.
 */
export interface DrawRequestPayload {
  from: string;
  to: string;
}

/**
 * Event payload for a piece placed on a square.
 * Used by: ChessEvents piece-placed, Interaction editor mode.
 */
export interface PiecePlacedPayload {
  to: string;
  piece: string;
}

/**
 * Event payload for a piece removed from a square.
 * Used by: ChessEvents piece-removed, Interaction editor mode.
 */
export interface PieceRemovedPayload {
  from: string;
}

/**
 * Event payload adding or removing one board arrow.
 * Used by: ChessEvents drawing events, Arrows.
 */
export interface ArrowPayload {
  from: string;
  to: string;
  color?: string;
  persistent?: boolean;
}

/**
 * Event payload toggling one square highlight on or off.
 * Used by: ChessEvents highlight-toggled, Highlights.
 */
export interface HighlightToggledPayload {
  square: string;
  active: boolean;
  color?: string;
  persistent?: boolean;
}

/**
 * All event names and payloads exchanged on the board event bus.
 * Used by: EventBus, Gambix event subscriptions, plugins.
 */
export interface ChessEvents {
  "interaction:square-selected": SquarePayload;
  "interaction:move-requested": MoveRequestPayload;
  "interaction:piece-placed": PiecePlacedPayload;
  "interaction:piece-removed": PieceRemovedPayload;
  "interaction:start-draw": DrawRequestPayload;
  "interaction:draw-move": DrawRequestPayload;
  "interaction:end-draw": DrawRequestPayload;
  "interaction:clear-draw": Record<string, never>;
  "interaction:key-pressed": string;
  "interaction:key-up": string;
  "interaction:highlight-square": string;
  "interaction:drag-start": { square: string; piece: string | null };
  "interaction:drag-end": {
    from: string;
    to: string | null;
    piece: string | null;
  };

  "board:fen-changed": { fen: string };

  "board:piece-selected": { square: string; piece: string | null };
  "board:square-selected": { square: string; piece: string | null };

  "board:move-requested": MoveRequestPayload;

  "board:drag-start": { square: string; piece: string | null };
  "board:drag-end": { from: string; to: string | null; piece: string | null };

  "board:promotion-requested": PromotionRequestPayload;
  "board:promotion-selected": PromotionSelectedPayload;
  "board:promotion-chosen": PromotionSelectedPayload;
  "board:promotion-cancelled": { from: string; to: string };

  "board:draw-start": DrawRequestPayload;
  "board:draw-move": DrawRequestPayload;
  "board:draw-end": DrawRequestPayload;
  "board:draw-cleared": Record<string, never>;

  "drawing:arrow-added": ArrowPayload;
  "drawing:arrow-removed": ArrowPayload;
  "drawing:arrows-cleared": Record<string, never>;
  "drawing:highlight-toggled": HighlightToggledPayload;
  "drawing:highlights-cleared": Record<string, never>;

  "board:move-animated-end": { from: string; to: string; isCapture: boolean };
  "board:snapback-triggered": { from: string; to: string | null };
}

/**
 * Single event-listener callback for a given payload type.
 * Used by: EventBus on/once subscriptions.
 */
export type EventHandler<TPayload> = (payload: TPayload) => void;

/**
 * Root element, event bus and board given to plugins.
 * Used by: GambixPlugin install, PluginManager.
 */
export interface GambixPluginContext {
  root: HTMLElement;
  eventBus: EventBus<ChessEvents>;
  board: Board;
}

/**
 * Plugin with install and optional destroy lifecycle hooks.
 * @param context - Root element, event bus and board for the plugin.
 * @returns Nothing.
 * Used by: ChessOptions plugins, PluginManager, Gambix.usePlugin.
 */
export interface GambixPlugin {
  readonly name: string;
  install(context: GambixPluginContext): void;
  destroy?(): void;
}
