import React, { useState, useEffect, useRef } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  Columns,
  Square,
  List,
  Code2,
  Sparkles,
  RotateCcw,
  Eye,
  Edit3,
  ChevronDown,
  Bold,
  Italic,
  Palette,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import {
  handleTextareaTabKey,
  handleTextareaBackspaceKey,
  handleTextareaEnterKey,
  parseNotesColumns,
  SPLIT_DELIMITER,
} from "../indentation";

interface DualNotepadProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  placeholderCol1?: string;
  placeholderCol2?: string;
  labelCol1?: string;
  labelCol2?: string;
  height?: number | string;
  minHeight?: number;
  className?: string;
  allowSplit?: boolean;
}

interface CodeLanguage {
  id: string;
  label: string;
}

const SUPPORTED_LANGUAGES: CodeLanguage[] = [
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
  { id: "javascript", label: "JavaScript" },
  { id: "sql", label: "SQL" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "bash", label: "Bash / Shell" },
  { id: "json", label: "JSON" },
  { id: "text", label: "Plain Text" },
];

const SHORT_LANG_LABELS: Record<string, string> = {
  python: "py",
  typescript: "ts",
  javascript: "js",
  bash: "sh",
  text: "txt",
};

interface NoteColorOption {
  id: string;
  name: string;
  hex: string;
}

const NOTE_COLOR_OPTIONS: NoteColorOption[] = [
  { id: "red", name: "Red / Alert", hex: "#f87171" },
  { id: "orange", name: "Orange / Gotcha", hex: "#fb923c" },
  { id: "amber", name: "Yellow / Attention", hex: "#fbbf24" },
  { id: "green", name: "Green / Key Idea", hex: "#4ade80" },
  { id: "cyan", name: "Cyan / Param", hex: "#22d3ee" },
  { id: "blue", name: "Blue / Concept", hex: "#60a5fa" },
  { id: "purple", name: "Purple / Note", hex: "#c084fc" },
  { id: "pink", name: "Pink / Accent", hex: "#f472b6" },
];

export const DualNotepad: React.FC<DualNotepadProps> = ({
  value,
  onChange,
  placeholder = "Type notes, bullet points, code snippets, or thoughts...",
  placeholderCol1 = "Pad 1: Type notes, bullet points, code, or callouts...",
  placeholderCol2 = "Pad 2: Type notes, bullet points, code, or callouts...",
  labelCol1 = "Pad 1",
  labelCol2 = "Pad 2",
  height = 380,
  minHeight = 240,
  className = "",
  allowSplit = true,
}) => {
  const textarea1Ref = useRef<HTMLTextAreaElement>(null);
  const textarea2Ref = useRef<HTMLTextAreaElement>(null);

  const initialParsed = parseNotesColumns(value);
  const [isSplit, setIsSplit] = useState<boolean>(allowSplit ? initialParsed.hasDelimiter : false);
  const [col1, setCol1] = useState<string>(initialParsed.col1);
  const [col2, setCol2] = useState<string>(initialParsed.col2);

  // Preview modes
  type ViewMode = "edit" | "preview";
  const [viewModeSingle, setViewModeSingle] = useState<ViewMode>("edit");
  const [viewModeCol1, setViewModeCol1] = useState<ViewMode>("edit");
  const [viewModeCol2, setViewModeCol2] = useState<ViewMode>("edit");

  // Code language and color selection states
  const [activeLang, setActiveLang] = useState<string>("python");
  const [openLangMenu, setOpenLangMenu] = useState<1 | 2 | "single" | null>(null);
  const [openColorMenu, setOpenColorMenu] = useState<1 | 2 | "single" | null>(null);

  // Close dropdowns on outside click (mousedown) or Escape key
  useEffect(() => {
    if (openLangMenu === null && openColorMenu === null) return;
    const handleMouseDownOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".dual-color-btn-group, .dual-code-btn-group")) {
        return;
      }
      setOpenLangMenu(null);
      setOpenColorMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenLangMenu(null);
        setOpenColorMenu(null);
      }
    };
    window.addEventListener("mousedown", handleMouseDownOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleMouseDownOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openLangMenu, openColorMenu]);

  // Keep track of external value changes
  const lastSyncedValue = useRef<string>(value);
  useEffect(() => {
    if (value !== lastSyncedValue.current) {
      const parsed = parseNotesColumns(value);
      setCol1(parsed.col1);
      setCol2(parsed.col2);
      setIsSplit(allowSplit ? parsed.hasDelimiter : false);
      lastSyncedValue.current = value;
    }
  }, [value, allowSplit]);

  // Combine and emit updates
  const emitChange = (nextCol1: string, nextCol2: string, splitActive: boolean) => {
    let combined = nextCol1;
    if (splitActive) {
      if (nextCol1.trim() || nextCol2.trim()) {
        combined = nextCol1.trimEnd() + SPLIT_DELIMITER + nextCol2.trimStart();
      } else {
        combined = "";
      }
    }
    lastSyncedValue.current = combined;
    onChange(combined);
  };

  const handleCol1Change = (newVal: string) => {
    setCol1(newVal);
    emitChange(newVal, col2, isSplit);
  };

  const handleCol2Change = (newVal: string) => {
    setCol2(newVal);
    emitChange(col1, newVal, isSplit);
  };

  const handleToggleSplit = (targetSplit: boolean) => {
    if (targetSplit === isSplit) return;
    setIsSplit(targetSplit);
    if (!targetSplit) {
      // Merging into single column
      let merged = col1;
      if (col2.trim()) {
        merged = (col1.trim() ? col1.trimEnd() + "\n\n" : "") + col2.trim();
      }
      setCol1(merged);
      setCol2("");
      emitChange(merged, "", false);
    } else {
      emitChange(col1, col2, true);
    }
  };

  // Switch column to edit mode if currently in preview
  const ensureEditMode = (targetCol: 1 | 2) => {
    if (!isSplit && viewModeSingle !== "edit") {
      setViewModeSingle("edit");
    } else if (isSplit) {
      if (targetCol === 1 && viewModeCol1 !== "edit") setViewModeCol1("edit");
      if (targetCol === 2 && viewModeCol2 !== "edit") setViewModeCol2("edit");
    }
  };

  // Extracts leading and trailing whitespace from a selection so delimiters wrap strictly around core text
  const extractSurroundingWhitespace = (text: string) => {
    const leadingMatch = text.match(/^[ \t\r\n]+/);
    const leadingWs = leadingMatch ? leadingMatch[0] : "";
    const remaining = text.slice(leadingWs.length);
    const trailingMatch = remaining.match(/[ \t\r\n]+$/);
    const trailingWs = trailingMatch ? trailingMatch[0] : "";
    const core = remaining.slice(0, remaining.length - trailingWs.length);
    return { leadingWs, core, trailingWs };
  };

  // Shared helper to apply a text/cursor transformation to Pad 1 or Pad 2
  const applyColTransform = (
    targetCol: 1 | 2,
    compute: (
      currentVal: string,
      textarea: HTMLTextAreaElement | null
    ) => { nextVal: string; cursorStart: number; cursorEnd: number } | null
  ) => {
    ensureEditMode(targetCol);
    const isCol1 = targetCol === 1;
    const currentVal = isCol1 ? col1 : col2;
    const textarea = isCol1 ? textarea1Ref.current : textarea2Ref.current;

    const result = compute(currentVal, textarea);
    if (!result) return;
    const { nextVal, cursorStart, cursorEnd } = result;

    if (isCol1) {
      setCol1(nextVal);
      emitChange(nextVal, col2, isSplit);
    } else {
      setCol2(nextVal);
      emitChange(col1, nextVal, isSplit);
    }

    if (textarea) {
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
      });
    }
  };

  // Wraps selected text in **bold** or toggles existing bold
  const wrapOrInsertBold = (targetCol: 1 | 2) => {
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        const nextVal = currentVal + (currentVal ? " " : "") + "**bold**";
        return { nextVal, cursorStart: nextVal.length - 6, cursorEnd: nextVal.length - 2 };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);

      if (selectedText.length > 0) {
        const { leadingWs, core, trailingWs } = extractSurroundingWhitespace(selectedText);
        if (core.length > 0) {
          if (core.startsWith("**") && core.endsWith("**") && core.length >= 4) {
            const unwrapped = core.slice(2, -2).trim();
            const cursorStart = selectionStart + leadingWs.length;
            return {
              nextVal: before + leadingWs + unwrapped + trailingWs + after,
              cursorStart,
              cursorEnd: cursorStart + unwrapped.length,
            };
          }
          if (before.endsWith("**") && after.startsWith("**")) {
            const cursorStart = selectionStart - 2;
            return {
              nextVal: before.slice(0, -2) + selectedText + after.slice(2),
              cursorStart,
              cursorEnd: cursorStart + selectedText.length,
            };
          }
          const wrapped = `**${core}**`;
          const cursorStart = selectionStart + leadingWs.length;
          return {
            nextVal: before + leadingWs + wrapped + trailingWs + after,
            cursorStart,
            cursorEnd: cursorStart + wrapped.length,
          };
        }
      }

      const placeholder = "**bold**";
      const cursorStart = selectionStart + 2;
      return {
        nextVal: before + placeholder + after,
        cursorStart,
        cursorEnd: cursorStart + 4,
      };
    });
  };

  // Wraps selected text in *italic* or toggles existing italic
  const wrapOrInsertItalic = (targetCol: 1 | 2) => {
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        const nextVal = currentVal + (currentVal ? " " : "") + "*italic*";
        return { nextVal, cursorStart: nextVal.length - 7, cursorEnd: nextVal.length - 1 };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);

      if (selectedText.length > 0) {
        const { leadingWs, core, trailingWs } = extractSurroundingWhitespace(selectedText);
        if (core.length > 0) {
          if (core.startsWith("*") && core.endsWith("*") && core.length >= 2 && !core.startsWith("**")) {
            const unwrapped = core.slice(1, -1).trim();
            const cursorStart = selectionStart + leadingWs.length;
            return {
              nextVal: before + leadingWs + unwrapped + trailingWs + after,
              cursorStart,
              cursorEnd: cursorStart + unwrapped.length,
            };
          }
          if (before.endsWith("*") && !before.endsWith("**") && after.startsWith("*") && !after.startsWith("**")) {
            const cursorStart = selectionStart - 1;
            return {
              nextVal: before.slice(0, -1) + selectedText + after.slice(1),
              cursorStart,
              cursorEnd: cursorStart + selectedText.length,
            };
          }
          const wrapped = `*${core}*`;
          const cursorStart = selectionStart + leadingWs.length;
          return {
            nextVal: before + leadingWs + wrapped + trailingWs + after,
            cursorStart,
            cursorEnd: cursorStart + wrapped.length,
          };
        }
      }

      const placeholder = "*italic*";
      const cursorStart = selectionStart + 1;
      return {
        nextVal: before + placeholder + after,
        cursorStart,
        cursorEnd: cursorStart + 6,
      };
    });
  };

  // Wraps selected text in <span style="color: ...">...</span> or updates/clears existing color
  const wrapOrInsertColor = (targetCol: 1 | 2, colorHex: string) => {
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        if (!colorHex) return null;
        const snippet = `<span style="color: ${colorHex}">colored text</span>`;
        const nextVal = currentVal + (currentVal ? " " : "") + snippet;
        const cursorStart = nextVal.length - snippet.length + `<span style="color: ${colorHex}">`.length;
        return { nextVal, cursorStart, cursorEnd: cursorStart + "colored text".length };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);

      if (selectedText.length > 0) {
        const { leadingWs, core, trailingWs } = extractSurroundingWhitespace(selectedText);
        if (core.length === 0) return null;

        const spanOuterRegex = /^<span style="color:\s*[^"]*">([\s\S]*)<\/span>$/i;
        const openTagMatch = before.match(/<span style="color:\s*[^"]*">$/i);
        const closeTagMatch = after.match(/^<\/span>/i);

        if (!colorHex) {
          if (spanOuterRegex.test(core)) {
            const stripped = core.replace(spanOuterRegex, "$1");
            const cursorStart = selectionStart + leadingWs.length;
            return {
              nextVal: before + leadingWs + stripped + trailingWs + after,
              cursorStart,
              cursorEnd: cursorStart + stripped.length,
            };
          }
          if (/<span style="color:\s*[^"]*">/i.test(core)) {
            const stripped = core.replace(/<span style="color:\s*[^"]*">([\s\S]*?)<\/span>/gi, "$1");
            const cursorStart = selectionStart + leadingWs.length;
            return {
              nextVal: before + leadingWs + stripped + trailingWs + after,
              cursorStart,
              cursorEnd: cursorStart + stripped.length,
            };
          }
          if (openTagMatch && closeTagMatch) {
            const cursorStart = selectionStart - openTagMatch[0].length;
            return {
              nextVal: before.slice(0, -openTagMatch[0].length) + selectedText + after.slice(closeTagMatch[0].length),
              cursorStart,
              cursorEnd: cursorStart + selectedText.length,
            };
          }
          return null;
        }

        if (spanOuterRegex.test(core)) {
          const inner = core.replace(spanOuterRegex, "$1");
          const wrapped = `<span style="color: ${colorHex}">${inner}</span>`;
          const cursorStart = selectionStart + leadingWs.length;
          return {
            nextVal: before + leadingWs + wrapped + trailingWs + after,
            cursorStart,
            cursorEnd: cursorStart + wrapped.length,
          };
        }
        if (openTagMatch && closeTagMatch) {
          const beforeClean = before.slice(0, -openTagMatch[0].length);
          const afterClean = after.slice(closeTagMatch[0].length);
          const wrapped = `<span style="color: ${colorHex}">${core}</span>`;
          const cursorStart = beforeClean.length + leadingWs.length;
          return {
            nextVal: beforeClean + leadingWs + wrapped + trailingWs + afterClean,
            cursorStart,
            cursorEnd: cursorStart + wrapped.length,
          };
        }
        const wrapped = `<span style="color: ${colorHex}">${core}</span>`;
        const cursorStart = selectionStart + leadingWs.length;
        return {
          nextVal: before + leadingWs + wrapped + trailingWs + after,
          cursorStart,
          cursorEnd: cursorStart + wrapped.length,
        };
      }

      if (!colorHex) return null;
      const tagOpen = `<span style="color: ${colorHex}">`;
      const placeholder = `${tagOpen}colored text</span>`;
      const cursorStart = selectionStart + tagOpen.length;
      return {
        nextVal: before + placeholder + after,
        cursorStart,
        cursorEnd: cursorStart + "colored text".length,
      };
    });
  };

  // Keyboard helper for auto-indent, soft backspace, and tab indentation
  const handleKeyDown = (
    setter: (val: string) => void,
    isSecondCol: boolean = false
  ) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const targetCol: 1 | 2 = isSecondCol ? 2 : 1;

    // Cmd+B / Ctrl+B: Toggle Bold
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      wrapOrInsertBold(targetCol);
      return;
    }

    // Cmd+I / Ctrl+I: Toggle Italic
    if ((e.metaKey || e.ctrlKey) && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      wrapOrInsertItalic(targetCol);
      return;
    }

    const textarea = e.currentTarget;
    const update = (nextVal: string, newStart: number, newEnd: number) => {
      setter(nextVal);
      if (isSecondCol) emitChange(col1, nextVal, isSplit);
      else emitChange(nextVal, col2, isSplit);
      requestAnimationFrame(() => {
        textarea.selectionStart = newStart;
        textarea.selectionEnd = newEnd;
      });
    };

    if (handleTextareaTabKey(e, update)) return;
    if (handleTextareaBackspaceKey(e, update)) return;
    if (handleTextareaEnterKey(e, update, { enableBullets: true, enableColonBonus: true })) return;
  };

  // Wraps selected text in code block or inserts code template with chosen language
  const wrapOrInsertCodeBlock = (lang: string, targetCol: 1 | 2) => {
    const langTag = lang === "text" ? "" : lang;
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        const separator = currentVal.trim() ? (currentVal.endsWith("\n") ? "\n" : "\n\n") : "";
        const nextVal = currentVal + separator + `\`\`\`${langTag}\n\n\`\`\`\n`;
        return { nextVal, cursorStart: nextVal.length, cursorEnd: nextVal.length };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);
      const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

      if (selectedText.trim().length > 0) {
        const cleanSelected = selectedText.replace(/\r/g, "").replace(/^\n+|\n+$/g, "");
        const wrapped = `${prefix}\`\`\`${langTag}\n${cleanSelected}\n\`\`\`\n`;
        const cursorStart = before.length + wrapped.length;
        return { nextVal: before + wrapped + after, cursorStart, cursorEnd: cursorStart };
      }

      const template = `${prefix}\`\`\`${langTag}\n\n\`\`\`\n`;
      const cursorStart = before.length + prefix.length + 3 + langTag.length + 1;
      return { nextVal: before + template + after, cursorStart, cursorEnd: cursorStart };
    });
  };

  // Wraps selected text in callout (> line) or inserts callout template
  const wrapOrInsertCallout = (targetCol: 1 | 2) => {
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        const separator = currentVal.trim() ? (currentVal.endsWith("\n") ? "\n" : "\n\n") : "";
        const nextVal = currentVal + separator + "> **Note:** Key takeaway or gotcha\n";
        return { nextVal, cursorStart: nextVal.length, cursorEnd: nextVal.length };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);
      const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

      const insertion =
        selectedText.trim().length > 0
          ? `${prefix}${selectedText
              .replace(/\r/g, "")
              .replace(/\n+$/, "")
              .split("\n")
              .map((line) => (line.startsWith("> ") ? line : `> ${line}`))
              .join("\n")}\n`
          : `${prefix}> **Note:** `;

      const cursorStart = before.length + insertion.length;
      return { nextVal: before + insertion + after, cursorStart, cursorEnd: cursorStart };
    });
  };

  // Wraps selected text in bullet points or inserts bullet list template
  const wrapOrInsertList = (targetCol: 1 | 2) => {
    applyColTransform(targetCol, (currentVal, textarea) => {
      if (!textarea) {
        const separator = currentVal.trim() ? (currentVal.endsWith("\n") ? "\n" : "\n\n") : "";
        const nextVal = currentVal + separator + "- Point 1\n- Point 2\n- Point 3\n";
        return { nextVal, cursorStart: nextVal.length, cursorEnd: nextVal.length };
      }

      const { selectionStart, selectionEnd } = textarea;
      const selectedText = currentVal.slice(selectionStart, selectionEnd);
      const before = currentVal.slice(0, selectionStart);
      const after = currentVal.slice(selectionEnd);
      const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";

      const insertion =
        selectedText.trim().length > 0
          ? `${prefix}${selectedText
              .replace(/\r/g, "")
              .replace(/\n+$/, "")
              .split("\n")
              .map((line) => {
                if (!line.trim()) return line;
                return line.match(/^([ \t]*)([-*•]|\d+\.)[ \t]+/) ? line : `- ${line}`;
              })
              .join("\n")}\n`
          : `${prefix}- Point 1\n- Point 2\n- Point 3\n`;

      const cursorStart = before.length + insertion.length;
      return { nextVal: before + insertion + after, cursorStart, cursorEnd: cursorStart };
    });
  };

  const handleClearCol = (targetCol: 1 | 2) => {
    const isCol1 = targetCol === 1;
    const currentVal = isCol1 ? col1 : col2;
    if (!currentVal.trim()) return;
    const name = isCol1 ? (labelCol1 || "Pad 1") : (labelCol2 || "Pad 2");
    if (!confirm(`Clear ${name} draft?`)) return;
    if (isCol1) {
      handleCol1Change("");
    } else {
      handleCol2Change("");
    }
  };

  const handleClearSingle = () => {
    if (!col1.trim()) return;
    if (!confirm("Clear notepad draft?")) return;
    handleCol1Change("");
  };

  // Render multi-language code button with dropdown picker
  const renderCodeButtonGroup = (targetCol: 1 | 2 | "single") => {
    const colIndex: 1 | 2 = targetCol === "single" ? 1 : targetCol;
    const isMenuOpen = openLangMenu === targetCol;

    return (
      <div className="dual-code-btn-group">
        <button
          type="button"
          className={targetCol === "single" ? "dual-action-chip" : "dual-pane-mini-btn"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => wrapOrInsertCodeBlock(activeLang, colIndex)}
          title={`Wrap selection or insert ${activeLang} code block`}
        >
          <Code2 size={targetCol === "single" ? 13 : 11} />
          <span className="btn-label">Code</span>
          <span className="btn-lang-tag">{SHORT_LANG_LABELS[activeLang] || activeLang}</span>
        </button>
        <button
          type="button"
          className={`${targetCol === "single" ? "dual-action-chip caret" : "dual-pane-mini-btn caret"} ${isMenuOpen ? "active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setOpenColorMenu(null);
            setOpenLangMenu(isMenuOpen ? null : targetCol);
          }}
          title="Choose code block language"
        >
          <ChevronDown size={10} />
        </button>

        {isMenuOpen && (
          <div
            className="dual-lang-dropdown-menu"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dual-lang-menu-header">Select Language</div>
            <div className="dual-lang-menu-list">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  className={`dual-lang-menu-item ${activeLang === lang.id ? "active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveLang(lang.id);
                    setOpenLangMenu(null);
                    wrapOrInsertCodeBlock(lang.id, colIndex);
                  }}
                >
                  <span className="lang-label">{lang.label}</span>
                  <span className="lang-badge">```{lang.id === "text" ? "" : lang.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render formatting buttons: Bold, Italic, Color palette
  const renderFormatButtons = (targetCol: 1 | 2 | "single") => {
    const colIndex: 1 | 2 = targetCol === "single" ? 1 : targetCol;
    const isColorMenuOpen = openColorMenu === targetCol;
    const isSingle = targetCol === "single";
    const btnClass = isSingle ? "dual-action-chip" : "dual-pane-mini-btn";
    const iconSize = isSingle ? 12 : 11;

    return (
      <div className="dual-format-group">
        <button
          type="button"
          className={btnClass}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => wrapOrInsertBold(colIndex)}
          title="Bold (Cmd+B / Ctrl+B)"
        >
          <Bold size={iconSize} />
        </button>
        <button
          type="button"
          className={btnClass}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => wrapOrInsertItalic(colIndex)}
          title="Italic (Cmd+I / Ctrl+I)"
        >
          <Italic size={iconSize} />
        </button>
        <div className="dual-color-btn-group">
          <button
            type="button"
            className={`${btnClass} ${isColorMenuOpen ? "active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setOpenLangMenu(null);
              setOpenColorMenu(isColorMenuOpen ? null : targetCol);
            }}
            title="Text Color Palette"
          >
            <Palette size={iconSize} />
            <ChevronDown size={isSingle ? 10 : 9} />
          </button>

          {isColorMenuOpen && (
            <div
              className="dual-color-dropdown-menu"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dual-color-menu-header">Text Color</div>
              <div className="dual-color-grid">
                {NOTE_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="dual-color-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpenColorMenu(null);
                      wrapOrInsertColor(colIndex, c.hex);
                    }}
                    title={c.name}
                  >
                    <span className="color-swatch-dot" style={{ backgroundColor: c.hex }} />
                    <span className="color-swatch-name">{c.name}</span>
                  </button>
                ))}
              </div>
              <div className="dual-color-menu-footer">
                <button
                  type="button"
                  className="dual-color-clear-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpenColorMenu(null);
                    wrapOrInsertColor(colIndex, "");
                  }}
                  title="Remove color formatting from selection"
                >
                  Clear Color
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`dual-notepad-container ${className}`}>
      {/* Top Header / View Toggle Bar */}
      <div className="dual-notepad-topbar">
        {/* Left: Layout switcher & view toggles */}
        <div className="dual-topbar-left-group">
          {allowSplit && (
            <div className="dual-notepad-layout-toggles">
              <button
                type="button"
                className={`dual-layout-btn ${!isSplit ? "active" : ""}`}
                onClick={() => handleToggleSplit(false)}
                title="Single full-width editable area"
              >
                <Square size={12} />
                <span>1-Col</span>
              </button>
              <button
                type="button"
                className={`dual-layout-btn ${isSplit ? "active" : ""}`}
                onClick={() => handleToggleSplit(true)}
                title="Split into two editable side-by-side pads"
              >
                <Columns size={12} />
                <span>2-Col</span>
              </button>
            </div>
          )}

          {!isSplit && (
            <div className="dual-global-view-toggles">
              <button
                type="button"
                className={`dual-global-view-btn ${viewModeSingle === "edit" ? "active" : ""}`}
                onClick={() => setViewModeSingle("edit")}
                title="Edit Notes"
              >
                <Edit3 size={11} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                className={`dual-global-view-btn ${viewModeSingle === "preview" ? "active" : ""}`}
                onClick={() => setViewModeSingle("preview")}
                title="Preview Formatted Markdown"
              >
                <Eye size={11} />
                <span>Preview</span>
              </button>
            </div>
          )}
        </div>

        {!isSplit ? (
          /* Single Area View Controls & Quick Actions */
          <div className="dual-topbar-right-group">
            {viewModeSingle === "edit" ? (
              <div className="dual-notepad-quick-actions">
                {renderFormatButtons("single")}
                <button
                  type="button"
                  className="dual-action-chip"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => wrapOrInsertList(1)}
                  title="Insert or wrap in bullet points"
                >
                  <List size={12} />
                  <span className="btn-label">List</span>
                </button>
                {renderCodeButtonGroup("single")}
                <button
                  type="button"
                  className="dual-action-chip"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => wrapOrInsertCallout(1)}
                  title="Insert or wrap in callout quote"
                >
                  <Sparkles size={12} />
                  <span className="btn-label">Callout</span>
                </button>
                {col1.trim() && (
                  <button
                    type="button"
                    className="dual-action-chip clear"
                    onClick={handleClearSingle}
                    title="Clear notepad"
                  >
                    <RotateCcw size={12} />
                    <span className="btn-label">Clear</span>
                  </button>
                )}
              </div>
            ) : (
              <span className="dual-split-indicator">Preview Mode</span>
            )}
          </div>
        ) : (
          /* Split View Global Edit Both / Preview Both Switcher */
          <div className="dual-topbar-right-group">
            <div className="dual-global-view-toggles">
              <button
                type="button"
                className={`dual-global-view-btn ${viewModeCol1 === "edit" && viewModeCol2 === "edit" ? "active" : ""}`}
                onClick={() => {
                  setViewModeCol1("edit");
                  setViewModeCol2("edit");
                }}
                title="Edit both pads"
              >
                <Edit3 size={11} />
                <span>Edit Both</span>
              </button>
              <button
                type="button"
                className={`dual-global-view-btn ${viewModeCol1 === "preview" && viewModeCol2 === "preview" ? "active" : ""}`}
                onClick={() => {
                  setViewModeCol1("preview");
                  setViewModeCol2("preview");
                }}
                title="Preview formatted notes in both pads"
              >
                <Eye size={11} />
                <span>Preview Both</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div
        className="dual-notepad-body"
        style={{
          minHeight: typeof height === "number" ? height : (height === "100%" ? 0 : minHeight),
          flex: 1,
        }}
      >
        {!isSplit ? (
          /* Single Column Mode: Edit or Preview */
          <div className="dual-notepad-single-pane">
            {viewModeSingle === "edit" ? (
              <textarea
                ref={textarea1Ref}
                className="dual-pane-textarea"
                value={col1}
                onChange={(e) => handleCol1Change(e.target.value)}
                onKeyDown={handleKeyDown(setCol1, false)}
                placeholder={placeholder}
                spellCheck={false}
              />
            ) : (
              <div className="dual-pane-preview-container">
                {col1.trim() ? (
                  <MarkdownViewer source={col1} />
                ) : (
                  <div className="dual-preview-empty">Nothing written in notes yet. Switch to Edit to write.</div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Split Column Mode: Two identical editable / previewable pads */
          <Group orientation="horizontal" className="dual-notepad-split-group">
            {([1, 2] as const).map((colIdx, i) => {
              const isFirst = colIdx === 1;
              const colLabel = isFirst ? labelCol1 : labelCol2;
              const colViewMode = isFirst ? viewModeCol1 : viewModeCol2;
              const setColViewMode = isFirst ? setViewModeCol1 : setViewModeCol2;
              const colValue = isFirst ? col1 : col2;
              const handleColChange = isFirst ? handleCol1Change : handleCol2Change;
              const setColState = isFirst ? setCol1 : setCol2;
              const colPlaceholder = isFirst ? placeholderCol1 : placeholderCol2;
              const colRef = isFirst ? textarea1Ref : textarea2Ref;

              return (
                <React.Fragment key={colIdx}>
                  {i > 0 && <Separator className="dual-notepad-resize-handle" />}
                  <Panel defaultSize={50} minSize={25} className="dual-notepad-panel">
                    <div className="dual-panel-inner">
                      <div className="dual-panel-header">
                        <div className="dual-panel-title-area">
                          <span className="dual-panel-label">{colLabel}</span>
                          <div className="dual-pane-view-toggle">
                            <button
                              type="button"
                              className={`dual-view-pill ${colViewMode === "edit" ? "active" : ""}`}
                              onClick={() => setColViewMode("edit")}
                              title={`Edit Pad ${colIdx}`}
                            >
                              <Edit3 size={10} />
                              <span className="btn-label">Edit</span>
                            </button>
                            <button
                              type="button"
                              className={`dual-view-pill ${colViewMode === "preview" ? "active" : ""}`}
                              onClick={() => setColViewMode("preview")}
                              title={`Preview Pad ${colIdx}`}
                            >
                              <Eye size={10} />
                              <span className="btn-label">Preview</span>
                            </button>
                          </div>
                        </div>

                        <div className="dual-panel-actions">
                          {colViewMode === "edit" ? (
                            <>
                              {renderFormatButtons(colIdx)}
                              <button
                                type="button"
                                className="dual-pane-mini-btn"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => wrapOrInsertList(colIdx)}
                                title={`Insert Bullet List into Pad ${colIdx}`}
                              >
                                <List size={11} />
                                <span className="btn-label">List</span>
                              </button>
                              {renderCodeButtonGroup(colIdx)}
                              <button
                                type="button"
                                className="dual-pane-mini-btn"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => wrapOrInsertCallout(colIdx)}
                                title={`Insert Callout into Pad ${colIdx}`}
                              >
                                <Sparkles size={11} />
                                <span className="btn-label">Callout</span>
                              </button>
                              {colValue.trim() && (
                                <button
                                  type="button"
                                  className="dual-pane-mini-btn clear"
                                  onClick={() => handleClearCol(colIdx)}
                                  title={`Clear ${colLabel}`}
                                >
                                  <RotateCcw size={11} />
                                  <span className="btn-label">Clear</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="dual-pane-preview-tag">Previewing</span>
                          )}
                        </div>
                      </div>

                      {colViewMode === "edit" ? (
                        <textarea
                          ref={colRef}
                          className="dual-pane-textarea"
                          value={colValue}
                          onChange={(e) => handleColChange(e.target.value)}
                          onKeyDown={handleKeyDown(setColState, !isFirst)}
                          placeholder={colPlaceholder}
                          spellCheck={false}
                        />
                      ) : (
                        <div className="dual-pane-preview-container">
                          {colValue.trim() ? (
                            <MarkdownViewer source={colValue} />
                          ) : (
                            <div className="dual-preview-empty">Nothing written in {colLabel} yet.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>
                </React.Fragment>
              );
            })}
          </Group>
        )}
      </div>
    </div>
  );
};
