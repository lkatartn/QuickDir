import type { FileEntry } from '../../shared/types';

type CountCallback = (count: number) => void;

/**
 * Imperative selection manager that lives outside React's render cycle.
 * Stores selection as index ranges (O(1) updates) and applies visual
 * changes directly to the DOM via classList, bypassing React entirely.
 */
class SelectionManager {
  private _focusedIndex = -1;
  private _anchorIndex = -1;
  private _rangeStart = -1;
  private _rangeEnd = -1;
  private _extras = new Set<number>();
  private _container: HTMLElement | null = null;
  private _hasFocus = false;
  private _sortedFiles: FileEntry[] = [];
  private _onCountChange: CountCallback | null = null;

  // Column view sets paths manually since its items aren't index-addressable
  private _manualPaths: string[] | null = null;

  get focusedIndex() { return this._focusedIndex; }
  get anchorIndex() { return this._anchorIndex; }

  setContainer(el: HTMLElement | null) {
    this._container = el;
  }

  setSortedFiles(files: FileEntry[]) {
    this._sortedFiles = files;
    this._manualPaths = null;
  }

  setFocus(focused: boolean) {
    if (this._hasFocus === focused) return;
    this._hasFocus = focused;
    this._syncVisible();
  }

  onCountChange(cb: CountCallback) {
    this._onCountChange = cb;
  }

  // ── Queries ──

  isSelected(index: number): boolean {
    if (this._rangeStart >= 0 && this._rangeEnd >= 0 &&
        index >= this._rangeStart && index <= this._rangeEnd) {
      return true;
    }
    return this._extras.has(index);
  }

  isFocused(index: number): boolean {
    return this._focusedIndex === index;
  }

  getSelectedCount(): number {
    if (this._manualPaths) return this._manualPaths.length;
    if (this._rangeStart < 0) return this._extras.size;

    let count = this._rangeEnd - this._rangeStart + 1;
    for (const i of this._extras) {
      if (i < this._rangeStart || i > this._rangeEnd) count++;
    }
    return count;
  }

  getSelectedPaths(): string[] {
    if (this._manualPaths) return this._manualPaths;
    const result: string[] = [];
    if (this._rangeStart >= 0 && this._rangeEnd >= 0) {
      for (let i = this._rangeStart; i <= this._rangeEnd; i++) {
        if (this._sortedFiles[i]) result.push(this._sortedFiles[i].path);
      }
    }
    for (const i of this._extras) {
      if (i < this._rangeStart || i > this._rangeEnd) {
        if (this._sortedFiles[i]) result.push(this._sortedFiles[i].path);
      }
    }
    return result;
  }

  hasSelection(): boolean {
    return this.getSelectedCount() > 0;
  }

  // ── Mutations ──

  selectSingle(index: number) {
    this._manualPaths = null;
    const prevFocused = this._focusedIndex;
    const wasSimple = this._extras.size === 0 &&
      this._rangeStart === this._rangeEnd;

    this._focusedIndex = index;
    this._anchorIndex = index;
    this._rangeStart = index;
    this._rangeEnd = index;
    this._extras.clear();

    if (wasSimple && prevFocused >= 0) {
      this._applyNode(prevFocused);
      this._applyNode(index);
    } else {
      this._syncVisible();
    }
    this._notifyCount();
  }

  extendRange(toIndex: number) {
    this._manualPaths = null;
    const anchor = this._anchorIndex >= 0 ? this._anchorIndex : 0;

    this._focusedIndex = toIndex;
    this._rangeStart = Math.min(anchor, toIndex);
    this._rangeEnd = Math.max(anchor, toIndex);

    this._syncVisible();
    this._notifyCount();
  }

  toggleExtra(index: number) {
    this._manualPaths = null;
    const wasSelected = this.isSelected(index);

    if (wasSelected) {
      if (index >= this._rangeStart && index <= this._rangeEnd) {
        const indices = this._getAllSelectedIndices();
        indices.delete(index);
        this._rebuildFromSet(indices);
      } else {
        this._extras.delete(index);
      }
    } else {
      this._extras.add(index);
    }

    this._focusedIndex = index;
    this._anchorIndex = index;

    this._syncVisible();
    this._notifyCount();
  }

  clear() {
    this._focusedIndex = -1;
    this._anchorIndex = -1;
    this._rangeStart = -1;
    this._rangeEnd = -1;
    this._extras.clear();
    this._manualPaths = null;

    this._syncVisible();
    this._notifyCount();
  }

  selectAll(count: number) {
    this._manualPaths = null;
    this._rangeStart = 0;
    this._rangeEnd = count - 1;
    this._extras.clear();

    this._syncVisible();
    this._notifyCount();
  }

  selectByIndices(indices: Set<number>) {
    this._manualPaths = null;
    this._rangeStart = -1;
    this._rangeEnd = -1;
    this._extras = new Set(indices);
    this._syncVisible();
    this._notifyCount();
  }

  /** Update internal state only — no DOM sync, no Zustand notification.
   *  Caller is responsible for visual updates (used by rubber-band drag). */
  setIndicesQuiet(indices: Set<number>) {
    this._manualPaths = null;
    this._rangeStart = -1;
    this._rangeEnd = -1;
    this._extras = indices;
  }

  getAllSelectedIndices(): Set<number> {
    return this._getAllSelectedIndices();
  }

  setManualPaths(paths: string[]) {
    this._manualPaths = paths;
    this._notifyCount();
  }

  /**
   * Called after React renders (in useLayoutEffect) to apply selection
   * classes to all visible DOM nodes. With virtualization this is ~20-30 nodes.
   */
  syncDOM() {
    this._syncVisible();
  }

  // ── Private ──

  private _getAllSelectedIndices(): Set<number> {
    const result = new Set<number>();
    if (this._rangeStart >= 0 && this._rangeEnd >= 0) {
      for (let i = this._rangeStart; i <= this._rangeEnd; i++) result.add(i);
    }
    for (const i of this._extras) result.add(i);
    return result;
  }

  private _rebuildFromSet(indices: Set<number>) {
    this._extras = indices;
    this._rangeStart = -1;
    this._rangeEnd = -1;
  }

  private _notifyCount() {
    this._onCountChange?.(this.getSelectedCount());
  }

  private _applyNode(index: number) {
    if (!this._container || index < 0) return;
    const node = this._container.querySelector(`[data-index="${index}"]`);
    if (!node) return;
    node.classList.toggle('file-item--selected', this.isSelected(index));
    node.classList.toggle('file-item--focused', this.isFocused(index) && this._hasFocus);
  }

  private _syncVisible() {
    if (!this._container) return;
    const nodes = this._container.querySelectorAll('[data-index]');
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const idx = parseInt(node.getAttribute('data-index')!, 10);
      node.classList.toggle('file-item--selected', this.isSelected(idx));
      node.classList.toggle('file-item--focused', this.isFocused(idx) && this._hasFocus);
    }
  }
}

export const selectionManager = new SelectionManager();
