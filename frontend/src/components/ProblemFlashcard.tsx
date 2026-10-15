import React, { useState } from "react";
import type { Problem, ReviewAction } from "../types";
import { isProblemCategory } from "../types";
import { formatCategoryName, getCategoryTheme } from "../categoryTheme";
import { submitReview } from "../api";
import {
  Tag,
  Lightbulb,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  EyeOff,
  Code2,
  Columns,
  Edit3,
  Square,
} from "lucide-react";
import { CodeScratchpad } from "./CodeScratchpad";
import { DualNotepad } from "./DualNotepad";
import { MarkdownViewer } from "./MarkdownViewer";
import { Group, Panel, Separator } from "react-resizable-panels";
import { parseNotesColumns } from "../indentation";

interface ProblemFlashcardProps {
  problem: Problem;
  categoryName?: string;
  categorySlug?: string;
  counterText?: string;
  onRating?: (rating: ReviewAction) => Promise<void> | void;
  submitting?: boolean;
  onReviewRecorded?: () => void;
  className?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  embedded?: boolean;
  defaultShowSolution?: boolean;
}

export const ProblemFlashcard: React.FC<ProblemFlashcardProps> = ({
  problem,
  categoryName,
  categorySlug,
  counterText,
  onRating,
  submitting = false,
  onReviewRecorded,
  className = "",
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  embedded = false,
  defaultShowSolution,
}) => {
  const isNote = categorySlug
    ? !isProblemCategory(categorySlug)
    : Boolean(
        categoryName &&
          !categoryName.toLowerCase().includes("coding") &&
          !categoryName.toLowerCase().includes("system design")
      );

  const initialShowSolution = defaultShowSolution ?? false;
  const [showHints, setShowHints] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(initialShowSolution);
  type WorkspaceLayout = "code" | "split" | "notes";
  const getInitialWorkspaceLayout = (): WorkspaceLayout => {
    try {
      const saved = sessionStorage.getItem("preferred_workspace_layout") as WorkspaceLayout | null;
      if (saved === "code" || saved === "split" || saved === "notes") return saved;
    } catch {
      // Ignore storage access errors
    }
    return isNote ? "notes" : "code";
  };
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>(getInitialWorkspaceLayout);

  const handleWorkspaceLayoutChange = (layout: WorkspaceLayout) => {
    setWorkspaceLayout(layout);
    try {
      sessionStorage.setItem("preferred_workspace_layout", layout);
    } catch {
      // Ignore storage access errors
    }
  };

  const parsedNotes = parseNotesColumns(problem.notes || "");
  const [notesViewOverride, setNotesViewOverride] = useState<"1-col" | "2-col" | null>(null);
  const isSplitViewActive = notesViewOverride !== null
    ? notesViewOverride === "2-col"
    : parsedNotes.isSplit;

  const [scratchpad, setScratchpad] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`session_scratch_${problem.id}`) || "";
    } catch {
      return "";
    }
  });
  const [userNotes, setUserNotes] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`session_notes_${problem.id}`) || "";
    } catch {
      return "";
    }
  });
  const [internalSubmitting, setInternalSubmitting] = useState<boolean>(false);
  const [reviewedMessage, setReviewedMessage] = useState<string | null>(null);

  // Synchronously reset and sync state if problem.id changes
  const [trackedProblemId, setTrackedProblemId] = useState<string>(problem.id);
  if (trackedProblemId !== problem.id) {
    setTrackedProblemId(problem.id);
    setWorkspaceLayout(getInitialWorkspaceLayout());
    setNotesViewOverride(null);
    try {
      setScratchpad(sessionStorage.getItem(`session_scratch_${problem.id}`) || "");
    } catch {
      setScratchpad("");
    }
    try {
      setUserNotes(sessionStorage.getItem(`session_notes_${problem.id}`) || "");
    } catch {
      setUserNotes("");
    }
    setShowHints(false);
    setShowSolution(initialShowSolution);
    setReviewedMessage(null);
  }

  const hasDistinctPrompt = Boolean(
    problem.prompt &&
      problem.prompt.trim() !== "" &&
      problem.prompt.trim().toLowerCase() !== problem.title.trim().toLowerCase()
  );

  const handleScratchpadChange = (val: string) => {
    setScratchpad(val);
    try {
      sessionStorage.setItem(`session_scratch_${problem.id}`, val);
    } catch {
      // Ignore storage access errors
    }
  };

  const handleClearScratchpad = () => {
    if (scratchpad && !confirm("Clear scratchpad draft for this session?")) return;
    setScratchpad("");
    try {
      sessionStorage.removeItem(`session_scratch_${problem.id}`);
    } catch {
      // Ignore storage access errors
    }
  };

  const handleUserNotesChange = (val: string) => {
    setUserNotes(val);
    try {
      sessionStorage.setItem(`session_notes_${problem.id}`, val);
    } catch {
      // Ignore storage access errors
    }
  };


  const handleRatingClick = async (action: ReviewAction) => {
    if (onRating) {
      await onRating(action);
      return;
    }

    setInternalSubmitting(true);
    try {
      await submitReview(problem.id, { rating: action });
      const labels: Record<string, string> = {
        drill_soon: "Scheduled: Drill again today (~4h)",
        intra_week: "Scheduled: Mid-week consolidation (2–3d)",
        weekly: "Scheduled: Next week review (7d)",
        skip_park: "Scheduled: Parked (21d)",
      };
      setReviewedMessage(labels[action] || `Action recorded!`);
      setTimeout(() => setReviewedMessage(null), 3000);
      if (onReviewRecorded) {
        onReviewRecorded();
      }
    } catch (err) {
      console.error("Failed to submit review", err);
    } finally {
      setInternalSubmitting(false);
    }
  };

  const isBusy = submitting || internalSubmitting;

  return (
    <div className={`card flashcard ${embedded ? "embedded-flashcard" : ""} ${className}`}>
      {/* Top Bar: Category Pill & Stats Counter */}
      <div className="card-top-bar">
        <div className="badge-row">
          {!embedded && categoryName && (
            <span
              className={`badge category-badge ${isNote ? "note-category-badge" : ""}`}
              style={getCategoryTheme(categorySlug || categoryName).style}
            >
              {formatCategoryName(categoryName)} {isNote ? "Note" : ""}
            </span>
          )}
          {problem.review_count > 0 ? (
            <>
              <span className="badge stats-badge">
                Tested {problem.review_count}x (Retention: {problem.retention_score.toFixed(1)})
              </span>
              {problem.cadence && (
                <span className="badge cadence-badge">
                  Cadence: {problem.cadence.replace("_", "-")}
                </span>
              )}
            </>
          ) : (
            <span className="badge new-badge">Unreviewed</span>
          )}
        </div>
        {(counterText || onPrev || onNext) && (
          <div className="card-nav-controls">
            {onPrev && (
              <button
                type="button"
                className="card-nav-btn"
                onClick={onPrev}
                disabled={!hasPrev}
                title="Previous problem (←)"
              >
                <ChevronLeft size={15} /> Prev
              </button>
            )}
            {counterText && <span className="card-counter">{counterText}</span>}
            {onNext && (
              <button
                type="button"
                className="card-nav-btn"
                onClick={onNext}
                disabled={!hasNext}
                title="Next problem (→)"
              >
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact Problem / Topic Title Header (omitted when embedded because parent accordion header displays title) */}
      {!embedded && (
        <div className="card-compact-header">
          <h2 className="problem-title-compact">{problem.title}</h2>
        </div>
      )}

      {/* Distinct Recall Prompt Banner: Shown when prompt differs from title */}
      {hasDistinctPrompt && isNote && (
        <div className="note-prompt-container" style={{ margin: "4px 0 10px 0" }}>
          <span className="note-prompt-kicker">Recall Prompt</span>
          <h3 className="note-prompt-heading">{problem.prompt}</h3>
        </div>
      )}

      {/* Workspace Layout Mode Switcher */}
      <div className="scratchpad-mode-bar">
        <div className="scratchpad-mode-pills">
          <button
            type="button"
            className={`scratchpad-mode-btn ${workspaceLayout === "code" ? "active" : ""}`}
            onClick={() => handleWorkspaceLayoutChange("code")}
            title="Code Editor Only"
          >
            <Code2 size={13} />
            <span>Code Only</span>
          </button>
          <button
            type="button"
            className={`scratchpad-mode-btn ${workspaceLayout === "split" ? "active" : ""}`}
            onClick={() => handleWorkspaceLayoutChange("split")}
            title="Split Workspace: Code on Left, Rich Notes on Right"
          >
            <Columns size={13} />
            <span>Split View (Code + Notes)</span>
          </button>
          <button
            type="button"
            className={`scratchpad-mode-btn ${workspaceLayout === "notes" ? "active" : ""}`}
            onClick={() => handleWorkspaceLayoutChange("notes")}
            title="Rich Notes Only (Bullet points, embedded code, markdown)"
          >
            <Edit3 size={13} />
            <span>Scratch Notes Only</span>
          </button>
        </div>
      </div>

      {/* Interactive Unified Workspace Area */}
      <div className="flashcard-workspace-frame">
        {workspaceLayout === "code" && (
          <div className="workspace-panel-full workspace-panel-code">
            <CodeScratchpad
              problemId={problem.id}
              value={scratchpad}
              onChange={handleScratchpadChange}
              onClear={handleClearScratchpad}
            />
          </div>
        )}

        {workspaceLayout === "split" && (
          <Group orientation="horizontal" className="flashcard-split-group">
            <Panel defaultSize={50} minSize={25} className="split-panel-code">
              <CodeScratchpad
                problemId={problem.id}
                value={scratchpad}
                onChange={handleScratchpadChange}
                onClear={handleClearScratchpad}
              />
            </Panel>
            <Separator className="resizable-split-handle" />
            <Panel defaultSize={50} minSize={25} className="split-panel-notes">
              <DualNotepad
                value={userNotes}
                onChange={handleUserNotesChange}
                placeholder={
                  isNote
                    ? "Type recall notes or snippets alongside code..."
                    : "Type scratch notes, bullet points, or snippets alongside your code..."
                }
                placeholderCol1="Pad 1: Notes, bullet points, code, or callouts..."
                placeholderCol2="Pad 2: Notes, bullet points, code, or callouts..."
                labelCol1="Pad 1"
                labelCol2="Pad 2"
                height="100%"
                allowSplit={false}
              />
            </Panel>
          </Group>
        )}

        {workspaceLayout === "notes" && (
          <div className="workspace-panel-full workspace-panel-notes">
            <DualNotepad
              value={userNotes}
              onChange={handleUserNotesChange}
              placeholder={
                isNote
                  ? "Type your recall notes, bullet points, key concepts, or edge cases here..."
                  : "Type scratch notes, bullet points, edge cases, or embedded code... (supports splitting into 2 columns)"
              }
              placeholderCol1="Pad 1: Type notes, bullet points, code, or callouts..."
              placeholderCol2="Pad 2: Type notes, bullet points, code, or callouts..."
              labelCol1="Pad 1"
              labelCol2="Pad 2"
              height="100%"
              allowSplit={true}
            />
          </div>
        )}
      </div>

      {/* Progressive Reveal Action Bar */}
      <div className="hints-action-bar">
        {Boolean(problem.prompt && (!isNote || hasDistinctPrompt)) && (
          <button
            type="button"
            className={`hint-toggle-btn ${showHints ? "active" : ""}`}
            onClick={() => setShowHints(!showHints)}
            title="Toggle Hints"
          >
            <Lightbulb size={16} />
            <span>Hints</span>
          </button>
        )}

        <button
          type="button"
          className={`hint-toggle-btn ${showSolution ? "active" : ""}`}
          onClick={() => setShowSolution(!showSolution)}
          title={isNote ? "Toggle Reference Note" : "Toggle Solution / Notes"}
        >
          {showSolution ? (
            <EyeOff size={16} />
          ) : isNote ? (
            <BookOpen size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>
            {showSolution
              ? isNote
                ? "Hide Note"
                : "Hide Solution"
              : isNote
              ? "Reveal Note / Key Takeaway"
              : "Reveal Solution / Notes"}
          </span>
        </button>
      </div>

      {/* Hints Section */}
      {showHints && problem.prompt && (
        <div className="prompt-section">
          <div className="section-label">{isNote ? "Recall Prompt:" : "Hints & Constraints:"}</div>
          <div className="prompt-text">{problem.prompt}</div>
        </div>
      )}

      {/* Reference Notes & Solution Section */}
      {showSolution && (
        <div className="notes-section">
          <div className="section-label-row">
            <div className="section-label">
              {isNote ? "Note & Key Takeaways:" : "Notes & Reference Solution:"}
            </div>
            {parsedNotes.isSplit && (
              <div className="notes-view-mode-toggles">
                <button
                  type="button"
                  className={`notes-view-mode-btn ${!isSplitViewActive ? "active" : ""}`}
                  onClick={() => setNotesViewOverride("1-col")}
                  title="View notes in single combined column"
                >
                  <Square size={11} />
                  <span>1-Col</span>
                </button>
                <button
                  type="button"
                  className={`notes-view-mode-btn ${isSplitViewActive ? "active" : ""}`}
                  onClick={() => setNotesViewOverride("2-col")}
                  title="View notes in side-by-side 2-column split"
                >
                  <Columns size={11} />
                  <span>2-Col</span>
                </button>
              </div>
            )}
          </div>

          {parsedNotes.isSplit && isSplitViewActive ? (
            <div className="flashcard-split-notes-layout">
              <div className="flashcard-notes-pane flashcard-notes-pane-left">
                <div className="flashcard-pane-header">
                  <span className="flashcard-pane-label">Pad 1</span>
                </div>
                <div className="flashcard-pane-body">
                  <MarkdownViewer source={parsedNotes.col1} className="notes-content" />
                </div>
              </div>
              <div className="flashcard-notes-pane flashcard-notes-pane-right">
                <div className="flashcard-pane-header">
                  <span className="flashcard-pane-label">Pad 2</span>
                </div>
                <div className="flashcard-pane-body">
                  <MarkdownViewer source={parsedNotes.col2} className="notes-content" />
                </div>
              </div>
            </div>
          ) : (
            <MarkdownViewer source={problem.notes} className="notes-content" />
          )}

          {/* Subtopic Tags */}
          {problem.tags && problem.tags.length > 0 && (
            <div className="tag-list">
              {problem.tags.map((t, i) => (
                <span key={i} className="tag-pill">
                  <Tag size={10} /> #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Refined, Always-Available Rolling Cadence Action Bar */}
      <div className="feedback-section">
        <div className="feedback-prompt">Review Cadence & Priority:</div>
        {reviewedMessage && (
          <div className="review-feedback-notice">{reviewedMessage}</div>
        )}
        <div className="cadence-action-row">
          <button
            type="button"
            className="cadence-btn cadence-drill"
            onClick={() => handleRatingClick("drill_soon")}
            disabled={isBusy}
            title="High priority intra-day review (~4h rolling window)"
          >
            <span className="cadence-icon">🔄</span>
            <span className="cadence-label">Drill Soon</span>
            <span className="cadence-chip">~4h</span>
          </button>
          <button
            type="button"
            className="cadence-btn cadence-intraweek"
            onClick={() => handleRatingClick("intra_week")}
            disabled={isBusy}
            title="Consolidate mental model in 2 to 3 days (48h–72h)"
          >
            <span className="cadence-icon">📅</span>
            <span className="cadence-label">Mid-Week</span>
            <span className="cadence-chip">2–3d</span>
          </button>
          <button
            type="button"
            className="cadence-btn cadence-weekly"
            onClick={() => handleRatingClick("weekly")}
            disabled={isBusy}
            title="Standard weekly rotation (7 days)"
          >
            <span className="cadence-icon">🗓️</span>
            <span className="cadence-label">Next Week</span>
            <span className="cadence-chip">7d</span>
          </button>
          <button
            type="button"
            className="cadence-btn cadence-park"
            onClick={() => handleRatingClick("skip_park")}
            disabled={isBusy}
            title="Park and defer for 3 weeks (21 days)"
          >
            <span className="cadence-icon">⏭️</span>
            <span className="cadence-label">Skip / Park</span>
            <span className="cadence-chip">21d</span>
          </button>
        </div>
      </div>
    </div>
  );
};
