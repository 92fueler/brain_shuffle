# DualNotepad Responsive Header & Toolbar Design

Technical specification for resolving header crowding, multi-line button wrapping, and right-edge overflow clipping in [frontend/src/components/DualNotepad.tsx](../frontend/src/components/DualNotepad.tsx) and [frontend/src/App.css](../frontend/src/App.css) when browser viewports or split panes are narrowed.

---

## 1) Problem Analysis

When the browser viewport shrinks or `DualNotepad` is switched to `2-Col` split mode, the secondary pane header (`.dual-panel-header`) and single-column topbar (`.dual-notepad-topbar`) exhibit four layout defects:

1. **Multi-Line Label & Button Wrapping**:
   - `.dual-panel-label` (`PAD 1`, `PAD 2`) lacks `white-space: nowrap`, causing the label to wrap vertically onto two lines (`PAD` / `1`).
   - `.dual-pane-mini-btn` inside `renderCodeButtonGroup` renders `Code (txt)` without `white-space: nowrap`, wrapping onto two lines (`Code` / `(txt)`) and doubling the button height relative to adjacent controls.
2. **Right-Edge Action Clipping**:
   - `.dual-panel-header` is styled with `flex-wrap: nowrap`, while its ancestor `.dual-notepad-panel` and `.dual-panel-inner` enforce `overflow: hidden`.
   - Each split pane requires ~480px of horizontal space to fit `PAD N`, `Edit | Preview`, `B`, `I`, `Palette`, `List`, `Code (txt)`, `Callout`, and `Clear` on a single row. Below ~480px per pane (~960px total container width), `Callout` and `Clear` are clipped off the right edge.
3. **Single-Column Topbar Overflow**:
   - In `1-Col` mode, `.dual-notepad-topbar` places `[1-Col | 2-Col] [Edit | Preview]` on the left and `[B] [I] [Palette] [List] [Code (txt)] [Callout] [Clear]` on the right with `flex-wrap: nowrap`. Below ~640px container width, the right-side action chips overflow the container.
4. **Dropdown Menu Clipping Near Right Pane Boundary**:
   - `.dual-lang-dropdown-menu` (`min-width: 175px`) is anchored with `left: 0`. Because `renderCodeButtonGroup` sits near the right edge of `.dual-panel-actions`, opening the language picker in a narrow pane overflows the right boundary of `.dual-panel-inner` (`overflow: hidden`).

---

## 2) Responsive Layout Architecture

Because `DualNotepad` uses `react-resizable-panels` (`<Group>` and `<Panel>`) where individual pane widths vary independently of the browser viewport width, responsive breakpoints are governed by **CSS Container Queries (`container-type: inline-size`)** rather than viewport `@media` queries.

```text
Tier 1 — Wide Pane (> 520px): Full labels on all controls
┌──────────────────────────────────────────────────────────────────────────┐
│ PAD 1  [✏ Edit | 👁 Preview]    [B][I][🎨▾] [≡ List] [<> txt▾] [✨ Callout] │
└──────────────────────────────────────────────────────────────────────────┘

Tier 2 — Medium Pane (340px – 520px): Action buttons collapse to icon-only
┌─────────────────────────────────────────────────────┐
│ PAD 1  [✏ Edit | 👁 Preview]   [B][I][🎨▾][≡][<>▾][✨] │
└─────────────────────────────────────────────────────┘

Tier 3 — Narrow Pane (<= 340px): Edit/Preview pills also collapse to icon-only
┌───────────────────────────────────────┐
│ PAD 1 [✏|👁]  [B][I][🎨▾][≡][<>▾][✨]   │
└───────────────────────────────────────┘
```

### Container Query Placement Constraints

1. **Split Pane Container (`.dual-panel-inner`)**:
   - `container-type: inline-size` and `container-name: notepad-pane` are applied to `.dual-panel-inner` (`width: 100%`) rather than `<Panel className="dual-notepad-panel">`.
   - Applying size containment directly to `react-resizable-panels`'s `<Panel>` element can interfere with `flex-basis` calculations during drag resizing; placing it on `.dual-panel-inner` isolates containment from the flex panel wrapper.
2. **Root Container (`.dual-notepad-container`)**:
   - `container-type: inline-size` and `container-name: notepad-root` are applied to `.dual-notepad-container` to drive responsive label collapsing in `1-Col` mode's `.dual-notepad-topbar` when the root width drops below `640px`.

---

## 3) Component Markup Specification

In [frontend/src/components/DualNotepad.tsx](../frontend/src/components/DualNotepad.tsx), text nodes inside `.dual-view-pill`, `.dual-pane-mini-btn`, and `.dual-action-chip` are wrapped in `<span className="btn-label">` so CSS container queries can toggle label visibility cleanly while preserving `title` tooltips:

| Control | Wide Display | Collapsed Display (`<= 520px` pane / `<= 640px` root) |
| :--- | :--- | :--- |
| **Pane Label** (`PAD 1` / `PAD 2`) | `PAD 1` (`white-space: nowrap`) | `PAD 1` (`white-space: nowrap`) |
| **View Toggle** (`Edit` / `Preview`) | `<Edit3 /> <span className="btn-label">Edit</span>` | Collapses to `<Edit3 />` only at `<= 340px` pane width |
| **Format Group** (`B`, `I`, `Palette`) | Icon-only (unchanged) | Icon-only (unchanged) |
| **Bullet List** (`List`) | `<List /> <span className="btn-label">List</span>` | `<List />` |
| **Code Block** (`Code (txt)`) | `<Code2 /> <span className="btn-label">Code</span> <span className="btn-lang-tag">{shortLang}</span>` | `<Code2 /> <span className="btn-lang-tag">{shortLang}</span>` |
| **Callout** (`Callout`) | `<Sparkles /> <span className="btn-label">Callout</span>` | `<Sparkles />` |
| **Clear** (`Clear`) | `<RotateCcw /> <span className="btn-label">Clear</span>` | `<RotateCcw />` |

---

## 4) CSS Specification

In [frontend/src/App.css](../frontend/src/App.css):

```css
/* Root & Pane Size Containers */
.dual-notepad-container {
  container-type: inline-size;
  container-name: notepad-root;
}

.dual-panel-inner {
  container-type: inline-size;
  container-name: notepad-pane;
}

/* Prevent vertical text wrapping inside labels and toolbar buttons */
.dual-panel-label,
.dual-view-pill,
.dual-pane-mini-btn,
.dual-action-chip {
  white-space: nowrap;
  flex-shrink: 0;
}

.dual-panel-header {
  gap: 6px;
  flex-wrap: wrap;
}

.dual-panel-title-area,
.dual-panel-actions {
  flex-shrink: 0;
}

/* Anchor code language dropdown to the right edge so it never clips off the right border */
.dual-panel-actions .dual-lang-dropdown-menu {
  left: auto;
  right: 0;
}

/* 1-Col Topbar: collapse action chip text labels when container <= 640px */
@container notepad-root (max-width: 640px) {
  .dual-notepad-quick-actions .dual-action-chip .btn-label {
    display: none;
  }
}

/* 2-Col Pane Header (<= 520px): collapse List, Code, Callout, Clear text labels */
@container notepad-pane (max-width: 520px) {
  .dual-panel-actions .dual-pane-mini-btn .btn-label {
    display: none;
  }
  .dual-panel-header {
    padding: 4px 8px;
  }
}

/* 2-Col Pane Header (<= 340px): also collapse Edit/Preview pill text labels */
@container notepad-pane (max-width: 340px) {
  .dual-view-pill .btn-label {
    display: none;
  }
  .dual-panel-title-area {
    gap: 4px;
  }
}
```

---

## 5) Alternative UX Option: Unified Topbar Formatting Toolbar

An alternative structural simplification eliminates duplicated formatting buttons across `PAD 1` and `PAD 2` altogether:
1. Track `activeCol: 1 | 2` in `DualNotepad` state (updated `onFocus` of `textarea1Ref` and `textarea2Ref`, defaulting to `1`).
2. Render a single formatting toolbar (`[B] [I] [Palette] [List] [Code] [Callout]`) in `.dual-notepad-topbar` for both `1-Col` and `2-Col` modes, dispatching formatting actions to `activeCol`.
3. Reduce each split pane's `.dual-panel-header` to only the pane title (`PAD 1` / `PAD 2`), its local `[Edit | Preview]` toggle, and `[Clear]`.
