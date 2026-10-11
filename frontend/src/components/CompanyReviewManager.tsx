import React, { useState, useEffect } from "react";
import type { CompanyStat, Problem, ReviewList, Category } from "../types";
import { fetchCompanies, fetchProblems, fetchReviewLists, createReviewList, deleteReviewList } from "../api";
import { Building2, ListPlus, Play, Trash2, CheckSquare, Square, Search, Layers } from "lucide-react";

interface CompanyReviewManagerProps {
  categories: Category[];
  onStartReviewListShuffle: (
    reviewListId: string,
    name: string,
    company?: string | null,
    problem_count?: number
  ) => void;
  onStartCompanyShuffle: (companyName: string) => void;
}

export const CompanyReviewManager: React.FC<CompanyReviewManagerProps> = ({
  categories,
  onStartReviewListShuffle,
  onStartCompanyShuffle,
}) => {
  const [companies, setCompanies] = useState<CompanyStat[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [reviewLists, setReviewLists] = useState<ReviewList[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState<string>("");

  // New Review List Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>("");
  const [newListDesc, setNewListDesc] = useState<string>("");

  const refreshData = async () => {
    try {
      const [comps, lists] = await Promise.all([fetchCompanies(), fetchReviewLists()]);
      setCompanies(comps);
      setReviewLists(lists);
      if (!selectedCompany && comps.length > 0) {
        setSelectedCompany(comps[0].name);
      }
    } catch (err) {
      console.error("Failed to load company review data", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    const loadCompanyProblems = async () => {
      try {
        const data = await fetchProblems(undefined, selectedCompany || undefined);
        setProblems(data);
        setSelectedProblemIds(new Set()); // Reset selection when company changes
      } catch (err) {
        console.error("Failed to load company problems", err);
      }
    };
    if (selectedCompany) {
      loadCompanyProblems();
    }
  }, [selectedCompany]);

  const toggleProblemSelection = (id: string) => {
    setSelectedProblemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllProblems = () => {
    if (selectedProblemIds.size === filteredProblems.length) {
      setSelectedProblemIds(new Set());
    } else {
      setSelectedProblemIds(new Set(filteredProblems.map((p) => p.id)));
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || selectedProblemIds.size === 0) return;

    try {
      await createReviewList({
        name: newListName.trim(),
        company: selectedCompany || undefined,
        description: newListDesc.trim() || undefined,
        problem_ids: Array.from(selectedProblemIds),
      });
      setNewListName("");
      setNewListDesc("");
      setShowCreateModal(false);
      setSelectedProblemIds(new Set());
      await refreshData();
    } catch (err) {
      console.error("Failed to create review list", err);
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this persistent review list?")) return;
    try {
      await deleteReviewList(listId);
      await refreshData();
    } catch (err) {
      console.error("Failed to delete review list", err);
    }
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : "Problem";
  };

  const getCategorySlug = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.slug : "";
  };

  const filteredProblems = problems.filter((p) => {
    const s = search.toLowerCase();
    return (
      !search ||
      p.title.toLowerCase().includes(s) ||
      p.prompt.toLowerCase().includes(s) ||
      p.tags.some((tag) => tag.toLowerCase().includes(s))
    );
  });

  return (
    <div className="company-review-container">
      {/* Top Banner: Persistent Review Lists */}
      <div className="persistent-lists-section">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-indigo-400" />
            <h2>Saved Review Lists ({reviewLists.length})</h2>
          </div>
          <span className="text-xs text-slate-400">Custom in-flight lists created anytime & persisted to database</span>
        </div>

        {reviewLists.length === 0 ? (
          <div className="empty-lists-box">
            <p>No custom review lists created yet. Select problem titles below and click "Save Selected to Review List" to persist a targeted deck.</p>
          </div>
        ) : (
          <div className="lists-grid">
            {reviewLists.map((rl) => (
              <div key={rl.id} className="review-list-card">
                <div className="list-card-header">
                  <span className="list-name">{rl.name}</span>
                  {rl.company && <span className="company-badge">🏢 {rl.company}</span>}
                </div>
                {rl.description && <p className="list-desc">{rl.description}</p>}
                <div className="list-card-footer">
                  <span className="problem-counter">{rl.problem_count} Problems</span>
                  <div className="list-actions">
                    <button
                      className="launch-shuffle-btn"
                      onClick={() => onStartReviewListShuffle(rl.id, rl.name, rl.company, rl.problem_count)}
                      title="Shuffle and test this list"
                    >
                      <Play size={14} /> Test Deck
                    </button>
                    <button
                      className="delete-list-btn"
                      onClick={() => handleDeleteList(rl.id)}
                      title="Delete review list"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Company Access Pattern View */}
      <div className="company-access-main">
        {/* Company Selector Sidebar/Chips */}
        <div className="company-chips-bar">
          <span className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
            <Building2 size={16} /> Target Companies:
          </span>
          <div className="chips-wrapper">
            {companies.map((c) => (
              <button
                key={c.name}
                className={`company-chip ${selectedCompany === c.name ? "active" : ""}`}
                onClick={() => setSelectedCompany(c.name)}
              >
                <span className="company-name">{c.name}</span>
                <span className="company-count">{c.problem_count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Company Action Bar */}
        {selectedCompany && (
          <div className="company-toolbar">
            <div className="company-summary">
              <h3>{selectedCompany} Problem Bank</h3>
              <p className="summary-details">
                {problems.length} total questions ({problems.filter((p) => getCategorySlug(p.category_id) === "coding").length} Coding,{" "}
                {problems.filter((p) => getCategorySlug(p.category_id).includes("system_design")).length} System Design)
              </p>
            </div>

            <div className="toolbar-controls">
              <button
                className="secondary-action-btn"
                onClick={() => onStartCompanyShuffle(selectedCompany)}
                title="Shuffle all questions for this company"
              >
                <Play size={16} /> Shuffle All ({selectedCompany})
              </button>
              <button
                className="primary-action-btn"
                onClick={() => setShowCreateModal(true)}
                disabled={selectedProblemIds.size === 0}
              >
                <ListPlus size={16} /> Save Selected ({selectedProblemIds.size}) to Review List
              </button>
            </div>
          </div>
        )}

        {/* Search & Bulk Select */}
        <div className="table-controls">
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder={`Search ${selectedCompany || ""} problem titles...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="select-all-btn" onClick={selectAllProblems}>
            {selectedProblemIds.size === filteredProblems.length && filteredProblems.length > 0 ? (
              <>
                <CheckSquare size={16} /> Deselect All
              </>
            ) : (
              <>
                <Square size={16} /> Select All ({filteredProblems.length})
              </>
            )}
          </button>
        </div>

        {/* Clean Problem Titles List */}
        <div className="company-problems-list">
          {filteredProblems.length === 0 ? (
            <div className="empty-state">No problems found for this company search.</div>
          ) : (
            filteredProblems.map((problem) => {
              const isSelected = selectedProblemIds.has(problem.id);
              const catName = getCategoryName(problem.category_id);
              return (
                <div
                  key={problem.id}
                  className={`company-problem-row ${isSelected ? "selected" : ""}`}
                  onClick={() => toggleProblemSelection(problem.id)}
                >
                  <div className="selection-checkbox">
                    {isSelected ? <CheckSquare size={18} className="text-indigo-400" /> : <Square size={18} className="text-slate-500" />}
                  </div>

                  <div className="problem-row-content">
                    <span className="problem-category-pill">{catName}</span>
                    <span className="problem-row-title">{problem.title}</span>
                  </div>

                  <div className="problem-row-stats">
                    <span className="review-stat">Tested {problem.review_count}x</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Save In-Flight Review List Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Save Review List</h2>
            <p className="text-xs text-slate-400 mb-4">
              Persist your custom selection of {selectedProblemIds.size} problems for targeted recall sessions.
            </p>

            <form onSubmit={handleCreateList}>
              <div className="form-group">
                <label>Review List Name:</label>
                <input
                  type="text"
                  placeholder={`e.g. ${selectedCompany || "Target"} Final Round Deck`}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. High-frequency questions and core design patterns"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn">
                  Persist Review List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
