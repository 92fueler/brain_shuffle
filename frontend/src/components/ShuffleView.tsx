import React, { useState, useEffect } from "react";
import type { Category, Problem, CompanyStat, ReviewAction, ReviewList } from "../types";
import { fetchShuffleBatch, submitReview } from "../api";
import { ProblemFlashcard } from "./ProblemFlashcard";
import {
  Shuffle,
  RotateCw,
  Sparkles,
  AlertCircle,
  Building2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Code,
  Cpu,
  Search,
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
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  activeCompanyFilter: string | null;
  onSelectCompany: (company: string | null) => void;
  activeReviewList: {
    id: string;
    name: string;
    company?: string | null;
    problem_count?: number;
  } | null;
  onClearReviewList: () => void;
}

export const ShuffleView: React.FC<ShuffleViewProps> = ({
  categories,
  companies,
  reviewLists = [],
  activeReviewList,
  onClearReviewList,
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

  // Sync when parent requests testing a custom review deck (e.g. from Company Lists tab)
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

  const loadDeckBatch = async (config?: ActiveDeckConfig | null) => {
    const target = config !== undefined ? config : activeDeck;
    if (!target) return;

    setLoading(true);
    try {
      const batch = await fetchShuffleBatch({
        categoryId: target.categoryId || undefined,
        company: target.company || undefined,
        reviewListId: target.reviewListId || undefined,
        limit: target.reviewListId || target.company ? 50 : 5,
        mode,
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

  // Keyboard navigation (ArrowLeft / ArrowRight) when not focused on an input or scratchpad textarea
  useEffect(() => {
    if (!activeDeck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
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
              companiesAll.map((comp) => (
                <div key={comp.name} className="deck-card">
                  <div className="deck-card-body">
                    <div className="deck-card-top">
                      <span className="company-badge">🏢 {comp.name}</span>
                      <span className="deck-problem-count">{comp.problem_count} Problems</span>
                    </div>

                    <h3 className="deck-card-title">{comp.name} Full Loop</h3>
                    <p className="deck-card-desc">Combined algorithms and system design problem set.</p>

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
                      className="primary-action-btn deck-launch-btn"
                      onClick={() =>
                        handleLaunchDeck({
                          title: `${comp.name} Full Loop`,
                          subtitle: "Combined Coding & System Design questions",
                          company: comp.name,
                          totalCount: comp.problem_count,
                        })
                      }
                    >
                      Test All ({comp.problem_count})
                    </button>

                    {comp.coding_count > 0 && (
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

                    {comp.system_design_count > 0 && (
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
              ))
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
                      <span className="badge category-badge">Coding Track</span>
                      <span className="deck-problem-count">{comp.coding_count} Problems</span>
                    </div>

                    <h3 className="deck-card-title">{comp.name} Coding</h3>
                    <p className="deck-card-desc">Algorithms, data structures, and implementation challenges.</p>
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="primary-action-btn deck-launch-btn"
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
                      Start Coding Shuffle ({comp.coding_count}) →
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
                      <span className="badge system-design-badge">System Design</span>
                      <span className="deck-problem-count">{comp.system_design_count} Problems</span>
                    </div>

                    <h3 className="deck-card-title">{comp.name} System Design</h3>
                    <p className="deck-card-desc">Scalability, caching, distributed storage, and trade-offs.</p>
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="primary-action-btn deck-launch-btn"
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
                      Start System Design Shuffle ({comp.system_design_count}) →
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
                  Create targeted custom lists in the <strong>Company Lists</strong> tab anytime.
                </span>
              </div>
            ) : (
              filteredReviewLists.map((rl) => (
                <div key={rl.id} className="deck-card custom-deck-highlight">
                  <div className="deck-card-body">
                    <div className="deck-card-top">
                      <span className="badge stats-badge">📦 Custom Saved Deck</span>
                      <span className="deck-problem-count">{rl.problem_count} Problems</span>
                    </div>

                    <div className="custom-deck-header-row">
                      <h3 className="deck-card-title">{rl.name}</h3>
                      {rl.company && <span className="company-badge">🏢 {rl.company}</span>}
                    </div>

                    {rl.description && <p className="deck-card-desc">{rl.description}</p>}
                  </div>

                  <div className="deck-card-actions">
                    <button
                      type="button"
                      className="primary-action-btn deck-launch-btn"
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
      {/* Dedicated Session Header with 'Back to Decks Hub' */}
      <div className="shuffle-header active-session-header">
        <div className="session-left-meta">
          <button
            type="button"
            className="secondary-action-btn back-to-decks-btn"
            onClick={handleExitDeck}
            title="Return to Decks Hub"
          >
            <ArrowLeft size={16} /> Back to Decks Hub
          </button>

          <div className="session-scope-info">
            <div className="session-scope-title-row">
              <span className="session-badge">Active Deck</span>
              <h2 className="session-deck-title">{activeDeck.title}</h2>
              {activeDeck.company && (
                <span className="company-badge">🏢 {activeDeck.company}</span>
              )}
            </div>
            {activeDeck.subtitle && (
              <span className="session-scope-desc">{activeDeck.subtitle}</span>
            )}
          </div>
        </div>

        <div className="session-right-actions">
          <div className="mode-toggle">
            <button
              type="button"
              className={`tab-btn ${mode === "cadence" ? "active" : ""}`}
              onClick={() => setMode("cadence")}
              title="Prioritize unreviewed and recently failed problems"
            >
              <Sparkles size={14} /> Priority
            </button>
            <button
              type="button"
              className={`tab-btn ${mode === "pure_random" ? "active" : ""}`}
              onClick={() => setMode("pure_random")}
              title="Uniform random sampling"
            >
              <Shuffle size={14} /> Random
            </button>
          </div>

          <button
            type="button"
            className="secondary-action-btn reshuffle-btn"
            onClick={() => loadDeckBatch()}
            disabled={loading}
            title="Reshuffle problems in this deck"
          >
            <RotateCw size={14} className={loading ? "spin" : ""} /> Reshuffle
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
        <>
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

          {/* Bottom Session Navigation Bar */}
          <div className="shuffle-nav-bar">
            <button
              type="button"
              className="secondary-action-btn shuffle-nav-btn"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              title="Previous problem (←)"
            >
              <ChevronLeft size={16} /> Previous Problem
            </button>

            <div className="shuffle-nav-status">
              <span>
                Card <strong>{currentIndex + 1}</strong> of <strong>{problems.length}</strong>
              </span>
              <span className="dot-separator">•</span>
              <span>{completedCount} reviewed this session</span>
            </div>

            <button
              type="button"
              className="secondary-action-btn shuffle-nav-btn"
              onClick={handleNext}
              disabled={currentIndex >= problems.length - 1}
              title="Next problem (→)"
            >
              Next Problem <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
