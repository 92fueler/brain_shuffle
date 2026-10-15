import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { indentMore } from "@codemirror/commands";

export const TAB_SIZE = 4;

/**
 * Shared split delimiter constants and regex.
 * Regex matches split delimiter with leading newline and either trailing newline or end of string,
 * preventing delimiter loss when trimmed strings are stored.
 */
export const SPLIT_DELIMITER_REGEX = /\n[ \t]*---[ \t]*(?:\n|$)/;
export const SPLIT_DELIMITER = "\n\n---\n\n";

export interface ParsedNotesColumns {
  col1: string;
  col2: string;
  isSplit: boolean;
  hasDelimiter: boolean;
}

/**
 * Parses markdown notes into 2 columns if the split delimiter is present.
 */
export function parseNotesColumns(val: string): ParsedNotesColumns {
  if (!val) {
    return { col1: "", col2: "", isSplit: false, hasDelimiter: false };
  }
  const match = val.match(SPLIT_DELIMITER_REGEX);
  if (match && match.index !== undefined) {
    const col1 = val.slice(0, match.index).trimEnd();
    const col2 = val.slice(match.index + match[0].length).trimStart();
    return {
      col1,
      col2,
      isSplit: true,
      hasDelimiter: true,
    };
  }
  return {
    col1: val || "",
    col2: "",
    isSplit: false,
    hasDelimiter: false,
  };
}

/**
 * Normalizes markdown text to ensure clean, Google Docs-style list rendering:
 * 1. Cleans multiple spaces or tabs after list markers (- , * , + , 1. ) to a single space.
 *    Without this, CommonMark parses "-    text" as an indented code block inside <li>!
 * 2. Normalizes unicode bullet points (•) at line starts to standard Markdown lists (- ).
 * 3. Normalizes base indentation of list blocks: in CommonMark, a list starting with >= 4 spaces
 *    cannot interrupt a paragraph (becoming a single long paragraph line) or becomes a code block.
 *    Stripping shared base indentation preserves nested sub-bullets while making top-level items valid.
 * 4. Ensures a blank line before list blocks preceded by non-list text (e.g. "Algorithm:") so lists
 *    are never swallowed as lazy paragraph continuation lines.
 * 5. Collapses blank lines between consecutive list items so CommonMark treats them as tight lists
 *    rather than loose lists with bloated paragraphs.
 */
export function normalizeMarkdown(source: string): string {
  if (!source) return "";

  // 1. Normalize unicode bullets to standard dashes
  let text = source
    .replace(/^([ \t]*)•[ \t]*/gm, "$1- ")
    .replace(/^([ \t]*)([-*+]|\d+\.)([ \t]*\t[ \t]*|[ \t]{2,})/gm, "$1$2 ");

  // 2. Process list blocks: if all items in a list block have a shared base indentation >= 4 spaces,
  //    strip that base indentation so CommonMark parses them as valid lists.
  const lines = text.split("\n");
  const listMarkerRegex = /^([ \t]*)([-*+•]|\d+\.)[ \t]+/;

  const processedLines = [...lines];
  let inList = false;
  let listBlockStart = -1;
  let minIndent = Infinity;

  const flushListBlock = (start: number, end: number, indentToStrip: number) => {
    if (indentToStrip >= 4 && indentToStrip !== Infinity) {
      for (let k = start; k < end; k++) {
        if (processedLines[k].trim() !== "") {
          processedLines[k] = processedLines[k].slice(indentToStrip);
        }
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(listMarkerRegex);
    if (match) {
      if (!inList) {
        inList = true;
        listBlockStart = i;
        minIndent = match[1].length;
      } else {
        minIndent = Math.min(minIndent, match[1].length);
      }
    } else if (inList) {
      if (line.trim() === "") {
        let nextIdx = i + 1;
        while (nextIdx < lines.length && lines[nextIdx].trim() === "") nextIdx++;
        if (nextIdx < lines.length && listMarkerRegex.test(lines[nextIdx])) {
          continue;
        }
      } else if (/^[ \t]{2,}/.test(line)) {
        continue;
      }
      flushListBlock(listBlockStart, i, minIndent);
      inList = false;
      listBlockStart = -1;
      minIndent = Infinity;
    }
  }
  if (inList) {
    flushListBlock(listBlockStart, lines.length, minIndent);
  }

  // 3. Ensure blank line before list starts if preceded by non-blank non-list text,
  //    and preserve deliberate empty lines between distinct bullet point sets.
  const result: string[] = [];

  const isListOrListBreak = (linesArr: string[], idx: number): boolean => {
    let curr = idx;
    while (curr >= 0) {
      const l = linesArr[curr];
      if (l.trim() === "") return false;
      if (listMarkerRegex.test(l)) return true;
      if (l.includes("list-break")) return true;
      if (/^[ \t]{2,}/.test(l)) {
        curr--;
        continue;
      }
      return false;
    }
    return false;
  };

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const isList = listMarkerRegex.test(line);

    if (isList) {
      // If previous line was non-blank and not a list, insert blank line to start fresh list block
      if (
        result.length > 0 &&
        result[result.length - 1].trim() !== "" &&
        !listMarkerRegex.test(result[result.length - 1])
      ) {
        result.push("");
      }
    }

    if (line.trim() === "") {
      let prevIdx = result.length - 1;
      while (prevIdx >= 0 && result[prevIdx].trim() === "") prevIdx--;
      let nextIdx = i + 1;
      while (nextIdx < processedLines.length && processedLines[nextIdx].trim() === "") nextIdx++;

      const isPrevList = prevIdx >= 0 && isListOrListBreak(result, prevIdx);
      const isNextList = nextIdx < processedLines.length && listMarkerRegex.test(processedLines[nextIdx]);

      if (isPrevList && isNextList) {
        // Deliberate empty line between two sets of list items:
        // In CommonMark, a blank line between two list items merges them into a single list.
        // Inserting a list-break spacer element creates two distinct lists and preserves the empty line.
        if (result.length > 0 && result[result.length - 1].trim() !== "" && !result[result.length - 1].includes("list-break")) {
          result.push("");
        }
        result.push('<div class="list-break"></div>');
        continue;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

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

  // Collapsed cursor:
  // If cursor is on a list item line and positioned at or before the start of text,
  // indent the whole list line to create a nested sub-bullet (Google Docs style)
  // rather than inserting spaces between the bullet marker and text.
  const lineText = currentVal.slice(firstLineStart, lastLineEnd);
  const bulletMatch = lineText.match(/^([ \t]*)([-*+•]|\d+\.)[ \t]*/);
  if (bulletMatch && (selectionStart - firstLineStart) <= bulletMatch[0].length) {
    const indent = " ".repeat(TAB_SIZE);
    const nextVal =
      currentVal.slice(0, firstLineStart) + indent + currentVal.slice(firstLineStart);
    const newPos = selectionStart + TAB_SIZE;
    update(nextVal, newPos, newPos);
    return true;
  }

  // General collapsed cursor: insert spaces up to the next 4-space tab stop
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
    const bulletMatch = lineText.match(/^([ \t]*)([-*+•]|\d+\.)[ \t]+/);
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
