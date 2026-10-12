import React, { useState, useMemo, useRef, useCallback } from "react";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { Code2, Copy, Check, RotateCcw } from "lucide-react";

export type SupportedLanguage =
  | "python"
  | "typescript"
  | "javascript"
  | "cpp"
  | "java"
  | "go"
  | "rust"
  | "sql";

interface LanguageOption {
  id: SupportedLanguage;
  name: string;
  meta: string;
  placeholder: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: "python",
    name: "Python 3",
    meta: "4 spaces • auto-indent",
    placeholder: "# Write Python code here... (auto-indent, comments & quotes supported)",
  },
  {
    id: "typescript",
    name: "TypeScript",
    meta: "Strict types • TSX",
    placeholder: "// Write TypeScript code here... (type annotations supported)",
  },
  {
    id: "javascript",
    name: "JavaScript",
    meta: "ESNext • JSX",
    placeholder: "// Write JavaScript code here...",
  },
  {
    id: "cpp",
    name: "C++",
    meta: "C++17 / C++20",
    placeholder: "// Write C++ code here...",
  },
  {
    id: "java",
    name: "Java",
    meta: "OpenJDK / Java 21",
    placeholder: "// Write Java code here...",
  },
  {
    id: "go",
    name: "Go",
    meta: "Go 1.22+",
    placeholder: "// Write Go code here...",
  },
  {
    id: "rust",
    name: "Rust",
    meta: "Rust 2021 Edition",
    placeholder: "// Write Rust code here...",
  },
  {
    id: "sql",
    name: "SQL",
    meta: "Standard ANSI SQL",
    placeholder: "-- Write SQL queries here...",
  },
];

interface PythonScratchpadProps {
  problemId: string;
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
}

// Custom theme aligning CodeMirror with the application dark palette
const appDarkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#090d16",
      color: "#e2e8f0",
      fontSize: "12.5px",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
    },
    ".cm-content": {
      fontFamily: "inherit",
      lineHeight: "20px",
      padding: "10px 0",
      caretColor: "#38bdf8",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#38bdf8",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(59, 130, 246, 0.35) !important",
    },
    ".cm-gutters": {
      backgroundColor: "#060911",
      color: "#475569",
      borderRight: "1px solid #1e293b",
      fontFamily: "inherit",
      fontSize: "12px",
      lineHeight: "20px",
      padding: "10px 0",
      userSelect: "none",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 6px 0 6px",
      minWidth: "24px",
      textAlign: "right",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      color: "#94a3b8",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
    },
    ".cm-line": {
      padding: "0 6px",
    },
  },
  { dark: true }
);

export const PythonScratchpad: React.FC<PythonScratchpadProps> = ({
  problemId: _problemId,
  value,
  onChange,
  onClear,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  // Selected language state persisted in localStorage
  const [language, setLanguage] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem("preferred_scratchpad_language");
      if (
        saved &&
        LANGUAGE_OPTIONS.some((opt) => opt.id === saved)
      ) {
        return saved as SupportedLanguage;
      }
    } catch {
      // Ignore storage errors
    }
    return "python";
  });

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    try {
      localStorage.setItem("preferred_scratchpad_language", newLang);
    } catch {
      // Ignore storage errors
    }
  };

  // Preferred editor height state (default: 380px, range: 260px - 820px)
  const [editorHeight, setEditorHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("preferred_scratchpad_height");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 260 && parsed <= 820) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return 380;
  });

  const isDraggingRef = useRef<boolean>(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(380);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = editorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = moveEvent.clientY - startYRef.current;
      const nextHeight = Math.min(820, Math.max(260, startHeightRef.current + delta));
      setEditorHeight(nextHeight);
      try {
        localStorage.setItem("preferred_scratchpad_height", nextHeight.toString());
      } catch {
        // Ignore storage errors
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Build language extension dynamically based on selected language
  const languageExtension = useMemo<Extension>(() => {
    switch (language) {
      case "python":
        return python();
      case "typescript":
        return javascript({ typescript: true, jsx: true });
      case "javascript":
        return javascript({ jsx: true });
      case "cpp":
        return cpp();
      case "java":
        return java();
      case "go":
        return go();
      case "rust":
        return rust();
      case "sql":
        return sql();
      default:
        return python();
    }
  }, [language]);

  // Combined CodeMirror extensions
  const extensions = useMemo<Extension[]>(() => {
    return [
      oneDark,
      appDarkTheme,
      indentUnit.of("    "),
      keymap.of([indentWithTab]),
      languageExtension,
    ];
  }, [languageExtension]);

  const activeOption = useMemo(() => {
    return (
      LANGUAGE_OPTIONS.find((opt) => opt.id === language) || LANGUAGE_OPTIONS[0]
    );
  }, [language]);

  // Line count stats
  const lineCount = useMemo(() => {
    if (!value) return 0;
    return value.split("\n").length;
  }, [value]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  const handleEditorChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  return (
    <div className="python-scratchpad-container">
      {/* Editor Header */}
      <div className="scratchpad-header">
        <div className="scratchpad-lang-badge">
          <Code2 size={14} className="text-sky-400" />
          <div className="scratchpad-lang-selector-wrap">
            <select
              className="scratchpad-lang-select"
              value={language}
              onChange={(e) =>
                handleLanguageChange(e.target.value as SupportedLanguage)
              }
              title="Select programming language"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
          <span className="lang-meta">• {activeOption.meta}</span>
        </div>

        <div className="scratchpad-actions">
          {value && (
            <>
              <span className="code-stats-pill">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </span>
              <button
                type="button"
                className="scratchpad-action-btn"
                onClick={handleCopy}
                title="Copy code to clipboard"
              >
                {copied ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
              <button
                type="button"
                className="scratchpad-action-btn scratchpad-clear-btn"
                onClick={onClear}
                title="Clear scratchpad draft"
              >
                <RotateCcw size={12} />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CodeMirror Editor Box */}
      <div
        className="code-editor-box codemirror-wrapper"
        style={{ height: `${editorHeight}px` }}
      >
        <CodeMirror
          value={value}
          height={`${editorHeight}px`}
          theme="dark"
          extensions={extensions}
          onChange={handleEditorChange}
          placeholder={activeOption.placeholder}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
          }}
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      {/* Draggable Bottom Resize Handle Bar */}
      <div
        className="scratchpad-resize-bar"
        onMouseDown={handleResizeMouseDown}
        title="Click and drag up or down to resize editor height"
      >
        <div className="resize-pill">
          <span className="resize-handle-dots">···</span>
        </div>
      </div>
    </div>
  );
};

// Also export alias CodeScratchpad for multi-language clarity
export const CodeScratchpad = PythonScratchpad;
