import React, { useState } from "react";
import type { Problem, ReviewAction } from "../types";
import { submitReview } from "../api";
import { Tag, Lightbulb, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { PythonScratchpad } from "./PythonScratchpad";

interface ProblemFlashcardProps {
  problem: Problem;
  categoryName?: string;
  counterText?: string;
  onRating?: (rating: ReviewAction) => Promise<void> | void;
  submitting?: boolean;
  onReviewRecorded?: () => void;
  className?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const ProblemFlashcard: React.FC<ProblemFlashcardProps> = ({
  problem,
  categoryName,
  counterText,
  onRating,
  submitting = false,
  onReviewRecorded,
  className = "",
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}) => {
  const [showHints, setShowHints] = useState<boolean>(false);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [scratchpad, setScratchpad] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`session_scratch_${problem.id}`) || "";
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
    try {
      setScratchpad(sessionStorage.getItem(`session_scratch_${problem.id}`) || "");
    } catch {
      setScratchpad("");
    }
    setShowHints(false);
    setShowSolution(false);
    setReviewedMessage(null);
  }

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
    <div className={`card flashcard ${className}`}>
      {/* Top Bar: Category Pill & Stats Counter */}
      <div className="card-top-bar">
        <div className="badge-row">
          {categoryName && <span className="badge category-badge">{categoryName}</span>}
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

      {/* Compact Problem Title Header */}
      <div className="card-compact-header">
        <h2 className="problem-title-compact">{problem.title}</h2>
      </div>

      {/* Python Code Block Scratchpad */}
      <PythonScratchpad
        problemId={problem.id}
        value={scratchpad}
        onChange={handleScratchpadChange}
        onClear={handleClearScratchpad}
      />

      {/* Progressive Reveal Action Bar */}
      <div className="hints-action-bar">
        <button
          type="button"
          className={`hint-toggle-btn ${showHints ? "active" : ""}`}
          onClick={() => setShowHints(!showHints)}
          title="Toggle Hints"
        >
          <Lightbulb size={16} />
          <span>Hints</span>
        </button>

        <button
          type="button"
          className={`hint-toggle-btn ${showSolution ? "active" : ""}`}
          onClick={() => setShowSolution(!showSolution)}
          title="Toggle Notes"
        >
          <CheckCircle2 size={16} />
          <span>Notes</span>
        </button>
      </div>

      {/* Hints Section */}
      {showHints && (
        <div className="prompt-section">
          <div className="section-label">Hints:</div>
          <div className="prompt-text">{problem.prompt}</div>
        </div>
      )}

      {/* Reference Notes & Solution Section */}
      {showSolution && (
        <div className="notes-section">
          <div className="section-label">Notes:</div>
          <div className="notes-content">{problem.notes}</div>

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
