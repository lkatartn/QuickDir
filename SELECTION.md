# Selection Architecture

## Design Intent

Selection in a file explorer is the single hottest interaction path — users hold
arrow keys and expect instant, lag-free visual feedback even in directories with
tens of thousands of files. A naive React-state approach (storing a `Set<string>`
in Zustand, triggering re-renders on every keystroke) cannot meet this bar: every
state change reconstructs the Set, notifies all Zustand subscribers, re-renders
the view component, and forces every visible row to re-evaluate its selected
status.

**The core principle here is: selection is a visual concern, not a structural
one.** The file list itself doesn't change when selection changes — only CSS
classes on a handful of DOM nodes do. So selection state and its visual
application are handled entirely outside of React's render cycle.

## Architecture

### Two-Layer Split

```
┌─────────────────────────────────────────────────────┐
│  React (structural rendering)                       │
│  - Renders file rows as "dumb" elements             │
│  - Each row has a data-index="N" attribute          │
│  - Rows have NO selection-related props or classes   │
│  - Rows NEVER subscribe to selection state          │
│  - useLayoutEffect calls syncDOM() after render     │
└──────────────────────┬──────────────────────────────┘
                       │ data-index attributes
┌──────────────────────▼──────────────────────────────┐
│  SelectionManager (imperative, non-React)           │
│  - Plain TypeScript class, module-level singleton   │
│  - Stores selection as index ranges (O(1) updates)  │
│  - On change: classList.toggle() on affected nodes  │
│  - Holds reference to sortedFiles[] for path lookup │
│  - Notifies Zustand of selectedCount (number only)  │
└─────────────────────────────────────────────────────┘
```

### SelectionManager Internal State

```
focusedIndex:  number    — the keyboard cursor position
anchorIndex:   number    — anchor for shift-extend ranges
rangeStart:    number    — inclusive start of contiguous selection
rangeEnd:      number    — inclusive end of contiguous selection
extras:        Set<number> — non-contiguous additions (Ctrl+click)
```

- **`selectSingle(index)`** — sets range to `[index, index]`, clears extras.
  Updates exactly 2 DOM nodes (old focused, new focused). True O(1).
- **`extendRange(toIndex)`** — expands/contracts the range from the anchor.
  Calls `_syncVisible()` to update all mounted nodes.
- **`toggleExtra(index)`** — Ctrl+click behavior, adds/removes from extras.
- **`isSelected(index)`** — O(1) range check + set lookup.
- **`getSelectedPaths()`** — lazily resolves indices to file paths (only called
  on user action like Copy or Delete, never during render).

### DOM Synchronization

CSS classes applied by SelectionManager:

| Class                  | Meaning                              |
|------------------------|--------------------------------------|
| `file-item--selected`  | Item is in the selection set         |
| `file-item--focused`   | Item is the keyboard cursor AND container has focus |
| `file-item--drop-target` | Folder is a valid drop target during drag |

**When an arrow key is pressed:**
1. SelectionManager updates its numeric state (O(1))
2. Calls `_applyNode(prevIndex)` and `_applyNode(newIndex)` to toggle classes
   on exactly 2 DOM nodes via `querySelector('[data-index="N"]')` (O(1))
3. Calls `_notifyCount()` which sets `selectedCount` in Zustand — the only
   reactive bridge, a single number, only consumed by the status bar and toolbar

**When React renders (scroll, resize, dir change):**
- `useLayoutEffect` in the view component calls `selectionManager.syncDOM()`
- This iterates all mounted `[data-index]` nodes (~20-30 with virtualization)
  and applies correct classes based on current selection state
- This ensures newly scrolled-into-view rows pick up their correct state

### Zustand's Role

Zustand stores **no selection data** — no `selectedFiles`, no `focusedIndex`.
The only selection-related field is:

```typescript
selectedCount: number   // updated by SelectionManager via onCountChange callback
```

This is consumed by:
- Status bar: `{selectedCount} item(s) selected`
- Toolbar buttons: `disabled={selectedCount === 0}`
- Context menu: same

File operations (Copy, Delete, Rename) call `selectionManager.getSelectedPaths()`
at invocation time — paths are resolved lazily, never stored reactively.

### Fine-Grained Zustand Selectors

View components subscribe to individual store fields, not the whole store:

```typescript
const files = useExplorerStore(s => s.files);
const sortField = useExplorerStore(s => s.sortField);
```

This prevents unrelated state changes (context menu visibility, clipboard data,
history navigation) from triggering view re-renders.

## Column View Exception

Column view uses a different selection model because:
- It has multiple panels, each with its own file list
- Items use `data-col-index` (per-panel) not `data-index` (global)
- Panels rarely contain thousands of items

Column view manages selection via React local state (`columns[].selectedIndex`
and a `localSelected: Set<string>`). When selection changes, it calls
`selectionManager.setManualPaths(paths)` so that file operations and the status
bar work uniformly through `selectionManager.getSelectedPaths()`.

## Drag & Drop

Drag visual state is also managed imperatively:
- `handleDragOver` adds `file-item--drop-target` directly to `e.currentTarget`
- `handleDragLeave` removes it
- `handleDragEnd` cleans up all drop-target classes
- No React state (`dropTargetPath`, `draggedPaths`) involved

## Rubber Band (Lasso) Selection

Clicking and dragging on empty space (i.e. not on a `.file-item`) draws a
selection rectangle. Items whose bounds intersect the rectangle are selected.
Clicking empty space without dragging clears the selection. Both behaviors are
handled by the `useRubberBand` hook.

### Performance Architecture

Rubber band is the most demanding selection path — it must update visual state
for hundreds of items at 60 fps while the mouse moves. A naive implementation
that calls `getBoundingClientRect` on every item every `mousemove` causes
severe jank. The hook uses four techniques to avoid this:

1. **rAF loop** — Mouse events only set a `dirty` flag and store coordinates.
   A single `requestAnimationFrame` loop (started when the drag threshold is
   crossed) does all work once per display frame. Auto-scroll is also part of
   this loop, replacing the old `setInterval`.

2. **Rect + node cache** — On drag start (mousedown), one `querySelectorAll`
   collects all `[data-index]` nodes and their `getBoundingClientRect()` rects,
   converted to content-relative coordinates. During the drag, hit-testing is
   pure arithmetic against the cached rects — zero DOM queries, zero forced
   layouts. For virtualized views (DetailsView), an analytical `rowHeight` path
   calculates positions mathematically, so no cache is needed.

3. **Diff-based DOM updates** — Instead of toggling classes on every node each
   frame (`_syncVisible`), only nodes whose selection state *changed* get a
   `classList.add` / `classList.remove` via the cached node references. A
   `setsEqual` check short-circuits entirely when the selection hasn't changed.

4. **Quiet state updates** — During the drag, `setIndicesQuiet()` updates
   `SelectionManager`'s internal state without triggering `_syncVisible()` or
   `_notifyCount()`. This prevents the Zustand notification → React re-render →
   `syncDOM()` chain. A single `selectByIndices()` call on mouseup does the
   full sync + notification once.

### Modifier Keys

- **Plain drag** — Clears previous selection, selects intersected items.
- **Ctrl+drag** — Adds intersected items to the existing selection.
- **Escape during drag** — Cancels and restores the pre-drag selection.

### View-Specific Behavior

| View | Hit-testing | DOM updates |
|------|-------------|-------------|
| GridView | Cached rects (all items in DOM) | Diff via cached node refs |
| DetailsView | Analytical (`index * rowHeight`) | `syncDOM()` (~20-30 virtual nodes) |
| ColumnView | Not supported (different selection model) | — |

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/selection/SelectionManager.ts` | The core selection class |
| `src/renderer/hooks/useFileNavigation.ts` | Keyboard/mouse → SelectionManager bridge |
| `src/renderer/hooks/useRubberBand.ts` | Lasso selection with rAF loop, rect caching, diff-based DOM |
| `src/renderer/hooks/useDragDrop.ts` | Drag & drop with direct DOM class management |
| `src/renderer/styles/globals.css` | `.file-item--*` and `.rubber-band-overlay` class definitions |

## Rules for Future Changes

1. **Never add selection state to Zustand.** If you need to know what's selected,
   call `selectionManager.getSelectedPaths()` — don't store the result reactively.
2. **Never add selection-related classes in React JSX.** All `file-item--selected`,
   `file-item--focused`, and `file-item--drop-target` classes are managed by
   SelectionManager or drag handlers. React rows render with `file-item` only.
3. **Always include `data-index={N}` on file item DOM nodes** so SelectionManager
   can find them.
4. **After any React render, `useLayoutEffect` must call `syncDOM()`** to ensure
   newly mounted nodes (from scroll or resize) get correct classes.
5. **`selectedCount` is the only reactive bridge.** Keep it that way.
