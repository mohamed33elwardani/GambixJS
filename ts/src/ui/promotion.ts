import type EventBus from "../events/event-bus.ts";
import type {
  ChessEvents,
  PromotionDeps,
  PromotionPending,
  PromotionRequestHandler,
  PieceAssets,
} from "../types/types.ts";
import { DEFAULT_CONFIG } from "../config/defaults.ts";

/**
 * Re-exported promotion types for external consumers.
 * Used by: Gambix internal wiring, Promotion picker flow.
 */
export type {
  PromotionPending,
  PromotionRequestHandler,
};
export type { PromotionDeps };

/**
 * Display order of promotion choices in the picker panel.
 * Used by: PromotionManager picker flow.
 */
const PROMO_ORDER = ["q", "r", "b", "n"] as const;
/**
 * Maps promotion codes to piece names for asset lookup.
 * Used by: PromotionManager picker flow.
 */
const PROMO_NAMES: Record<string, string> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

/**
 * Returns the zero-based index of a board file letter.
 * @param file - The file letter from a to h.
 * @returns The file index, or -1 when unknown.
 * Used by: PromotionManager picker flow.
 */
function fileIndex(file: string): number {
  return ["a", "b", "c", "d", "e", "f", "g", "h"].indexOf(file);
}

/**
 * Checks whether a pawn move reaches the final rank as a promotion.
 * @param piece - The moving piece with type and color, or null.
 * @param from - The origin square name.
 * @param to - The destination square name.
 * @returns True when the move is a promotion candidate.
 * Used by: PromotionManager intercept and choose flow.
 */
function isPromotionCandidate(
  piece: { type: string; color: string } | null,
  from: string,
  to: string,
): boolean {
  if (piece?.type !== "p" || !from || !to) return false;
  const fromRank = from.charAt(1);
  const toRank = to.charAt(1);
  const fileDiff = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  if (fileDiff > 1) return false;
  if (piece.color === "w") return fromRank === "7" && toRank === "8";
  return fromRank === "2" && toRank === "1";
}

/**
 * Intercepts promotion moves and shows the promotion picker UI.
 * Used by: Gambix internal wiring, Promotion picker flow.
 */
export default class PromotionManager {
  private pending: PromotionPending | null = null;
  private overlay: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private unsubs: Array<() => void> = [];

  private requestHandlers = new Set<PromotionRequestHandler>();

  private requestId = 0;
  private activeRequest: { from: string; to: string; id: number } | null = null;

  /**
   * Creates a promotion manager bound to board dependencies.
   * @param deps - Board accessors, event bus, and move callbacks.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  constructor(private deps: PromotionDeps) {}

  /**
   * Subscribes to move requests and promotion selection forwarding.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  attach(): void {
    const { eventBus } = this.deps;
    this.unsubs.push(
      eventBus.on("interaction:move-requested", (p) => {
        void this.intercept(p);
      }),
    );
    this.unsubs.push(
      eventBus.on("board:promotion-selected", (payload) => {
        eventBus.emit("board:promotion-chosen", { ...payload });
      }),
    );
  }

  /**
   * Removes all event subscriptions registered by attach.
   * @returns Nothing.
   * Used by: PromotionManager destroy flow, Gambix internal wiring.
   */
  detach(): void {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  /**
   * Clears pending state, handlers, subscriptions, and picker UI.
   * @returns Nothing.
   * Used by: Gambix internal wiring, Promotion teardown flow.
   */
  destroy(): void {
    this.requestId++;
    this.activeRequest = null;
    this.requestHandlers.clear();
    this.detach();
    this.hide(true);
  }

  /**
   * Returns the currently pending promotion choice, if any.
   * @returns The pending promotion data, or null when idle.
   * Used by: Gambix internal wiring, Promotion picker flow.
   */
  getPending(): PromotionPending | null {
    return this.pending;
  }

  /**
   * Closes the picker and optionally cancels the pending promotion.
   * @param cancel - Whether to emit cancellation and reject the move.
   * @returns Nothing.
   * Used by: PromotionManager cancel/select/show flow.
   */
  hide(cancel: boolean): void {
    this.requestId++;
    this.activeRequest = null;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }
    const pending = this.pending;
    this.pending = null;
    if (cancel && pending) {
      this.deps.eventBus.emit("board:promotion-cancelled", {
        from: pending.from,
        to: pending.to,
      });
      this.deps.onRejectMove(pending.from, pending.to);
    }
  }

  /**
   * Cancels the active promotion and rejects the move.
   * @returns Nothing.
   * Used by: Promotion picker backdrop and cancel flow.
   */
  cancel(): void {
    this.hide(true);
  }

  /**
   * Chooses a promotion piece for a move, pending or direct.
   * @param from - The origin square name.
   * @param to - The destination square name.
   * @param promotion - The requested promotion code.
   * @returns Nothing.
   * Used by: Promotion picker option and external API flow.
   */
  choose(from: string, to: string, promotion: string): void {
    const promo = promotion.toLowerCase();
    if (!(PROMO_ORDER as readonly string[]).includes(promo)) return;
    if (this.pending && this.pending.from === from && this.pending.to === to) {
      this.select(promo);
      return;
    }

    const active = this.activeRequest;
    if (active && active.from === from && active.to === to) return;
    if (!isPromotionCandidate(this.deps.getPiece(from), from, to)) {
      console.warn(`[Gambix] choosePromotion ignored: ${from}-${to} is not a promotion move.`);
      return;
    }
    const payload = { from, to, promotion: promo };
    this.deps.eventBus.emit("board:promotion-selected", payload);
    this.deps.eventBus.emit("board:move-requested", {
      from,
      to,
      promotion: promo,
    });
  }

  /**
   * Registers a handler consulted before showing the picker.
   * @param cb - The handler receiving pending promotion data.
   * @returns An unsubscribe function that removes the handler.
   * Used by: Gambix internal wiring, Promotion auto-resolve flow.
   */
  onPromotionRequested(cb: PromotionRequestHandler): () => void {
    this.requestHandlers.add(cb);
    return () => {
      this.requestHandlers.delete(cb);
    };
  }

  /**
   * Intercepts a move request and routes promotions to handlers or picker.
   * @param p - The requested move with from and to squares.
   * @returns A promise that resolves when routing completes.
   * Used by: PromotionManager attach wiring.
   */
  private async intercept(p: { from: string; to: string }): Promise<void> {
    const { eventBus } = this.deps;
    const id = ++this.requestId;
    this.activeRequest = null;
    const stale = (): boolean => id !== this.requestId;
    const piece = this.deps.getPiece(p.from);
    if (isPromotionCandidate(piece, p.from, p.to)) {
        const data: PromotionPending = {
          from: p.from,
          to: p.to,
          color: piece!.color,
          piece: `${piece!.color}${piece!.type}`,
        };
        this.activeRequest = { from: p.from, to: p.to, id };
        eventBus.emit("board:promotion-requested", { ...data });
        for (const handler of [...this.requestHandlers]) {
          let res: string | false | void;
          try {
            res = await handler({ ...data });
          } catch {
            continue;
          }
          if (stale()) return;
          if (res === false) {
            this.activeRequest = null;
            this.hide(false);
            this.deps.onRejectMove(p.from, p.to);
            return;
          }
          if (typeof res === "string" && res) {
            const promo = res.toLowerCase();
            if ((PROMO_ORDER as readonly string[]).includes(promo)) {
              this.activeRequest = null;
              this.hide(false);
              const payload = { from: p.from, to: p.to, promotion: promo };
              eventBus.emit("board:promotion-selected", payload);
              eventBus.emit("board:move-requested", {
                from: p.from,
                to: p.to,
                promotion: promo,
              });
              return;
            }
          }
        }
        if (stale()) return;

        this.show(data);
        return;
    }
    if (stale()) return;
    this.activeRequest = null;
    eventBus.emit("board:move-requested", { from: p.from, to: p.to });
  }

  /**
   * Confirms the pending promotion and forwards the completed move.
   * @param promotion - The chosen promotion code.
   * @returns Nothing.
   * Used by: PromotionManager choose and picker option flow.
   */
  private select(promotion: string): void {
    if (!this.pending) return;
    const pending = { ...this.pending };
    const promo = promotion.toLowerCase();
    this.hide(false);
    const payload = {
      from: pending.from,
      to: pending.to,
      promotion: promo,
    };
    this.deps.eventBus.emit("board:promotion-selected", payload);
    this.deps.eventBus.emit("board:move-requested", {
      from: pending.from,
      to: pending.to,
      promotion: promo,
    });
  }

  /**
   * Renders the promotion picker overlay for a pending promotion.
   * @param data - The pending promotion with from, to, and color.
   * @returns Nothing.
   * Used by: PromotionManager intercept flow.
   */
  private show(data: PromotionPending): void {
    this.hide(true);

    const id = ++this.requestId;
    this.activeRequest = { from: data.from, to: data.to, id };
    this.pending = data;

    const boardEl = this.deps.getBoardElement();
    if (!boardEl) {
      this.hide(true);
      return;
    }

    if (window.getComputedStyle(boardEl).position === "static") {
      boardEl.style.position = "relative";
    }
    const theme = this.deps.getTheme();
    const squareWidth = theme.boardSize / 8;
    const idx = fileIndex(data.to.charAt(0));
    const isWhite = theme.orientation === "white";
    const left = (isWhite ? idx : 7 - idx) * squareWidth;
    const rank = data.to.charAt(1);
    const rankIdx = isWhite ? 8 - parseInt(rank, 10) : parseInt(rank, 10) - 1;
    const top = rankIdx * squareWidth;
    const panelTop =
      top <= theme.boardSize / 2 ? 0 : theme.boardSize - squareWidth * 4;

    const backdrop = document.createElement("div");
    backdrop.className = "promotion-backdrop";
    backdrop.addEventListener("click", () => this.hide(true));
    boardEl.appendChild(backdrop);
    this.backdrop = backdrop;

    const panel = document.createElement("div");
    panel.className = "promotion-panel gambix-promotion-panel";
    panel.style.left = `${left}px`;
    panel.style.top = `${panelTop}px`;
    panel.style.width = `${squareWidth}px`;
    panel.style.height = `${squareWidth * 4}px`;

    const colorName = data.color === "w" ? "white" : "black";
    const displayOrder: readonly string[] =
      panelTop === 0 ? PROMO_ORDER : [...PROMO_ORDER].reverse();
    for (const promo of displayOrder) {
      const opt = document.createElement("div");
      opt.className = "promotion-option";
      opt.dataset.promo = promo;
      opt.style.width = `${squareWidth}px`;
      opt.style.height = `${squareWidth}px`;
      const promoName = PROMO_NAMES[promo] as keyof PieceAssets;
      const asset =
        theme.pieces.assets?.[colorName]?.[promoName] ??
        DEFAULT_CONFIG.theme.pieces.assets[colorName][promoName];
      const img = document.createElement("img");
      img.className = "promotion-image";
      img.src = asset;
      img.alt = promo;
      img.style.width = `${squareWidth * 0.85}px`;
      img.style.height = `${squareWidth * 0.85}px`;
      img.draggable = false;
      opt.appendChild(img);
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        this.select(promo);
      });
      panel.appendChild(opt);
    }
    boardEl.appendChild(panel);
    this.overlay = panel;
  }
}
