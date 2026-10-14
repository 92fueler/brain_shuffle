import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { indentMore } from "@codemirror/commands";

export const TAB_SIZE = 4;

/**
 * IDE-style Tab command for CodeMirror:
 * - If any text is selected: indents all selected lines by TAB_SIZE spaces.
 * - Otherwise: inserts spaces up to the next 4-space tab stop at the cursor position and advances cursor.
 */
export const ideTabCommand = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;

  if (selection.ranges.some((range) => !range.empty)) {
    return indentMore(view);
  }

  const trSpec = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const col = range.from - line.from;
    const count = TAB_SIZE - (col % TAB_SIZE);
    const spaces = " ".repeat(count);
    return {
      changes: { from: range.from, insert: spaces },
      range: EditorSelection.cursor(range.from + count),
    };
  });

  view.dispatch(
    state.update(trSpec, {
      userEvent: "input.indent",
      scrollIntoView: true,
    })
  );
  return true;
};

/**
 * IDE-style Backspace command for CodeMirror (matches VS Code "editor.useTabStops"):
 * - If non-empty selection: falls back to native deletion of the selection.
 * - If preceded by whitespace: deletes backward up to the nearest 4-space tab stop in one stroke.
 * - Otherwise: falls back to native single-character deletion.
 */
export const ideBackspaceCommand = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;

  if (selection.ranges.some((r) => !r.empty)) {
    return false;
  }

  // Pre-validate that all cursor ranges have spaces to delete to a previous tab stop
  for (const range of selection.ranges) {
    const pos = range.from;
    const line = state.doc.lineAt(pos);
    const col = pos - line.from;

    if (col === 0) return false;

    const linePrefix = line.text.slice(0, col);
    const trailingSpacesMatch = linePrefix.match(/ +$/);
    if (!trailingSpacesMatch) return false;

    const trailingSpacesCount = trailingSpacesMatch[0].length;
    const prevTabStop = Math.floor((col - 1) / TAB_SIZE) * TAB_SIZE;
    const toDeleteCount = Math.min(trailingSpacesCount, col - prevTabStop);

    if (toDeleteCount <= 0) return false;
  }

  const trSpec = state.changeByRange((range) => {
    const pos = range.from;
    const line = state.doc.lineAt(pos);
    const col = pos - line.from;
    const trailingSpacesMatch = line.text.slice(0, col).match(/ +$/)!;
    const trailingSpacesCount = trailingSpacesMatch[0].length;
    const prevTabStop = Math.floor((col - 1) / TAB_SIZE) * TAB_SIZE;
    const toDeleteCount = Math.min(trailingSpacesCount, col - prevTabStop);

    return {
      changes: { from: pos - toDeleteCount, to: pos },
      range: EditorSelection.cursor(pos - toDeleteCount),
    };
  });

  view.dispatch(
    state.update(trSpec, {
      userEvent: "delete.backward",
      scrollIntoView: true,
    })
  );
  return true;
};

/**
 * Common textarea Tab / Shift+Tab key handler:
 * - Ignores modifier shortcuts (Ctrl+Tab, Cmd+Tab, Alt+Tab) so browser tab switching is preserved.
 * - Shift+Tab: dedents single or multi-line selections by up to TAB_SIZE spaces.
 * - Tab with selection: indents all selected lines by TAB_SIZE spaces.
 * - Tab with collapsed cursor: inserts spaces up to the next 4-space tab stop.
 */
export function handleTextareaTabKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  update: (nextVal: string, newStart: number, newEnd: number) => void
): boolean {
  if (e.key !== "Tab" || e.metaKey || e.ctrlKey || e.altKey) return false;
  e.preventDefault();

  const textarea = e.currentTarget;
  const { selectionStart, selectionEnd, value: currentVal } = textarea;
  const isDedent = e.shiftKey;
  const hasSelection = selectionStart !== selectionEnd;

  // Compute line boundaries for the selection (ignoring a trailing newline so subsequent lines are not touched)
  const searchEnd =
    hasSelection && currentVal[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const firstLineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
  const endLineBreak = currentVal.indexOf("\n", searchEnd);
  const lastLineEnd = endLineBreak === -1 ? currentVal.length : endLineBreak;

  const block = currentVal.slice(firstLineStart, lastLineEnd);
  const lines = block.split("\n");

  if (isDedent) {
    let firstLineRemoved = 0;
    let totalRemoved = 0;

    const newLines = lines.map((line, idx) => {
      const match = line.match(/^ {1,4}/);
      const remove = match ? match[0].length : 0;
      if (idx === 0) firstLineRemoved = remove;
      totalRemoved += remove;
      return line.slice(remove);
    });

    if (totalRemoved === 0) {
      return true; // Nothing to dedent, prevent default without unnecessary state update
    }

    const nextVal =
      currentVal.slice(0, firstLineStart) +
      newLines.join("\n") +
      currentVal.slice(lastLineEnd);
    const newStart = Math.max(firstLineStart, selectionStart - firstLineRemoved);
    const newEnd = Math.max(newStart, selectionEnd - totalRemoved);
    update(nextVal, newStart, newEnd);
    return true;
  }

  if (hasSelection) {
    const newLines = lines.map((line) => " ".repeat(TAB_SIZE) + line);
    const nextVal =
      currentVal.slice(0, firstLineStart) +
      newLines.join("\n") +
      currentVal.slice(lastLineEnd);
    const newStart = selectionStart + TAB_SIZE;
    const newEnd = selectionEnd + TAB_SIZE * lines.length;
    update(nextVal, newStart, newEnd);
    return true;
  }

  // Collapsed cursor: insert spaces up to the next 4-space tab stop
  const col = selectionStart - firstLineStart;
  const count = TAB_SIZE - (col % TAB_SIZE);
  const spaces = " ".repeat(count);
  const nextVal =
    currentVal.slice(0, selectionStart) + spaces + currentVal.slice(selectionEnd);
  const newPos = selectionStart + count;
  update(nextVal, newPos, newPos);
  return true;
}

/**
 * Common textarea Backspace key handler (IDE-Style Soft Tab / Tab Stop Deletion):
 * - Ignores modifier shortcuts (Cmd+Backspace, Alt+Backspace) to preserve OS line/word delete shortcuts.
 * - If cursor is preceded by spaces, deletes backward to the previous 4-space tab stop in one stroke.
 * - If only 1 space needs to be deleted or preceded by non-space text, lets browser native backspace run.
 */
export function handleTextareaBackspaceKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  update: (nextVal: string, newStart: number, newEnd: number) => void
): boolean {
  if (e.key !== "Backspace" || e.metaKey || e.ctrlKey || e.altKey) {
    return false;
  }

  const textarea = e.currentTarget;
  const { selectionStart, selectionEnd, value: currentVal } = textarea;

  if (selectionStart !== selectionEnd) {
    return false;
  }

  const lineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
  const col = selectionStart - lineStart;
  if (col <= 0) {
    return false;
  }

  const linePrefix = currentVal.slice(lineStart, selectionStart);
  const trailingSpacesMatch = linePrefix.match(/ +$/);
  if (!trailingSpacesMatch) {
    return false;
  }

  const trailingSpacesCount = trailingSpacesMatch[0].length;
  const prevTabStop = Math.floor((col - 1) / TAB_SIZE) * TAB_SIZE;
  const toDelete = Math.min(trailingSpacesCount, col - prevTabStop);

  if (toDelete <= 1) {
    return false;
  }

  e.preventDefault();
  const nextVal =
    currentVal.slice(0, selectionStart - toDelete) +
    currentVal.slice(selectionEnd);
  const newPos = selectionStart - toDelete;
  update(nextVal, newPos, newPos);
  return true;
}

export interface TextareaEnterOptions {
  enableBullets?: boolean;
  enableColonBonus?: boolean;
}

/**
 * Common textarea Enter key handler:
 * - Ignores modifier shortcuts (Cmd+Enter, Ctrl+Enter) to preserve form submit / action shortcuts.
 * - Bullet list continuation (- , * , • , 1. ) if enableBullets is true.
 * - Python colon bonus indent (+4 spaces) if enableColonBonus is true.
 * - Indentation preservation.
 */
export function handleTextareaEnterKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  update: (nextVal: string, newStart: number, newEnd: number) => void,
  options?: TextareaEnterOptions
): boolean {
  if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) {
    return false;
  }

  const textarea = e.currentTarget;
  const { selectionStart, selectionEnd, value: currentVal } = textarea;
  const lineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineText = currentVal.slice(lineStart, selectionStart);

  if (options?.enableBullets) {
    const bulletMatch = lineText.match(/^([ \t]*)([-*•]|\d+\.)[ \t]+/);
    if (bulletMatch) {
      if (lineText.trim() === bulletMatch[2]) {
        e.preventDefault();
        const nextVal =
          currentVal.slice(0, lineStart) + currentVal.slice(selectionStart);
        update(nextVal, lineStart, lineStart);
        return true;
      }
      e.preventDefault();
      const nextBullet = bulletMatch[2].match(/\d+\./)
        ? `${parseInt(bulletMatch[2], 10) + 1}. `
        : `${bulletMatch[2]} `;
      const bulletPrefix = bulletMatch[1] + nextBullet;
      const nextVal =
        currentVal.slice(0, selectionStart) +
        "\n" +
        bulletPrefix +
        currentVal.slice(selectionEnd);
      const newPos = selectionStart + 1 + bulletPrefix.length;
      update(nextVal, newPos, newPos);
      return true;
    }
  }

  const indentMatch = lineText.match(/^[ \t]*/);
  let indent = indentMatch ? indentMatch[0] : "";

  if (options?.enableColonBonus) {
    const cleanLine = lineText.replace(/#.*$/, "").trimEnd();
    if (cleanLine.endsWith(":")) {
      indent += " ".repeat(TAB_SIZE);
    }
  }

  if (indent.length > 0) {
    e.preventDefault();
    const nextVal =
      currentVal.slice(0, selectionStart) +
      "\n" +
      indent +
      currentVal.slice(selectionEnd);
    const newPos = selectionStart + 1 + indent.length;
    update(nextVal, newPos, newPos);
    return true;
  }

  return false;
}
