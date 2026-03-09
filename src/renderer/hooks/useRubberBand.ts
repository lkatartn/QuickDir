import { useEffect, useRef } from 'react';
import { selectionManager } from '../selection/SelectionManager';

interface UseRubberBandOptions {
  scrollContainerRef: React.RefObject<HTMLElement>;
  itemCount: number;
  /** For virtualized views with uniform row height — enables analytical
   *  hit-testing so off-screen items are still captured during auto-scroll. */
  rowHeight?: number;
}

interface CachedItem {
  node: HTMLElement;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const DRAG_THRESHOLD = 4;
const SCROLL_ZONE = 40;
const SCROLL_SPEED = 10;

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export function useRubberBand({
  scrollContainerRef,
  itemCount,
  rowHeight,
}: UseRubberBandOptions) {
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let bandEl: HTMLDivElement | null = null;
    let active = false;
    let startVpX = 0;
    let startVpY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let ctrlHeld = false;
    let baseIndices = new Set<number>();
    let lastClientX = 0;
    let lastClientY = 0;
    let hasDragged = false;
    let rafId: number | null = null;
    let dirty = false;
    let cachedRect: DOMRect;

    // Caches built once per drag — avoids all DOM queries during the drag
    let itemCache: CachedItem[] = [];
    let prevIndices = new Set<number>();

    // ── Band overlay ──

    const ensureBand = () => {
      if (!bandEl) {
        bandEl = document.createElement('div');
        bandEl.className = 'rubber-band-overlay';
        document.body.appendChild(bandEl);
      }
      return bandEl;
    };

    const hideBand = () => { if (bandEl) bandEl.style.display = 'none'; };
    const removeBand = () => { if (bandEl) { bandEl.remove(); bandEl = null; } };

    // ── Caching (one-time at drag start) ──

    const buildCache = () => {
      itemCache = [];
      if (rowHeight != null) return;

      const sl = container.scrollLeft;
      const st = container.scrollTop;
      const nodes = container.querySelectorAll('[data-index]');

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i] as HTMLElement;
        const idx = parseInt(node.getAttribute('data-index')!, 10);
        const r = node.getBoundingClientRect();
        itemCache[idx] = {
          node,
          left: r.left - cachedRect.left + sl,
          top: r.top - cachedRect.top + st,
          right: r.right - cachedRect.left + sl,
          bottom: r.bottom - cachedRect.top + st,
        };
      }
    };

    // ── Coordinate helpers ──

    const getContentRect = () => {
      const adjX = startVpX - (container.scrollLeft - startScrollLeft);
      const adjY = startVpY - (container.scrollTop - startScrollTop);
      const vpL = Math.min(adjX, lastClientX);
      const vpT = Math.min(adjY, lastClientY);
      const vpR = Math.max(adjX, lastClientX);
      const vpB = Math.max(adjY, lastClientY);
      return {
        left: vpL - cachedRect.left + container.scrollLeft,
        top: vpT - cachedRect.top + container.scrollTop,
        right: vpR - cachedRect.left + container.scrollLeft,
        bottom: vpB - cachedRect.top + container.scrollTop,
      };
    };

    // ── Hit-testing (pure math, no DOM queries) ──

    const hitTest = (): Set<number> => {
      const selected = new Set<number>();
      const band = getContentRect();

      if (rowHeight != null && rowHeight > 0) {
        const count = itemCountRef.current;
        const first = Math.max(0, Math.floor(band.top / rowHeight));
        const last = Math.min(count - 1, Math.floor(band.bottom / rowHeight));
        for (let i = first; i <= last; i++) {
          const iTop = i * rowHeight;
          if (iTop + rowHeight > band.top && iTop < band.bottom) selected.add(i);
        }
      } else {
        for (let i = 0; i < itemCache.length; i++) {
          const c = itemCache[i];
          if (!c) continue;
          if (
            c.right > band.left && c.left < band.right &&
            c.bottom > band.top && c.top < band.bottom
          ) {
            selected.add(i);
          }
        }
      }
      return selected;
    };

    // ── Selection application (diff-based for GridView, syncDOM for virtualized) ──

    const applySelection = (newIndices: Set<number>) => {
      if (setsEqual(newIndices, prevIndices)) return;

      selectionManager.setIndicesQuiet(newIndices);

      if (rowHeight != null) {
        // Virtualized view: ~20-30 DOM nodes, full sync is cheap
        selectionManager.syncDOM();
      } else {
        // GridView: diff-based — only touch nodes whose state changed
        for (const idx of newIndices) {
          if (!prevIndices.has(idx)) {
            itemCache[idx]?.node.classList.add('file-item--selected');
          }
        }
        for (const idx of prevIndices) {
          if (!newIndices.has(idx)) {
            itemCache[idx]?.node.classList.remove('file-item--selected');
          }
        }
      }
      prevIndices = newIndices;
    };

    // ── Core update (called once per rAF frame) ──

    const doUpdate = () => {
      if (!active) return;

      const adjX = startVpX - (container.scrollLeft - startScrollLeft);
      const adjY = startVpY - (container.scrollTop - startScrollTop);
      const vpL = Math.min(adjX, lastClientX);
      const vpT = Math.min(adjY, lastClientY);
      const vpR = Math.max(adjX, lastClientX);
      const vpB = Math.max(adjY, lastClientY);

      const clipL = Math.max(vpL, cachedRect.left);
      const clipT = Math.max(vpT, cachedRect.top);
      const clipR = Math.min(vpR, cachedRect.right);
      const clipB = Math.min(vpB, cachedRect.bottom);

      const el = ensureBand();
      if (clipR > clipL && clipB > clipT) {
        el.style.display = 'block';
        el.style.width = (clipR - clipL) + 'px';
        el.style.height = (clipB - clipT) + 'px';
        el.style.transform = `translate(${clipL}px,${clipT}px)`;
      } else {
        el.style.display = 'none';
      }

      let indices = hitTest();
      if (ctrlHeld && baseIndices.size > 0) {
        const merged = new Set(indices);
        for (const i of baseIndices) merged.add(i);
        indices = merged;
      }
      applySelection(indices);
    };

    // ── Auto-scroll ──

    const autoScroll = (): boolean => {
      const prev = container.scrollTop;
      const relY = lastClientY - cachedRect.top;
      if (relY < SCROLL_ZONE && container.scrollTop > 0) {
        container.scrollTop -= SCROLL_SPEED;
      } else if (relY > cachedRect.height - SCROLL_ZONE) {
        container.scrollTop += SCROLL_SPEED;
      }
      return container.scrollTop !== prev;
    };

    // ── rAF loop (replaces raw mousemove + setInterval) ──

    const startLoop = () => {
      const tick = () => {
        if (!active) { rafId = null; return; }
        const scrolled = autoScroll();
        if (dirty || scrolled) {
          dirty = false;
          doUpdate();
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    };

    // ── Mouse handlers ──

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.file-item')) return;

      e.preventDefault();
      const focusable = (container.closest('[tabindex]') || container) as HTMLElement;
      focusable.focus();

      startVpX = e.clientX;
      startVpY = e.clientY;
      startScrollLeft = container.scrollLeft;
      startScrollTop = container.scrollTop;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      hasDragged = false;
      active = true;
      dirty = false;
      cachedRect = container.getBoundingClientRect();

      ctrlHeld = e.ctrlKey || e.metaKey;
      baseIndices = ctrlHeld ? selectionManager.getAllSelectedIndices() : new Set();

      buildCache();

      // Clear previous selection visuals (one-time DOM walk)
      if (!ctrlHeld) selectionManager.clear();
      prevIndices = new Set(baseIndices);

      const onMove = (e2: MouseEvent) => {
        lastClientX = e2.clientX;
        lastClientY = e2.clientY;
        if (!hasDragged) {
          if (
            Math.abs(e2.clientX - startVpX) < DRAG_THRESHOLD &&
            Math.abs(e2.clientY - startVpY) < DRAG_THRESHOLD
          ) return;
          hasDragged = true;
          startLoop();
        }
        dirty = true;
      };

      const teardown = () => {
        active = false;
        stopLoop();
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('keydown', onKey);
        hideBand();
        itemCache = [];
      };

      const onUp = () => {
        const final = prevIndices;
        teardown();
        if (!hasDragged && !ctrlHeld) {
          selectionManager.clear();
        } else if (hasDragged) {
          // Full sync: DOM classes + Zustand count notification (one-time)
          selectionManager.selectByIndices(final);
        }
      };

      const onKey = (e3: KeyboardEvent) => {
        if (e3.key === 'Escape') {
          teardown();
          if (ctrlHeld) {
            selectionManager.selectByIndices(baseIndices);
          } else {
            selectionManager.clear();
          }
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('keydown', onKey);
    };

    container.addEventListener('mousedown', onMouseDown);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      removeBand();
      stopLoop();
    };
  }, [scrollContainerRef.current, rowHeight]);
}
