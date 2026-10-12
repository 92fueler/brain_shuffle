import React, { useState, useEffect } from "react";
import type { Category, Problem, CompanyStat, ReviewAction, ReviewList } from "../types";
import { fetchShuffleBatch, submitReview, deleteReviewList } from "../api";
import { ProblemFlashcard } from "./ProblemFlashcard";
import {
  Shuffle,
  RotateCw,
  AlertCircle,
  Building2,
  Layers,
  ArrowLeft,
  Code,
  Cpu,
  Search,
  Trash2,
} from "lucide-react";

interface ActiveDeckConfig {
  title: string;
  subtitle?: string;
  company?: string | null;
  categoryId?: string | null;
  reviewListId?: string | null;
  totalCount?: number;
}

type ChannelTab = "company-all" | "coding-only" | "sysdesign-only" | "custom-decks";

interface ShuffleViewProps {
  categories: Category[];
  companies: CompanyStat[];
  reviewLists?: ReviewList[];
  activeReviewList: {
    id: string;
    name: string;
    company?: string | null;
    problem_count?: number;
  } | null;
  onClearReviewList: () => void;
  onRefreshReviewLists?: () => void;
}

export const ShuffleView: React.FC<ShuffleViewProps> = ({
  categories,
  companies,
  reviewLists = [],
  activeReviewList,
  onClearReviewList,
  onRefreshReviewLists,
}) => {
  const [activeDeck, setActiveDeck] = useState<ActiveDeckConfig | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelTab>("company-all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [problems, setProblems] = useState<Problem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<"cadence" | "pure_random">("cadence");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [recentTestedIds, setRecentTestedIds] = useState<string[]>([]);

  // Category helpers
  const codingCat = categories.find((c) => c.slug === "coding");
  const sysDesignCat = categories.find((c) => c.slug === "system_design" || c.slug === "system-design");

  const loadDeckBatch = async (
    config?: ActiveDeckConfig | null,
    overrideMode?: "cadence" | "pure_random"
  ) => {
    const target = config !== undefined ? config : activeDeck;
    if (!target) return;

    const effectiveMode = overrideMode || mode;
    setLoading(true);
    try {
      const batch = await fetchShuffleBatch({
        categoryId: target.categoryId || undefined,
        company: target.company || undefined,
        reviewListId: target.reviewListId || undefined,
        limit: target.reviewListId || target.company ? 50 : 5,
        mode: effectiveMode,
        excludeIds: target.reviewListId || target.company ? [] : recentTestedIds.slice(-3),
      });
      setProblems(batch);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Failed to load deck batch", err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: "cadence" | "pure_random") => {
    if (newMode === mode) return;
    setMode(newMode);
    loadDeckBatch(activeDeck, newMode);
  };

  // Sync when parent requests testing a custom review deck (e.g. from Curate tab)
  useEffect(() => {
    if (activeReviewList) {
      const config: ActiveDeckConfig = {
        title: activeReviewList.name,
        subtitle: activeReviewList.company ? `Company: ${activeReviewList.company}` : "Custom Curated Deck",
        reviewListId: activeReviewList.id,
        company: activeReviewList.company,
        totalCount: activeReviewList.problem_count,
      };
      setActiveDeck(config);
      loadDeckBatch(config);
    }
  }, [activeReviewList]);

  // Keyboard navigation (ArrowLeft / ArrowRight) when not focused on an input, textarea, or CodeMirror editor
  useEffect(() => {
    if (!activeDeck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.closest(".cm-editor") !== null)
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
      } else if (e.key === "ArrowRight" && currentIndex < problems.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDeck, currentIndex, problems.length]);

  const handleLaunchDeck = (config: ActiveDeckConfig) => {
    setActiveDeck(config);
    setCompletedCount(0);
    loadDeckBatch(config);
  };

  const handleExitDeck = () => {
    setActiveDeck(null);
    onClearReviewList();
    setProblems([]);
    setCurrentIndex(0);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < problems.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRating = async (rating: ReviewAction) => {
    const currentProblem = problems[currentIndex];
    if (!currentProblem || submitting) return;

    setSubmitting(true);
    try {
      await submitReview(currentProblem.id, { rating });
      setCompletedCount((c) => c + 1);
      setRecentTestedIds((prev) => [...prev.slice(-5), currentProblem.id]);

      if (currentIndex + 1 < problems.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        await loadDeckBatch();
      }
    } catch (err) {
      console.error("Failed to submit review", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomDeck = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete deck "${name}"?`)) return;
    try {
      await deleteReviewList(id);
      if (onRefreshReviewLists) {
        onRefreshReviewLists();
      }
    } catch (err) {
      console.error("Failed to delete review deck", err);
    }
  };

  const currentProblem = problems[currentIndex];

  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : "Problem";
  };

  // Filtered company lists
  const query = searchQuery.trim().toLowerCase();

  const companiesAll = companies.filter(
    (c) => c.problem_count > 0 && (!query || c.name.toLowerCase().includes(query))
  );
  const companiesCoding = companies.filter(
    (c) => c.coding_count > 0 && (!query || c.name.toLowerCase().includes(query))
  );
  const companiesSysDesign = companies.filter(
    (c) => c.system_design_count > 0 && (!query || c.name.toLowerCase().includes(query))
  );
  const filteredReviewLists = reviewLists.filter(
    (rl) => !query || rl.name.toLowerCase().includes(query) || (rl.company && rl.company.toLowerCase().includes(query))
  );

  // -------------------------------------------------------------
  // RENDER: DECKS HUB (STATE A: DEFAULT ENTRY POINT)
  // -------------------------------------------------------------
  if (!activeDeck) {
    return (
      <div className="decks-hub-container">
        {/* Hub Banner & Universal Quick Action */}
        <div className="decks-hub-banner">
          <div className="hub-banner-content">
            <div className="hub-badge">
              <span>🎯</span> Study Decks Hub
            </div>
            <h2 className="hub-title">Review Decks</h2>
            <p className="hub-desc">
              Select a target company loop, focus specifically on Coding or System Design, or run a custom saved deck.
            </p>
          </div>

          <div className="hub-banner-actions">
            <button
              type="button"
              className="primary-action-btn quick-shuffle-btn"
              onClick={() =>
                handleLaunchDeck({
                  title: "Quick Mix Shuffle",
                  subtitle: "Random cross-topic problem drill",
                  totalCount: 5,
                })
              }
            >
              <Shuffle size={16} /> Quick Mix Shuffle (5)
            </button>
          </div>
        </div>

        {/* Channel Navigation Bar & Search */}
        <div className="hub-controls-bar">
          <div className="hub-channel-tabs">
            <button
              type="button"
              className={`hub-tab-btn ${activeChannel === "company-all" ? "active" : ""}`}
              onClick={() => setActiveChannel("company-all")}
            >
              <Building2 size={16} /> Full Company Loops
              <span className="hub-tab-count">{companies.filter((c) => c.problem_count > 0).length}</span>
            </button>

            <button
              type="button"
              className={`hub-tab-btn ${activeChannel === "coding-only" ? "active" : ""}`}
              onClick={() => setActiveChannel("coding-only")}
            >
              <Code size={16} /> Coding by Company
              <span className="hub-tab-count">{companies.filter((c) => c.coding_count > 0).length}</span>
            </button>

            <button
              type="button"
              className={`hub-tab-btn ${activeChannel === "sysdesign-only" ? "active" : ""}`}
              onClick={() => setActiveChannel("sysdesign-only")}
            >
              <Cpu size={16} /> System Design by Company
              <span className="hub-tab-count">{companies.filter((c) => c.system_design_count > 0).length}</span>
            </button>

            <button
              type="button"
              className={`hub-tab-btn ${activeChannel === "custom-decks" ? "active" : ""}`}
              onClick={() => setActiveChannel("custom-decks")}
            >
              <Layers size={16} /> Custom Saved Decks
              <span className="hub-tab-count">{reviewLists.length}</span>
            </button>
          </div>

          <div className="hub-search-box">
            <Search size={15} className="hub-search-icon" />
            <input
              type="text"
              placeholder="Search companies or decks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="hub-search-input"
            />
          </div>
        </div>

        {/* CHANNEL 1: FULL COMPANY LOOPS (CODING + SYSTEM DESIGN COMBINED) */}
        {activeChannel === "company-all" && (
          <div className="deck-grid">
            {companiesAll.length === 0 ? (
              <div className="empty-deck-notice">No companies match your search.</div>
            ) : (
              companiesAll.map((comp) => {
                const hasBoth = comp.coding_count > 0 && comp.system_design_count > 0;
                return (
                  <div key={comp.name} className="deck-card">
                    <div className="deck-card-body">
                      <div className="deck-card-top">
                        <span className="company-badge">🏢 {comp.name}</span>
                        <span className="deck-problem-count">{comp.problem_count} Questions</span>
                      </div>

                      <div className="deck-domain-breakdown">
                        {comp.coding_count > 0 && (
                          <span className="mini-domain-tag coding-tag">{comp.coding_count} Coding</span>
                        )}
                        {comp.system_design_count > 0 && (
                          <span className="mini-domain-tag design-tag">{comp.system_design_count} System Design</span>
                        )}
                      </div>
                    </div>

                    <div className="deck-card-actions">
                      <button
                        type="button"
                        className="deck-launch-btn"
                        onClick={() =>
                          handleLaunchDeck({
                            title: `${comp.name} Full Loop`,
                            subtitle: "Combined Coding & System Design questions",
                            company: comp.name,
                            totalCount: comp.problem_count,
                          })
                        }
                      >
                        {hasBoth ? `Test Loop (${comp.problem_count}) →` : `Start Review (${comp.problem_count}) →`}
                      </button>

                      {hasBoth && comp.coding_count > 0 && (
                        <button
                          type="button"
                          className="track-pill-btn"
                          onClick={() =>
                            handleLaunchDeck({
                              title: `${comp.name} Coding`,
                              subtitle: "Algorithms & data structures only",
                              company: comp.name,
                              categoryId: codingCat?.id,
                              totalCount: comp.coding_count,
                            })
                          }
                          title="Coding only"
                        >
                          <Code size={13} /> {comp.coding_count}
                        </button>
                      )}

                      {hasBoth && comp.system_design_count > 0 && (
                        <button
                          type="button"
                          className="track-pill-btn"
                          onClick={() =>
                            handleLaunchDeck({
                              title: `${comp.name} System Design`,
                              subtitle: "Architecture & distributed systems only",
                              company: comp.name,
                              categoryId: sysDesignCat?.id,
                              totalCount: comp.system_design_count,
                            })
                          }
                          title="System Design only"
                        >
                          <Cpu size={13} /> {comp.system_design_count}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* CHANNEL 2: CODING BY COMPANY */}
        {activeChannel === "coding-only" && (
          <div className="deck-grid">
            {companiesCoding.length === 0 ? (
              <div className="empty-deck-notice">No coding company decks found.</div>
            ) : (
              companiesCoding.map((comp) => (
                <div key={comp.name} className="deck-card">
                  <div className="deck-card-body">
                    <div className="deck-card-top">
                      <span className="company-badge">🏢 {comp.name}</span>
                      <span className="mini-domain-tag coding-tag">{comp.coding_count} Problems</span>
                    </div>
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="deck-launch-btn"
                      onClick={() =>
                        handleLaunchDeck({
                          title: `${comp.name} Coding Track`,
                          subtitle: "Targeted algorithm questions",
                          company: comp.name,
                          categoryId: codingCat?.id,
                          totalCount: comp.coding_count,
                        })
                      }
                    >
                      Start Coding ({comp.coding_count}) →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CHANNEL 3: SYSTEM DESIGN BY COMPANY */}
        {activeChannel === "sysdesign-only" && (
          <div className="deck-grid">
            {companiesSysDesign.length === 0 ? (
              <div className="empty-deck-notice">No system design company decks found.</div>
            ) : (
              companiesSysDesign.map((comp) => (
                <div key={comp.name} className="deck-card">
                  <div className="deck-card-body">
                    <div className="deck-card-top">
                      <span className="company-badge">🏢 {comp.name}</span>
                      <span className="mini-domain-tag design-tag">{comp.system_design_count} Problems</span>
                    </div>
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="deck-launch-btn"
                      onClick={() =>
                        handleLaunchDeck({
                          title: `${comp.name} System Design Track`,
                          subtitle: "Architecture and distributed systems",
                          company: comp.name,
                          categoryId: sysDesignCat?.id,
                          totalCount: comp.system_design_count,
                        })
                      }
                    >
                      Start System Design ({comp.system_design_count}) →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CHANNEL 4: CUSTOM SAVED DECKS */}
        {activeChannel === "custom-decks" && (
          <div className="deck-grid">
            {filteredReviewLists.length === 0 ? (
              <div className="empty-deck-notice">
                <p>No custom saved decks created yet.</p>
                <span className="empty-deck-subtext">
                  Create targeted custom lists anytime by selecting problems in the <strong>Problems</strong> tab.
                </span>
              </div>
            ) : (
              filteredReviewLists.map((rl) => (
                <div key={rl.id} className="deck-card custom-deck-highlight">
                  <div className="deck-card-body">
                    <div className="deck-card-top">
                      <div className="custom-deck-meta-left">
                        <span className="badge stats-badge">📦 Custom Deck</span>
                        {rl.company && <span className="company-badge">🏢 {rl.company}</span>}
                      </div>
                      <span className="deck-problem-count">{rl.problem_count} Problems</span>
                    </div>

                    <h3 className="deck-card-title">{rl.name}</h3>
                    {rl.description && <p className="deck-card-desc">{rl.description}</p>}
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="deck-launch-btn"
                      onClick={() =>
                        handleLaunchDeck({
                          title: rl.name,
                          subtitle: rl.company ? `Company: ${rl.company}` : "Custom Curated Deck",
                          reviewListId: rl.id,
                          company: rl.company,
                          totalCount: rl.problem_count,
                        })
                      }
                    >
                      Test Deck ({rl.problem_count}) →
                    </button>

                    <button
                      type="button"
                      className="icon-delete-deck-btn"
                      onClick={(e) => handleDeleteCustomDeck(rl.id, rl.name, e)}
                      title="Delete saved deck"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: ACTIVE TEST ROOM (STATE B: ACTIVE DECK TESTING)
  // -------------------------------------------------------------
  return (
    <div className="shuffle-container">
      {/* Streamlined Session Breadcrumb Header */}
      <div className="shuffle-header active-session-breadcrumb-bar">
        <div className="session-breadcrumb-left">
          <button
            type="button"
            className="breadcrumb-back-btn"
            onClick={handleExitDeck}
            title="Return to Decks Hub"
          >
            <ArrowLeft size={13} />
            <span>Decks</span>
          </button>

          <span className="breadcrumb-divider">/</span>

          <span className="breadcrumb-deck-title" title={activeDeck.title}>
            {activeDeck.title}
          </span>

          {completedCount > 0 && (
            <span className="session-reviewed-badge" title="Problems reviewed in this session">
              ✓ {completedCount}
            </span>
          )}
        </div>

        <div className="session-breadcrumb-right">
          <div className="compact-mode-toggle">
            <button
              type="button"
              className={`compact-mode-btn ${mode === "cadence" ? "active" : ""}`}
              onClick={() => handleModeChange("cadence")}
              title="Prioritize unreviewed and recently failed problems"
            >
              Priority
            </button>
            <button
              type="button"
              className={`compact-mode-btn ${mode === "pure_random" ? "active" : ""}`}
              onClick={() => handleModeChange("pure_random")}
              title="Uniform random sampling"
            >
              Random
            </button>
          </div>

          <button
            type="button"
            className="compact-reshuffle-btn"
            onClick={() => loadDeckBatch()}
            disabled={loading}
            title="Reshuffle problems in this deck"
          >
            <RotateCw size={12} className={loading ? "spin" : ""} />
            <span>Reshuffle</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card loading-card">
          <p>Loading problems for {activeDeck.title}...</p>
        </div>
      ) : !currentProblem ? (
        <div className="card empty-card">
          <AlertCircle size={40} className="muted-icon" />
          <h3>No problems found in this deck</h3>
          <p>This deck has no problems assigned or matching filters.</p>
          <button
            type="button"
            className="primary-action-btn mt-3"
            onClick={handleExitDeck}
          >
            <ArrowLeft size={16} /> Return to Decks Hub
          </button>
        </div>
      ) : (
        <ProblemFlashcard
          key={currentProblem.id}
          problem={currentProblem}
          categoryName={getCategoryName(currentProblem.category_id)}
          counterText={`Card ${currentIndex + 1} of ${problems.length}`}
          onRating={handleRating}
          submitting={submitting}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < problems.length - 1}
        />
      )}
    </div>
  );
};
