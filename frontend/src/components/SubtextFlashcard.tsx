import React, { useState } from "react";
import type { Subtext, ReviewAction } from "../types";
import { formatCategoryName, getCategoryTheme } from "../categoryTheme";
import { submitSubtextReview } from "../api";
import {
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Quote,
  Sparkles,
} from "lucide-react";

interface SubtextFlashcardProps {
  subtext: Subtext;
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
}

export const SubtextFlashcard: React.FC<SubtextFlashcardProps> = ({
  subtext,
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
}) => {
  const [showSubtext, setShowSubtext] = useState<boolean>(false);
  const [internalSubmitting, setInternalSubmitting] = useState<boolean>(false);
  const [reviewedMessage, setReviewedMessage] = useState<string | null>(null);

  // Synchronously reset reveal state when subtext.id changes
  const [trackedId, setTrackedId] = useState<string>(subtext.id);
  if (trackedId !== subtext.id) {
    setTrackedId(subtext.id);
    setShowSubtext(false);
    setReviewedMessage(null);
  }

  const handleRatingClick = async (action: ReviewAction) => {
    if (onRating) {
      await onRating(action);
      return;
    }

    setInternalSubmitting(true);
    try {
      await submitSubtextReview(subtext.id, { rating: action });
      const labels: Record<string, string> = {
        drill_soon: "Scheduled: Drill again today (~4h)",
        intra_week: "Scheduled: Mid-week consolidation (2–3d)",
        weekly: "Scheduled: Next week review (7d)",
        skip_park: "Scheduled: Parked (21d)",
      };
      setReviewedMessage(labels[action] || "Action recorded!");
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
  const theme = getCategoryTheme(categorySlug || categoryName || "subtext");

  return (
    <div className={`card flashcard subtext-card ${className}`}>
      {/* Top Bar: Category Pill & Cadence Metadata */}
      <div className="card-top-bar">
        <div className="badge-row">
          <span
            className="badge category-badge"
            style={theme.style}
          >
            {formatCategoryName(categoryName || "Subtext")}
          </span>

          {subtext.review_count > 0 ? (
            <>
              <span className="badge stats-badge">
                Tested {subtext.review_count}x (Retention: {subtext.retention_score.toFixed(1)})
              </span>
              {subtext.cadence && (
                <span className="badge cadence-badge">
                  Cadence: {subtext.cadence.replace("_", "-")}
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
                title="Previous entry (←)"
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
                title="Next entry (→)"
              >
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Subtext Content */}
      <div className="subtext-card-view">
        {/* Title Header */}
        <div className="subtext-header-box">
          <span className="subtext-kicker">Topic / Anchor</span>
          <h2 className="subtext-title-text">{subtext.title}</h2>
        </div>

        {/* Observable Surface: Original Text Quote Container */}
        <div className="subtext-quote-box">
          <div className="subtext-quote-header">
            <Quote size={14} className="subtext-quote-icon" />
            <span className="subtext-quote-label">Original Text / Excerpt:</span>
          </div>
          <div className="subtext-quote-body">
            {subtext.original_text}
          </div>
        </div>

        {/* Tags Row */}
        {subtext.tags && subtext.tags.length > 0 && (
          <div className="subtext-tags-row">
            {subtext.tags.map((tag) => (
              <span key={tag} className="tag-pill">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Reveal Action Bar */}
        <div className="note-reveal-action-bar">
          <button
            type="button"
            className={`note-reveal-btn ${showSubtext ? "revealed" : ""}`}
            onClick={() => setShowSubtext(!showSubtext)}
          >
            {showSubtext ? <EyeOff size={16} /> : <Sparkles size={16} />}
            <span>{showSubtext ? "Hide Subtext" : "Reveal Subtext & Meaning"}</span>
          </button>
        </div>

        {/* Revealed Subtext Section */}
        {showSubtext && (
          <div className="subtext-answer-section">
            <div className="section-label">Subtext / Meaning & Nuance:</div>
            <div className="subtext-content-text">{subtext.subtext}</div>
          </div>
        )}
      </div>

      {/* Feedback Section: Rolling Cadence Triage Buttons */}
      <div className="feedback-section">
        <div className="feedback-prompt">
          {reviewedMessage ? (
            <span className="reviewed-confirmation-msg">{reviewedMessage}</span>
          ) : (
            "Select next review horizon:"
          )}
        </div>

        <div className="cadence-action-row">
          <button
            type="button"
            className="cadence-btn cadence-drill"
            onClick={() => handleRatingClick("drill_soon")}
            disabled={isBusy}
            title="Drill again today (rolling ~4 hours)"
          >
            🔥 Drill Soon
          </button>
          <button
            type="button"
            className="cadence-btn cadence-intra"
            onClick={() => handleRatingClick("intra_week")}
            disabled={isBusy}
            title="Consolidate mid-week (rolling 2–3 days)"
          >
            ⚡ Intra-Week
          </button>
          <button
            type="button"
            className="cadence-btn cadence-weekly"
            onClick={() => handleRatingClick("weekly")}
            disabled={isBusy}
            title="Standard weekly maintenance (rolling 7 days)"
          >
            📅 Weekly
          </button>
          <button
            type="button"
            className="cadence-btn cadence-park"
            onClick={() => handleRatingClick("skip_park")}
            disabled={isBusy}
            title="Park / Mastered (rolling 21 days)"
          >
            🏖️ Park
          </button>
        </div>
      </div>
    </div>
  );
};
