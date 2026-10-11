import React, { useState } from "react";
import type { Category, Problem, ProblemCreatePayload } from "../types";
import { createProblem, updateProblem, deleteProblem, createCategory } from "../api";
import { Plus, Search, Trash2, FolderPlus, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { ProblemFlashcard } from "./ProblemFlashcard";

interface ProblemManagerProps {
  categories: Category[];
  problems: Problem[];
  onRefresh: () => void;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}

export const ProblemManager: React.FC<ProblemManagerProps> = ({
  categories,
  problems,
  onRefresh,
  selectedCategory,
  onSelectCategory,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form State (New Problem)
  const [formCatId, setFormCatId] = useState(categories[0]?.id || "");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [companiesStr, setCompaniesStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Form State
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [editCatId, setEditCatId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTagsStr, setEditTagsStr] = useState("");
  const [editCompaniesStr, setEditCompaniesStr] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Category Form State
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const createIndentKeyDownHandler =
    (setter: (val: string) => void) =>
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
            setter(nextVal);
            requestAnimationFrame(() => {
              textarea.selectionStart = newStart;
              textarea.selectionEnd = newEnd;
            });
          } else if (currentLine.startsWith(" ")) {
            const spaces = currentLine.match(/^ +/)?.[0].length || 1;
            const remove = Math.min(spaces, 4);
            const nextVal = currentVal.slice(0, lineStart) + currentVal.slice(lineStart + remove);
            setter(nextVal);
            requestAnimationFrame(() => {
              textarea.selectionStart = Math.max(lineStart, selectionStart - remove);
              textarea.selectionEnd = Math.max(lineStart, selectionEnd - remove);
            });
          }
        } else {
          // Tab: Insert 4 spaces
          const nextVal = currentVal.slice(0, selectionStart) + "    " + currentVal.slice(selectionEnd);
          setter(nextVal);
          requestAnimationFrame(() => {
            textarea.selectionStart = selectionStart + 4;
            textarea.selectionEnd = selectionStart + 4;
          });
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

        const cleanLine = lineText.replace(/#.*$/, "").trimEnd();
        if (cleanLine.endsWith(":")) {
          indent += "    ";
        }

        const nextVal = currentVal.slice(0, selectionStart) + "\n" + indent + currentVal.slice(selectionEnd);
        const newPos = selectionStart + 1 + indent.length;
        setter(nextVal);
        requestAnimationFrame(() => {
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
        });
        return;
      }
    };

  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !prompt || !notes || !formCatId) return;

    setIsSubmitting(true);
    try {
      // Tags are preserved strictly the way the user inputs
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // Companies: capitalize first letter of each word (e.g. amazon -> Amazon, two sigma -> Two Sigma)
      const companies = Array.from(
        new Set(
          companiesStr
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) =>
              c
                .split(/\s+/)
                .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
                .join(" ")
            )
        )
      );

      const payload: ProblemCreatePayload = {
        category_id: formCatId,
        title,
        prompt,
        notes,
        tags,
        companies,
      };

      await createProblem(payload);
      setTitle("");
      setPrompt("");
      setNotes("");
      setTagsStr("");
      setCompaniesStr("");
      setShowAddModal(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to create problem", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProblem(problem);
    setEditCatId(problem.category_id);
    setEditTitle(problem.title);
    setEditPrompt(problem.prompt);
    setEditNotes(problem.notes);
    setEditTagsStr((problem.tags || []).join(", "));
    setEditCompaniesStr((problem.companies || []).join(", "));
    setShowEditModal(true);
  };

  const handleUpdateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProblem || !editTitle || !editPrompt || !editNotes || !editCatId) return;

    setIsUpdating(true);
    try {
      const tags = editTagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const companies = Array.from(
        new Set(
          editCompaniesStr
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) =>
              c
                .split(/\s+/)
                .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
                .join(" ")
            )
        )
      );

      await updateProblem(editingProblem.id, {
        category_id: editCatId,
        title: editTitle,
        prompt: editPrompt,
        notes: editNotes,
        tags,
        companies,
      });

      setShowEditModal(false);
      setEditingProblem(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to update problem", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatSlug || !newCatName) return;

    try {
      const created = await createCategory(newCatSlug, newCatName, newCatDesc);
      setNewCatSlug("");
      setNewCatName("");
      setNewCatDesc("");
      setShowCatModal(false);
      onRefresh();
      setFormCatId(created.id);
    } catch (err) {
      console.error("Failed to create category", err);
    }
  };

  const handleDelete = async (problemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this problem?")) return;
    try {
      await deleteProblem(problemId);
      if (expandedId === problemId) setExpandedId(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete problem", err);
    }
  };

  const getCategoryName = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.name : "Problem";
  };

  const filteredProblems = problems.filter((p) => {
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    const matchesCompany =
      !selectedCompanyFilter ||
      (p.companies && p.companies.some((c) => c.toLowerCase() === selectedCompanyFilter.toLowerCase()));
    const s = search.toLowerCase();
    const matchesSearch =
      !search ||
      p.title.toLowerCase().includes(s) ||
      p.prompt.toLowerCase().includes(s) ||
      p.tags.some((tag) => tag.toLowerCase().includes(s)) ||
      (p.companies && p.companies.some((c) => c.toLowerCase().includes(s)));
    return matchesCategory && matchesCompany && matchesSearch;
  });

  return (
    <div className="problem-manager">
      {/* Controls & Filter Toolbar */}
      <div className="manager-toolbar">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search problem titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <select
            value={selectedCompanyFilter || ""}
            onChange={(e) => setSelectedCompanyFilter(e.target.value || null)}
          >
            <option value="">All Companies</option>
            {Array.from(new Set(problems.flatMap((p) => p.companies || [])))
              .sort()
              .map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        </div>

        <div className="action-buttons">
          <button className="secondary-action-btn" onClick={() => setShowCatModal(true)}>
            <FolderPlus size={16} /> New Category
          </button>
          <button className="primary-action-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Problem
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="category-filter-chips">
        <button
          className={`chip ${!selectedCategory ? "active" : ""}`}
          onClick={() => onSelectCategory(null)}
        >
          All Categories ({problems.length})
        </button>
        {categories.map((c) => {
          const count = problems.filter((p) => p.category_id === c.id).length;
          return (
            <button
              key={c.id}
              className={`chip ${selectedCategory === c.id ? "active" : ""}`}
              onClick={() => onSelectCategory(c.id)}
            >
              {c.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Problem Titles List - Minimalist, Uncluttered */}
      <div className="problem-list">
        {filteredProblems.length === 0 ? (
          <div className="empty-state">No matching problems found.</div>
        ) : (
          filteredProblems.map((problem) => {
            const isExpanded = expandedId === problem.id;
            return (
              <div
                key={problem.id}
                className={`problem-item ${isExpanded ? "expanded" : ""}`}
                onClick={() => setExpandedId(isExpanded ? null : problem.id)}
              >
                {/* Collapsed Row: Problem Title Only with Category Tag and Expand/Delete */}
                <div className="problem-row-header">
                  <div className="problem-title-wrapper">
                    <span className="problem-category-pill">{getCategoryName(problem.category_id)}</span>
                    <h3 className="problem-title-text">{problem.title}</h3>
                  </div>
                  <div className="problem-row-actions">
                    <button
                      className="icon-edit-btn"
                      onClick={(e) => handleOpenEditModal(problem, e)}
                      title="Edit problem"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-delete-btn"
                      onClick={(e) => handleDelete(problem.id, e)}
                      title="Delete problem"
                    >
                      <Trash2 size={16} />
                    </button>
                    <span className="expand-indicator">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                </div>

                {/* Expanded: Embedded Flashcard for Active Recall Testing */}
                {isExpanded && (
                  <div className="problem-expanded-details" onClick={(e) => e.stopPropagation()}>
                    <ProblemFlashcard
                      problem={problem}
                      categoryName={getCategoryName(problem.category_id)}
                      onReviewRecorded={onRefresh}
                    />
                    <div className="expanded-footer-meta">
                      <div className="meta-group">
                        <span className="meta-label">Companies:</span>
                        <div className="meta-pills">
                          {problem.companies && problem.companies.length > 0 ? (
                            problem.companies.map((c, i) => (
                              <span key={i} className="mini-company-pill">
                                🏢 {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic text-xs">None listed</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="edit-details-btn"
                        onClick={(e) => handleOpenEditModal(problem, e)}
                        title="Edit problem details"
                      >
                        <Pencil size={13} /> Edit Problem
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Problem Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Problem</h2>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowAddModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProblem}>
              <div className="form-row">
                <div className="form-group">
                  <label>Category:</label>
                  <select
                    value={formCatId}
                    onChange={(e) => setFormCatId(e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Problem Title:</label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Programming: 0/1 Knapsack"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Associated Companies (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="e.g. Google, Meta, Amazon"
                    value={companiesStr}
                    onChange={(e) => setCompaniesStr(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Tags / Subtopics (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="e.g. dp, knapsack, optimization"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hints (Problem Prompt & Constraints):</label>
                <textarea
                  className="prompt-editor-textarea"
                  rows={4}
                  placeholder="The question and constraints you challenge yourself to recall when looking at the problem title... (Tab supported)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={createIndentKeyDownHandler(setPrompt)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes (Solution & Implementation):</label>
                <textarea
                  className="notes-editor-textarea"
                  rows={12}
                  placeholder="The key insights, formula, recurrence relation, or Python implementation... (Tab supported)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={createIndentKeyDownHandler(setNotes)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-btn"
                  disabled={isSubmitting}
                >
                  Save Problem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Problem Modal */}
      {showEditModal && editingProblem && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Problem</h2>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowEditModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateProblem}>
              <div className="form-row">
                <div className="form-group">
                  <label>Category:</label>
                  <select
                    value={editCatId}
                    onChange={(e) => setEditCatId(e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Problem Title:</label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Programming: 0/1 Knapsack"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Associated Companies (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="e.g. Google, Meta, Amazon"
                    value={editCompaniesStr}
                    onChange={(e) => setEditCompaniesStr(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Tags / Subtopics (comma-separated):</label>
                  <input
                    type="text"
                    placeholder="e.g. dp, knapsack, optimization"
                    value={editTagsStr}
                    onChange={(e) => setEditTagsStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hints (Problem Prompt & Constraints):</label>
                <textarea
                  className="prompt-editor-textarea"
                  rows={4}
                  placeholder="The question and constraints... (Tab supported)"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={createIndentKeyDownHandler(setEditPrompt)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes (Solution & Implementation):</label>
                <textarea
                  className="notes-editor-textarea"
                  rows={12}
                  placeholder="The key insights, formula, recurrence relation, or Python implementation... (Tab supported)"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onKeyDown={createIndentKeyDownHandler(setEditNotes)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-btn"
                  disabled={isUpdating}
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>New Category</h2>
            <form onSubmit={handleCreateCat}>
              <div className="form-group">
                <label>Slug (URL key):</label>
                <input
                  type="text"
                  placeholder="e.g. networking"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category Display Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Networking & Infra"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description (Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. TCP, UDP, load balancers, DNS"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setShowCatModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn">
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
