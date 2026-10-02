import BoardAnimator from "./BoardAnimator.ts";
import type EventBus from "../events/event-bus.ts";
import type {
  BoardProps,
  ChessEvents,
  FenDiff,
  PieceAssets,
  ThemeConfig,
} from "../types/types.ts";

const DISPLAY_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const DISPLAY_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const GLYPH_FALLBACK: Record<string, string> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

let boardUidCounter = 0;

/**
 * Partial theme patch for restyling the board without full replacement.
 *
 * Used by: Board.reStyle, Gambix theme updates.
 */
interface ThemePatch {
  orientation?: ThemeConfig["orientation"];
  boardSize?: number;
  boardType?: ThemeConfig["boardType"];
  squares?: Partial<ThemeConfig["squares"]>;
  coord?: Partial<ThemeConfig["coord"]>;
  pieces?: Partial<ThemeConfig["pieces"]>;
  autoResize?: boolean;
}

/**
 * Renders the chessboard DOM and owns square and piece elements.
 *
 * Used by: Gambix facade, BoardAnimator, UI tests.
 */
export default class Board {
  public element: HTMLElement | null;
  public theme: ThemeConfig;
  public animator: BoardAnimator;
  public readonly uid: string;

  private boardElement!: HTMLElement;
  private wrapperElement!: HTMLElement;
  private containerElement!: HTMLElement;
  private squaresContainer!: HTMLElement;
  private piecesContainer!: HTMLElement;
  private rankBox: HTMLElement | null = null;
  private fileBox: HTMLElement | null = null;
  private outerRankCells: HTMLElement[] = [];
  private outerFileCells: HTMLElement[] = [];

  private squareEls = new Map<string, HTMLElement>();
  private pieceEls = new Map<string, HTMLElement>();
  private eventBus: EventBus<ChessEvents>;
  private resizeObserver: ResizeObserver | undefined;
  private lastPosition: Map<string, string | null> = new Map();

  /**
   * Builds board DOM, layout and initial pieces.
   *
   * @param props - Board element, theme, event bus and position.
   * @returns Nothing.
   * Used by: Gambix setup, test helpers.
   */
  constructor(props: BoardProps) {
    this.element = props.element;
    this.theme = props.boardTheme;
    this.eventBus = props.eventBus!;
    this.uid = `g${++boardUidCounter}`;

    this.animator = new BoardAnimator(this, props.animations!, this.eventBus);
    this.setPositionSnapshot(props.position);
    this.preloadAssets();

    this.buildDOM();
    this.updateLayout();
    this.renderBoard();
    this.syncPieces();
  }

  /**
   * Stores a copy of the current position map.
   *
   * @param position - Read-only square to piece mapping.
   * @returns Nothing.
   * Used by: Board constructor, syncPosition, applyFenDiff.
   */
  private setPositionSnapshot(
    position: ReadonlyMap<string, string | null>,
  ): void {
    this.lastPosition = new Map(position);
  }

  /**
   * Replaces the position snapshot and syncs pieces without animation.
   *
   * @param position - New square to piece mapping.
   * @returns Nothing.
   * Used by: Gambix position updates, tests.
   */
  public syncPosition(position: ReadonlyMap<string, string | null>): void {
    this.setPositionSnapshot(position);
    this.syncPieces();
  }

  /**
   * Applies a FEN diff with optional animation.
   *
   * @param diff - Old and new position maps.
   * @param options - Set animate false to sync instantly.
   * @returns Nothing.
   * Used by: Gambix FEN updates, tests.
   */
  public applyFenDiff(
    diff: FenDiff,
    options: { animate?: boolean } = {},
  ): void {
    const animate = options.animate ?? true;
    this.setPositionSnapshot(diff.newMap);
    if (!animate) {
      this.animator.cancelPending();
      this.syncPieces();
      return;
    }
    this.animator.renderSnapshot(diff.oldMap, diff.newMap);
  }

  /**
   * Builds wrapper, coordinate boxes, squares and containers.
   *
   * @returns Nothing.
   * Used by: Board constructor.
   */
  private buildDOM(): void {
    if (!this.element) return;

    this.element.classList.add("gambix-root");

    this.wrapperElement = document.createElement("div");
    this.wrapperElement.className = "gambix-wrapper";

    this.containerElement = document.createElement("div");
    this.containerElement.className = "board-container";

    this.rankBox = document.createElement("div");
    this.rankBox.className = "coord-rank-container";
    this.fileBox = document.createElement("div");
    this.fileBox.className = "coord-fill-container";

    for (let i = 0; i < 8; i++) {
      const rCell = document.createElement("div");
      rCell.className = "coord";
      this.rankBox.appendChild(rCell);
      this.outerRankCells.push(rCell);

      const fCell = document.createElement("div");
      fCell.className = "coord";
      this.fileBox.appendChild(fCell);
      this.outerFileCells.push(fCell);
    }

    this.boardElement = document.createElement("div");
    this.boardElement.className = "gambix-board";
    this.boardElement.setAttribute("data-board-uid", this.uid);
    this.boardElement.setAttribute("role", "grid");
    this.boardElement.setAttribute("aria-label", "Chessboard");

    this.squaresContainer = document.createElement("div");
    this.squaresContainer.className = "squares-container";

    this.piecesContainer = document.createElement("div");
    this.piecesContainer.className = "pieces-container";

    for (const rank of DISPLAY_RANKS) {
      for (const file of DISPLAY_FILES) {
        const squareName = `${file}${rank}`;
        const el = document.createElement("div");
        el.className = "square";
        el.setAttribute("data-square", squareName);
        this.squaresContainer.appendChild(el);
        this.squareEls.set(squareName, el);
      }
    }

    this.boardElement.appendChild(this.squaresContainer);
    this.boardElement.appendChild(this.piecesContainer);

    this.containerElement.appendChild(this.rankBox);
    this.containerElement.appendChild(this.fileBox);
    this.containerElement.appendChild(this.boardElement);

    this.wrapperElement.appendChild(this.containerElement);
    this.element.appendChild(this.wrapperElement);
  }

  /**
   * Updates layout classes and outer coordinates for orientation.
   *
   * @returns Nothing.
   * Used by: Board constructor, flipBoard, reStyle.
   */
  private updateLayout(): void {
    if (!this.wrapperElement) return;

    this.applyCssVars();
    const isCoordOutside = this.theme.coord.placement === "outside";
    const showOuter = isCoordOutside && this.theme.coord.show;

    this.wrapperElement.className = `gambix-wrapper ${isCoordOutside ? "grid" : "normal"}`;
    this.containerElement.classList.toggle("coords-outside", showOuter);

    if (showOuter) {
      this.rankBox?.style.removeProperty("display");
      this.fileBox?.style.removeProperty("display");

      const ranks = this.orderedRanks();
      const files = this.orderedFiles();
      for (let i = 0; i < 8; i++) {
        this.outerRankCells[i]!.textContent = ranks[i]!;
        this.outerFileCells[i]!.textContent = files[i]!;
      }
    } else {
      if (this.rankBox) this.rankBox.style.display = "none";
      if (this.fileBox) this.fileBox.style.display = "none";
    }
  }

  /**
   * Writes board size, square and coordinate CSS variables.
   *
   * @returns Nothing.
   * Used by: updateLayout, resize.
   */
  private applyCssVars(): void {
    const root = this.element;
    if (!root) return;
    root.style.setProperty("--board-size", `${this.theme.boardSize}px`);
    if (this.theme.squares.type === "color") {
      root.style.setProperty("--square-light-color", this.theme.squares.light);
      root.style.setProperty("--square-dark-color", this.theme.squares.dark);
      root.style.setProperty("--square-light-image", "none");
      root.style.setProperty("--square-dark-image", "none");
    } else {
      root.style.setProperty("--square-light-color", "transparent");
      root.style.setProperty("--square-dark-color", "transparent");
      root.style.setProperty(
        "--square-light-image",
        `url(${this.theme.squares.light})`,
      );
      root.style.setProperty(
        "--square-dark-image",
        `url(${this.theme.squares.dark})`,
      );
    }
    root.style.setProperty("--coord-light-color", this.theme.coord.light);
    root.style.setProperty("--coord-dark-color", this.theme.coord.dark);
    if (this.theme.coord.placement === "outside") {
      root.style.setProperty("--coord-color", this.theme.coord.color ?? "");
    }
  }

  /**
   * Returns display-ordered files for the current orientation.
   *
   * @returns File letters from a to h, reversed for black.
   * Used by: updateLayout, renderBoard.
   */
  private orderedFiles(): string[] {
    return this.theme.orientation === "black"
      ? [...DISPLAY_FILES].reverse()
      : [...DISPLAY_FILES];
  }

  /**
   * Returns display-ordered ranks for the current orientation.
   *
   * @returns Rank numbers from 8 to 1, reversed for black.
   * Used by: updateLayout, renderBoard.
   */
  private orderedRanks(): string[] {
    return this.theme.orientation === "black"
      ? [...DISPLAY_RANKS].reverse()
      : [...DISPLAY_RANKS];
  }

  /**
   * Renders square colors and reorders squares for orientation.
   *
   * @returns Nothing.
   * Used by: Board constructor, render, flipBoard, resize, reStyle.
   */
  private renderBoard(): void {
    if (!this.squaresContainer) return;

    const displayFiles = this.orderedFiles();
    const displayRanks = this.orderedRanks();
    const squareWidth = this.theme.boardSize / 8;
    const isImg = this.theme.squares.type === "image";
    const showInner =
      this.theme.coord.placement !== "outside" && this.theme.coord.show;

    const orderedEls: HTMLElement[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const squareName = `${displayFiles[col]!}${displayRanks[row]!}`;
        const el = this.squareEls.get(squareName);
        if (!el) continue;
        orderedEls.push(el);

        const isLight = (row + col) % 2 === 0;
        el.className = `square ${isLight ? "white-square" : "black-square"} ${isImg ? "img" : "color"}`;

        this.updateInnerCoords(
          el,
          row,
          col,
          displayFiles,
          displayRanks,
          isLight,
          squareWidth,
          showInner,
        );
      }
    }
    // Reorder DOM to match orientation: grid renders in DOM order,
    // so without this flipBoard() leaves squares (clicks/highlights)
    // visually mismatched with pieces/arrows (which use flipped coords).
    for (const el of orderedEls) {
      this.squaresContainer.appendChild(el);
    }
  }

  /**
   * Updates inner file and rank labels on one square.
   *
   * @param el - Square element to update.
   * @param row - Display row index.
   * @param col - Display column index.
   * @param displayFiles - Ordered file labels.
   * @param displayRanks - Ordered rank labels.
   * @param isLight - Whether the square is light-colored.
   * @param squareWidth - Square size in px.
   * @param show - Whether inner coords are visible.
   * @returns Nothing.
   * Used by: renderBoard.
   */
  private updateInnerCoords(
    el: HTMLElement,
    row: number,
    col: number,
    displayFiles: string[],
    displayRanks: string[],
    isLight: boolean,
    squareWidth: number,
    show: boolean,
  ): void {
    el.textContent = "";
    if (!show) return;

    const fileLabel = row === 7 ? displayFiles[col] : "";
    const rankLabel = col === 0 ? displayRanks[row] : "";
    const lightClass = isLight ? "light" : "dark";
    const fontSize = `${squareWidth * 0.2}px`;

    if (fileLabel) {
      const s = document.createElement("span");
      s.className = `coord file-coord ${lightClass}`;
      s.style.fontSize = fontSize;
      s.textContent = fileLabel;
      el.appendChild(s);
    }
    if (rankLabel) {
      const s = document.createElement("span");
      s.className = `coord rank-coord ${lightClass}`;
      s.style.fontSize = fontSize;
      s.textContent = rankLabel;
      el.appendChild(s);
    }
  }

  /**
   * Maps a piece code to its display type name.
   *
   * @param pieceCode - Piece code such as wp or bk.
   * @returns Type name like pawn, knight or king.
   * Used by: createPieceElement.
   */
  private pieceTypeName(pieceCode: string): string {
    switch (pieceCode.slice(1).toUpperCase()) {
      case "N":
        return "knight";
      case "B":
        return "bishop";
      case "R":
        return "rook";
      case "Q":
        return "queen";
      case "K":
        return "king";
      default:
        return "pawn";
    }
  }

  /**
   * Creates a piece DOM element positioned on a square.
   *
   * @param pieceCode - Piece code such as wp.
   * @param squareName - Square name such as e2.
   * @param squareWidth - Square size in px.
   * @returns The piece element, or null when assets are missing.
   * Used by: syncPieces, createAndAppendPieceElement.
   */
  private createPieceElement(
    pieceCode: string,
    squareName: string,
    squareWidth: number,
  ): HTMLElement | null {
    const color = pieceCode.startsWith("w") ? "white" : "black";
    const typeName = this.pieceTypeName(pieceCode);
    const assets =
      color === "white"
        ? this.theme.pieces.assets.white
        : this.theme.pieces.assets.black;
    const pieceImage = assets[typeName as keyof PieceAssets];
    if (!pieceImage) return null;

    const span = document.createElement("span");
    span.className = "piece";
    span.setAttribute("data-piece", pieceCode);
    span.setAttribute("data-type", typeName);
    span.setAttribute("data-color", color);
    span.setAttribute("data-square", squareName);
    span.style.width = `${squareWidth * 0.9}px`;
    span.style.height = `${squareWidth * 0.9}px`;

    const image = document.createElement("img");
    image.src = pieceImage;
    image.alt = pieceCode;
    image.width = squareWidth * 0.9;
    image.height = squareWidth * 0.9;
    image.draggable = false;
    image.addEventListener("error", () => {
      image.remove();
      const fallback = document.createElement("span");
      fallback.className = "piece-fallback";
      fallback.textContent = GLYPH_FALLBACK[pieceCode] ?? "";
      fallback.setAttribute("aria-hidden", "true");
      fallback.setAttribute("data-color", color);
      fallback.style.fontSize = `${squareWidth * 0.72}px`;
      span.appendChild(fallback);
    });

    const coords = this.getSquareCoords(squareName);
    span.style.translate = `${coords.x}px ${coords.y}px`;
    span.appendChild(image);
    return span;
  }

  /**
   * Syncs piece elements to the stored position snapshot.
   *
   * @returns Nothing.
   * Used by: Board constructor, syncPosition, applyFenDiff, render.
   */
  public syncPieces(): void {
    if (!this.piecesContainer) return;
    const squareWidth = this.theme.boardSize / 8;

    for (const [sq, el] of this.pieceEls) {
      const want = this.lastPosition.get(sq);
      if (!want || el.getAttribute("data-piece") !== want) {
        el.getAnimations().forEach((a) => a.cancel());
        el.remove();
        this.pieceEls.delete(sq);
      }
    }

    for (const [sq, code] of this.lastPosition) {
      const coords = this.getSquareCoords(sq);
      const existing = this.pieceEls.get(sq);

      if (existing) {
        existing.style.translate = `${coords.x}px ${coords.y}px`;
        existing.style.width = `${squareWidth * 0.9}px`;
        existing.style.height = `${squareWidth * 0.9}px`;
        continue;
      }

      if (code) {
        const el = this.createPieceElement(code, sq, squareWidth);
        if (el) {
          this.piecesContainer.appendChild(el);
          this.pieceEls.set(sq, el);
        }
      }
    }
  }

  /**
   * Re-renders squares and pieces together.
   *
   * @returns Nothing.
   * Used by: flipBoard, resize, reStyle.
   */
  private render(): void {
    this.renderBoard();
    this.syncPieces();
  }

  /**
   * Preloads white and black piece image assets.
   *
   * @returns Nothing.
   * Used by: Board constructor, reStyle.
   */
  private preloadAssets(): void {
    const assets = this.theme.pieces.assets;
    const urls = new Set<string>();
    for (const side of [assets.white, assets.black]) {
      for (const key of [
        "pawn",
        "rook",
        "knight",
        "bishop",
        "queen",
        "king",
      ] as const) {
        const url = side[key];
        if (url && !urls.has(url)) {
          urls.add(url);
          const pre = new Image();
          pre.src = url;
        }
      }
    }
  }

  /**
   * Returns the main board DOM element.
   *
   * @returns Board element, or null when not built.
   * Used by: Arrows attachment, Gambix API, tests.
   */
  public getBoardElement(): HTMLElement | null {
    return this.boardElement;
  }

  /**
   * Returns the piece element on a square.
   *
   * @param squareName - Square name such as e2.
   * @returns Piece element, or null when empty or invalid.
   * Used by: BoardAnimator, Highlights occupancy checks, tests.
   */
  public getPieceElement(squareName: string): HTMLElement | null {
    return squareName ? (this.pieceEls.get(squareName) ?? null) : null;
  }

  /**
   * Creates and registers a piece element on a square.
   *
   * @param pieceCode - Piece code such as wq.
   * @param squareName - Target square.
   * @returns The created element, or null when assets are missing.
   * Used by: BoardAnimator.spawn, tests.
   */
  public createAndAppendPieceElement(
    pieceCode: string,
    squareName: string,
  ): HTMLElement | null {
    const squareWidth = this.theme.boardSize / 8;
    const el = this.createPieceElement(pieceCode, squareName, squareWidth);
    if (el && this.piecesContainer) {
      this.piecesContainer.appendChild(el);
      this.pieceEls.set(squareName, el);
      this.lastPosition.set(squareName, pieceCode);
    }
    return el;
  }

  /**
   * Moves a piece element registration from one square to another.
   *
   * @param from - Start square.
   * @param to - End square.
   * @returns Nothing.
   * Used by: BoardAnimator.animatePieceMove, tests.
   */
  public remapPieceElement(from: string, to: string): void {
    const el = this.pieceEls.get(from);
    if (el) {
      this.pieceEls.delete(from);
      this.pieceEls.set(to, el);
    }
    if (this.lastPosition.has(from)) {
      this.lastPosition.delete(from);
    }
  }

  /**
   * Unregisters the piece element on a square.
   *
   * @param square - Square name to clear.
   * @returns Nothing.
   * Used by: BoardAnimator.discard, promotion flow, tests.
   */
  public removePieceElement(square: string): void {
    this.pieceEls.delete(square);
  }

  /**
   * Computes pixel coordinates for a square top-left position.
   *
   * @param squareName - Square name such as e4.
   * @returns X and Y pixel coordinates.
   * Used by: piece placement, BoardAnimator, tests.
   */
  public getSquareCoords(squareName: string): { x: number; y: number } {
    let fileIndex = squareName.charCodeAt(0) - 97;
    let rankIndex = 56 - squareName.charCodeAt(1);

    if (this.theme.orientation === "black") {
      fileIndex = 7 - fileIndex;
      rankIndex = 7 - rankIndex;
    }

    const squareWidth = this.theme.boardSize / 8;
    const padding = squareWidth * 0.05;

    return {
      x: fileIndex * squareWidth + padding,
      y: rankIndex * squareWidth + padding,
    };
  }

  /**
   * Flips the board orientation and re-renders.
   *
   * @param orientation - New orientation, white or black.
   * @returns Nothing.
   * Used by: Gambix API, tests.
   */
  public flipBoard(orientation: "white" | "black"): void {
    this.theme.orientation = orientation;
    this.updateLayout();
    this.render();
  }

  /**
   * Resizes the board and re-renders pieces and squares.
   *
   * @param width - New board size in px.
   * @returns Nothing.
   * Used by: Gambix resize flow, auto-resize callback, tests.
   */
  public resize(width: number): void {
    this.theme.boardSize = width;
    this.applyCssVars();
    this.render();
  }

  /**
   * Merges a theme patch and re-renders the board.
   *
   * @param options - Partial theme fields to update.
   * @returns Nothing.
   * Used by: Gambix theme updates, tests.
   */
  public reStyle(options: ThemePatch): void {
    if (options.squares)
      this.theme.squares = { ...this.theme.squares, ...options.squares };
    if (options.pieces)
      this.theme.pieces = { ...this.theme.pieces, ...options.pieces };
    if (options.coord)
      this.theme.coord = { ...this.theme.coord, ...options.coord };

    this.theme = {
      ...this.theme,
      ...options,
      squares: this.theme.squares,
      pieces: this.theme.pieces,
      coord: this.theme.coord,
    };

    this.preloadAssets();
    this.updateLayout();
    this.render();
  }

  /**
   * Returns the current board orientation.
   *
   * @returns White or black orientation.
   * Used by: Gambix API, tests.
   */
  public getOrientation(): "white" | "black" {
    return this.theme.orientation;
  }

  /**
   * Observes a target element and reports significant width changes.
   *
   * @param target - Element to observe, if any.
   * @param getSize - Returns the current board size.
   * @param onResize - Called with the next width when changed.
   * @returns Nothing.
   * Used by: Gambix auto-resize setup, tests.
   */
  public enableAutoResize(
    target: HTMLElement | null,
    getSize: () => number,
    onResize: (width: number) => void,
  ): void {
    if (this.resizeObserver || !target) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        const next = Math.max(280, Math.min(w - 24, 800));
        if (Math.abs(next - getSize()) > 4) onResize(next);
      }
    });
    this.resizeObserver.observe(target);
  }

  /**
   * Stops observing board size changes.
   *
   * @returns Nothing.
   * Used by: Gambix teardown, destroy, tests.
   */
  public disableAutoResize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  /**
   * Tears down observers, animations and board DOM.
   *
   * @returns Nothing.
   * Used by: Gambix destroy, test teardown.
   */
  public destroy(): void {
    this.disableAutoResize();
    this.animator.cancelPending();
    this.wrapperElement?.remove();
    this.squareEls.clear();
    this.pieceEls.clear();
    this.outerRankCells = [];
    this.outerFileCells = [];
  }
}
