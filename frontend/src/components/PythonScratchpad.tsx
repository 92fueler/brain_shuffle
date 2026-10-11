import React, { useRef, useState, useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-python";
import { Code2, Copy, Check, RotateCcw } from "lucide-react";

interface PythonScratchpadProps {
  problemId: string;
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
}

export const PythonScratchpad: React.FC<PythonScratchpadProps> = ({
  problemId,
  value,
  onChange,
  onClear,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

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

  // Line count calculations (fills entire visible gutter height)
  const lines = useMemo(() => (value || "").split("\n"), [value]);
  const lineCount = useMemo(() => {
    const visibleCapacity = Math.floor((editorHeight - 24) / 20);
    return Math.max(lines.length, visibleCapacity, 18);
  }, [lines.length, editorHeight]);

  // Prism Python syntax highlighting
  const highlightedCode = useMemo(() => {
    if (!value) return "";
    try {
      return Prism.highlight(value, Prism.languages.python, "python");
    } catch {
      return value;
    }
  }, [value]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const top = e.currentTarget.scrollTop;
    const left = e.currentTarget.scrollLeft;
    if (preRef.current) {
      preRef.current.scrollTop = top;
      preRef.current.scrollLeft = left;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = top;
    }
  };

  const updateCodeWithCursor = (newVal: string, startPos: number, endPos: number) => {
    onChange(newVal);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = startPos;
        textareaRef.current.selectionEnd = endPos;
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value: currentVal } = textarea;

    // 1. Tab Key (Indentation & Dedentation)
    if (e.key === "Tab") {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift+Tab: Dedent
        const lineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = currentVal.slice(lineStart, selectionEnd);
        if (currentLine.startsWith("    ")) {
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(lineStart + 4);
          const newStart = Math.max(lineStart, selectionStart - 4);
          const newEnd = Math.max(lineStart, selectionEnd - 4);
          updateCodeWithCursor(nextVal, newStart, newEnd);
        } else if (currentLine.startsWith(" ")) {
          const spaces = currentLine.match(/^ +/)?.[0].length || 1;
          const remove = Math.min(spaces, 4);
          const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(lineStart + remove);
          updateCodeWithCursor(nextVal, Math.max(lineStart, selectionStart - remove), Math.max(lineStart, selectionEnd - remove));
        }
      } else {
        // Tab: Insert 4 spaces
        const nextVal = currentVal.slice(0, selectionStart) + "    " + currentVal.slice(selectionEnd);
        updateCodeWithCursor(nextVal, selectionStart + 4, selectionStart + 4);
      }
      return;
    }

    // 2. Enter Key (Auto-Indent + Colon Bonus)
    if (e.key === "Enter") {
      e.preventDefault();
      const lineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
      const lineText = currentVal.slice(lineStart, selectionStart);
      const indentMatch = lineText.match(/^[ \t]*/);
      let indent = indentMatch ? indentMatch[0] : "";

      // Check if line ends with a colon (ignoring comments and trailing space)
      const cleanLine = lineText.replace(/#.*$/, "").trimEnd();
      if (cleanLine.endsWith(":")) {
        indent += "    ";
      }

      const nextVal = currentVal.slice(0, selectionStart) + "\n" + indent + currentVal.slice(selectionEnd);
      const newPos = selectionStart + 1 + indent.length;
      updateCodeWithCursor(nextVal, newPos, newPos);
      return;
    }

    // 3. Backspace Key (Delete 4 spaces at once if on indentation)
    if (e.key === "Backspace" && selectionStart === selectionEnd && selectionStart >= 4) {
      const lineStart = currentVal.lastIndexOf("\n", selectionStart - 1) + 1;
      const textBefore = currentVal.slice(lineStart, selectionStart);
      if (/^ +$/.test(textBefore) && textBefore.length % 4 === 0) {
        e.preventDefault();
        const nextVal = currentVal.slice(0, selectionStart - 4) + currentVal.slice(selectionEnd);
        updateCodeWithCursor(nextVal, selectionStart - 4, selectionStart - 4);
        return;
      }
    }

    // 4. Auto-closing pair brackets & quotes
    const openCloser: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      '"': '"',
      "'": "'",
    };

    if (openCloser[e.key]) {
      const closer = openCloser[e.key];
      // Skip over closing character if already at cursor
      if (currentVal[selectionStart] === closer && (e.key === '"' || e.key === "'")) {
        e.preventDefault();
        updateCodeWithCursor(currentVal, selectionStart + 1, selectionStart + 1);
        return;
      }

      e.preventDefault();
      const selected = currentVal.slice(selectionStart, selectionEnd);
      const nextVal = currentVal.slice(0, selectionStart) + e.key + selected + closer + currentVal.slice(selectionEnd);
      updateCodeWithCursor(nextVal, selectionStart + 1, selectionEnd + 1);
      return;
    }

    // Skip over closing bracket if typed
    if ((e.key === ")" || e.key === "]" || e.key === "}") && currentVal[selectionStart] === e.key) {
      e.preventDefault();
      updateCodeWithCursor(currentVal, selectionStart + 1, selectionStart + 1);
      return;
    }
  };

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

  return (
    <div className="python-scratchpad-container">
      {/* Editor Header */}
      <div className="scratchpad-header">
        <div className="scratchpad-lang-badge">
          <Code2 size={14} className="text-sky-400" />
          <span className="lang-name">Python 3</span>
          <span className="lang-meta">• Tab (4 spaces) & Auto-indent</span>
        </div>

        <div className="scratchpad-actions">
          {value && (
            <>
              <span className="code-stats-pill">
                {lines.length} {lines.length === 1 ? "line" : "lines"}
              </span>
              <button
                type="button"
                className="scratchpad-action-btn"
                onClick={handleCopy}
                title="Copy code to clipboard"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
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

      {/* Editor Body with Line Numbers & Syntax Highlighting */}
      <div className="code-editor-box" style={{ height: `${editorHeight}px` }}>
        {/* Line Numbers Gutter */}
        <div ref={gutterRef} className="code-editor-gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="gutter-line-number">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor Surface */}
        <div className="code-editor-surface">
          {/* Syntax Highlighted Render Layer */}
          <pre ref={preRef} className="code-highlight-layer" aria-hidden="true">
            <code
              className="language-python"
              dangerouslySetInnerHTML={{
                __html: highlightedCode ? highlightedCode + "\n" : "",
              }}
            />
          </pre>

          {/* Transparent Input Textarea Overlay */}
          <textarea
            ref={textareaRef}
            id={`scratchpad-${problemId}`}
            className="code-editor-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            placeholder="# Write Python code here... (auto-indent & tab supported)"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
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
