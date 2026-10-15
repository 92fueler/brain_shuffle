import React, { useState } from "react";
import type { Category, Problem, ProblemCreatePayload, Subtext } from "../types";
import { isProblemCategory, isSubtextCategory } from "../types";
import { formatCategoryName, getCategoryTheme } from "../categoryTheme";
import {
  createProblem,
  updateProblem,
  deleteProblem,
  createCategory,
  updateCategory,
  deleteCategory,
  createReviewList,
  createSubtext,
  updateSubtext,
  deleteSubtext,
} from "../api";
import {
  handleTextareaTabKey,
  handleTextareaBackspaceKey,
  handleTextareaEnterKey,
} from "../indentation";
import {
  Plus,
  Search,
  Trash2,
  FolderCog,
  ChevronDown,
  ChevronUp,
  Pencil,
  Layers,
  CheckSquare,
  Square,
  Check,
  X,
  AlertCircle,
  Maximize2,
  Minimize2,
  Star,
  Circle,
} from "lucide-react";
import { ProblemFlashcard } from "./ProblemFlashcard";
import { SubtextFlashcard } from "./SubtextFlashcard";
import { DualNotepad } from "./DualNotepad";

interface ProblemManagerProps {
  categories: Category[];
  problems: Problem[];
  subtexts?: Subtext[];
  onRefresh: () => Promise<void> | void;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onStartReviewListShuffle?: (
    reviewListId: string,
    name: string,
    company?: string | null,
    problem_count?: number
  ) => void;
}

type EntryMode = "subtext" | "note" | "problem";

const resolveFormMode = (slug?: string): EntryMode => {
  if (isSubtextCategory(slug)) return "subtext";
  if (isProblemCategory(slug)) return "problem";
  return "note";
};

const parseTags = (raw: string): string[] =>
  raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const parseCompanies = (raw: string): string[] =>
  Array.from(
    new Set(
      raw
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

export const ProblemManager: React.FC<ProblemManagerProps> = ({
  categories,
  problems,
  subtexts = [],
  onRefresh,
  selectedCategory,
  onSelectCategory,
  onStartReviewListShuffle,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showDifficultOnly, setShowDifficultOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddModalMaximized, setIsAddModalMaximized] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditModalMaximized, setIsEditModalMaximized] = useState(false);
  const [editingSubtext, setEditingSubtext] = useState<Subtext | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSubtextId, setExpandedSubtextId] = useState<string | null>(null);

  // Multi-select Deck Authoring State
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(new Set());
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckCompany, setNewDeckCompany] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);

  // Unified Mode State: "subtext" (language / dialogue) vs "note" (recall notes) vs "problem" (interview tracks)
  const [formMode, setFormMode] = useState<EntryMode>("note");
  const [editFormMode, setEditFormMode] = useState<EntryMode>("note");

  // Form State (New Entry)
  const [formCatId, setFormCatId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [subtextText, setSubtextText] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [companiesStr, setCompaniesStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Form State
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [editCatId, setEditCatId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editOriginalText, setEditOriginalText] = useState("");
  const [editSubtextText, setEditSubtextText] = useState("");
  const [editTagsStr, setEditTagsStr] = useState("");
  const [editCompaniesStr, setEditCompaniesStr] = useState("");
  const [editCadence, setEditCadence] = useState("weekly");
  const [isUpdating, setIsUpdating] = useState(false);

  // Category Form & Manager State
  const [newCatName, setNewCatName] = useState("");
  const [catError, setCatError] = useState<string | null>(null);
  const [isCatSubmitting, setIsCatSubmitting] = useState(false);

  // Category Edit State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [isCatUpdating, setIsCatUpdating] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const activeFormCatId = formCatId || selectedCategory || categories[0]?.id || "";

  const getCategorySlug = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? cat.slug : "";
  };

  const getSubtextPlaceholders = (slug?: string | null) => {
    const s = (slug || "").toLowerCase();
    if (s.includes("idiom")) {
      return {
        title: "e.g. Bite the bullet",
        original: "Paste the full paragraph or sentence where the idiom occurred...",
        subtext: "Literal origin vs. figurative meaning, nuances, and collocations...",
      };
    }
    if (s.includes("vocab")) {
      return {
        title: "e.g. Ephemeral (or 'Astute vs. Cunning')",
        original: "Paste the reading passage demonstrating authentic usage...",
        subtext: "Definition, register (formal/literary), and synonyms...",
      };
    }
    if (s.includes("cinema") || s.includes("movie")) {
      return {
        title: "e.g. Good Will Hunting (Bar Scene)",
        original: "Paste dialogue transcript, speaker quotes, or screenplay lines...",
        subtext: "The unspoken subtext, power dynamic, or comedic irony...",
      };
    }
    if (s.includes("conversation") || s.includes("dialogue")) {
      return {
        title: "e.g. Social Polite Decline / Negotiation",
        original: "Paste what was spoken verbatim...",
        subtext: "The underlying agenda, boundary, or political subtext...",
      };
    }
    return {
      title: "e.g. Headline, focal phrase, or topic anchor...",
      original: "Paste the verbatim paragraph, dialogue transcript, or example sentences...",
      subtext: "The underlying meaning, unstated intention, definition, or nuance matrix...",
    };
  };

  const resetAddForm = () => {
    setTitle("");
    setPrompt("");
    setNotes("");
    setOriginalText("");
    setSubtextText("");
    setTagsStr("");
    setCompaniesStr("");
  };

  const handleOpenAddModal = () => {
    let targetCatId = selectedCategory;
    if (!targetCatId) {
      const firstWorkCat = categories.find((c) => !isSubtextCategory(c.slug));
      targetCatId = firstWorkCat ? firstWorkCat.id : (categories.length > 0 ? categories[0].id : "");
    }
    setFormCatId(targetCatId);
    const cat = categories.find((c) => c.id === targetCatId);
    setFormMode(resolveFormMode(cat?.slug));
    resetAddForm();
    setShowAddModal(true);
  };

  const handleFormCatChange = (catId: string) => {
    setFormCatId(catId);
    const cat = categories.find((c) => c.id === catId);
    setFormMode(resolveFormMode(cat?.slug));
  };

  const createIndentKeyDownHandler =
    (setter: (val: string) => void) =>
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const update = (nextVal: string, newStart: number, newEnd: number) => {
        setter(nextVal);
        requestAnimationFrame(() => {
          textarea.selectionStart = newStart;
          textarea.selectionEnd = newEnd;
        });
      };

      if (handleTextareaTabKey(e, update)) return;
      if (handleTextareaBackspaceKey(e, update)) return;
      if (handleTextareaEnterKey(e, update, { enableColonBonus: true })) return;
    };

  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFormCatId) return;

    setIsSubmitting(true);
    try {
      if (formMode === "subtext") {
        if (!title.trim() || !originalText.trim() || !subtextText.trim()) return;
        const finalTags = parseTags(tagsStr);
        const created = await createSubtext({
          category_id: activeFormCatId,
          title: title.trim(),
          original_text: originalText.trim(),
          subtext: subtextText.trim(),
          tags: finalTags,
        });
        resetAddForm();
        setFormCatId(activeFormCatId);
        setShowAddModal(false);
        onSelectCategory(activeFormCatId);
        setSelectedCompanyFilter(null);
        setSearch("");
        setExpandedSubtextId(created.id);
        await onRefresh();
        return;
      }

      if (!prompt.trim() || !notes.trim()) return;
      if (formMode === "problem" && !title.trim()) return;

      let finalTitle = title.trim();
      let finalCompanies: string[] = [];
      let finalTags: string[] = [];

      if (formMode === "note") {
        finalTitle = prompt.trim();
        finalCompanies = [];
        finalTags = [];
      } else {
        finalTags = parseTags(tagsStr);
        finalCompanies = parseCompanies(companiesStr);
      }

      const payload: ProblemCreatePayload = {
        category_id: activeFormCatId,
        title: finalTitle,
        prompt: prompt.trim(),
        notes: notes.trim(),
        tags: finalTags,
        companies: finalCompanies,
      };

      const created = await createProblem(payload);
      resetAddForm();
      setFormCatId(activeFormCatId);
      setShowAddModal(false);

      // 1. Immediately switch the active category to the created problem/note's category
      onSelectCategory(activeFormCatId);

      // 2. Clear any active search and company filter so the created note is never hidden
      setSelectedCompanyFilter(null);
      setSearch("");

      // 3. Automatically expand the newly created item for immediate review
      setExpandedId(created.id);

      // 4. Await data refresh to guarantee state is synced immediately
      await onRefresh();
    } catch (err) {
      console.error("Failed to create entry", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProblem(problem);
    setEditingSubtext(null);
    setEditCatId(problem.category_id);
    setEditTitle(problem.title);
    setEditPrompt(problem.prompt);
    setEditNotes(problem.notes);
    setEditTagsStr((problem.tags || []).join(", "));
    setEditCompaniesStr((problem.companies || []).join(", "));
    setEditCadence(problem.cadence || "weekly");

    const cat = categories.find((c) => c.id === problem.category_id);
    const isProbCat = isProblemCategory(cat?.slug);
    const isNote = !isProbCat && (!problem.companies || problem.companies.length === 0);
    setEditFormMode(isNote ? "note" : "problem");

    setShowEditModal(true);
  };

  const handleOpenEditSubtext = (subtext: Subtext, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubtext(subtext);
    setEditingProblem(null);
    setEditFormMode("subtext");
    setEditCatId(subtext.category_id);
    setEditTitle(subtext.title);
    setEditOriginalText(subtext.original_text);
    setEditSubtextText(subtext.subtext);
    setEditTagsStr((subtext.tags || []).join(", "));
    setEditCadence(subtext.cadence || "weekly");
    setShowEditModal(true);
  };

  const handleEditCatChange = (catId: string) => {
    setEditCatId(catId);
    const cat = categories.find((c) => c.id === catId);
    setEditFormMode(resolveFormMode(cat?.slug));
  };

  const handleUpdateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatId) return;

    setIsUpdating(true);
    try {
      if (editFormMode === "subtext" && editingSubtext) {
        if (!editTitle.trim() || !editOriginalText.trim() || !editSubtextText.trim()) return;
        const finalTags = parseTags(editTagsStr);
        await updateSubtext(editingSubtext.id, {
          category_id: editCatId,
          title: editTitle.trim(),
          original_text: editOriginalText.trim(),
          subtext: editSubtextText.trim(),
          tags: finalTags,
          cadence: editCadence,
        });
        setShowEditModal(false);
        setEditingSubtext(null);
        await onRefresh();
        return;
      }

      if (!editingProblem || !editPrompt.trim() || !editNotes.trim()) return;
      if (editFormMode === "problem" && !editTitle.trim()) return;

      let finalTitle = editTitle.trim();
      let finalTags: string[] = [];
      let finalCompanies: string[] = [];

      if (editFormMode === "note") {
        finalTitle = editPrompt.trim();
        finalTags = [];
        finalCompanies = [];
      } else {
        finalTags = parseTags(editTagsStr);
        finalCompanies = parseCompanies(editCompaniesStr);
      }

      await updateProblem(editingProblem.id, {
        category_id: editCatId,
        title: finalTitle,
        prompt: editPrompt.trim(),
        notes: editNotes.trim(),
        tags: finalTags,
        companies: finalCompanies,
        cadence: editCadence,
      });

      setShowEditModal(false);
      setEditingProblem(null);
      await onRefresh();
    } catch (err) {
      console.error("Failed to update entry", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseCatModal = () => {
    setShowCatModal(false);
    setEditingCatId(null);
    setCatError(null);
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    const autoSlug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!autoSlug) return;

    setCatError(null);
    setIsCatSubmitting(true);
    try {
      const created = await createCategory(autoSlug, trimmedName);
      setNewCatName("");
      onRefresh();
      setFormCatId(created.id);
    } catch (err: unknown) {
      console.error("Failed to create category", err);
      const msg = err instanceof Error ? err.message : "Failed to create category";
      setCatError(msg);
    } finally {
      setIsCatSubmitting(false);
    }
  };

  const handleStartEditCat = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setCatError(null);
  };

  const handleCancelEditCat = () => {
    setEditingCatId(null);
    setEditCatName("");
  };

  const handleSaveEditCat = async (cat: Category) => {
    const trimmedName = editCatName.trim();
    if (!trimmedName) {
      setCatError("Category name is required.");
      return;
    }
    setCatError(null);
    setIsCatUpdating(true);
    try {
      await updateCategory(cat.id, {
        name: trimmedName,
        slug: cat.slug,
      });
      setEditingCatId(null);
      onRefresh();
    } catch (err: unknown) {
      console.error("Failed to update category", err);
      const msg = err instanceof Error ? err.message : "Failed to update category";
      setCatError(msg);
    } finally {
      setIsCatUpdating(false);
    }
  };

  const handleDeleteCat = async (cat: Category, entryCount: number) => {
    setCatError(null);
    if (entryCount > 0) {
      setCatError(
        `Cannot delete "${cat.name}" (${entryCount} ${entryCount === 1 ? "entry" : "entries"} inside).`
      );
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) {
      return;
    }

    setDeletingCatId(cat.id);
    try {
      await deleteCategory(cat.id);
      if (selectedCategory === cat.id) {
        onSelectCategory(null);
      }
      if (formCatId === cat.id) {
        setFormCatId("");
      }
      onRefresh();
    } catch (err: unknown) {
      console.error("Failed to delete category", err);
      const msg = err instanceof Error ? err.message : "Failed to delete category";
      setCatError(msg);
    } finally {
      setDeletingCatId(null);
    }
  };

  const [optimisticStars, setOptimisticStars] = useState<Record<string, boolean>>({});
  const [optimisticDifficult, setOptimisticDifficult] = useState<Record<string, boolean>>({});

  const isProblemStarred = (problem: Problem) =>
    problem.id in optimisticStars ? optimisticStars[problem.id] : Boolean(problem.is_starred);

  const isSubtextStarred = (subtext: Subtext) =>
    subtext.id in optimisticStars ? optimisticStars[subtext.id] : Boolean(subtext.is_starred);

  const isProblemDifficult = (problem: Problem) =>
    problem.id in optimisticDifficult ? optimisticDifficult[problem.id] : Boolean(problem.is_difficult);

  const isSubtextDifficult = (subtext: Subtext) =>
    subtext.id in optimisticDifficult ? optimisticDifficult[subtext.id] : Boolean(subtext.is_difficult);

  const handleToggleStar = async (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isProblemStarred(problem);
    setOptimisticStars((prev) => ({ ...prev, [problem.id]: nextVal }));
    try {
      await updateProblem(problem.id, { is_starred: nextVal });
      await onRefresh();
    } catch (err) {
      console.error("Failed to toggle important marker", err);
      setOptimisticStars((prev) => {
        const copy = { ...prev };
        delete copy[problem.id];
        return copy;
      });
    }
  };

  const handleToggleSubtextStar = async (subtext: Subtext, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isSubtextStarred(subtext);
    setOptimisticStars((prev) => ({ ...prev, [subtext.id]: nextVal }));
    try {
      await updateSubtext(subtext.id, { is_starred: nextVal });
      await onRefresh();
    } catch (err) {
      console.error("Failed to toggle subtext important marker", err);
      setOptimisticStars((prev) => {
        const copy = { ...prev };
        delete copy[subtext.id];
        return copy;
      });
    }
  };

  const handleToggleDifficult = async (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isProblemDifficult(problem);
    setOptimisticDifficult((prev) => ({ ...prev, [problem.id]: nextVal }));
    try {
      await updateProblem(problem.id, { is_difficult: nextVal });
      await onRefresh();
    } catch (err) {
      console.error("Failed to toggle difficult marker", err);
      setOptimisticDifficult((prev) => {
        const copy = { ...prev };
        delete copy[problem.id];
        return copy;
      });
    }
  };

  const handleToggleSubtextDifficult = async (subtext: Subtext, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !isSubtextDifficult(subtext);
    setOptimisticDifficult((prev) => ({ ...prev, [subtext.id]: nextVal }));
    try {
      await updateSubtext(subtext.id, { is_difficult: nextVal });
      await onRefresh();
    } catch (err) {
      console.error("Failed to toggle subtext difficult marker", err);
      setOptimisticDifficult((prev) => {
        const copy = { ...prev };
        delete copy[subtext.id];
        return copy;
      });
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

  const selectedCatObj = categories.find((c) => c.id === selectedCategory);
  const isSubtextSelected = isSubtextCategory(selectedCatObj?.slug);

  const workCategories = categories.filter((c) => !isSubtextCategory(c.slug));
  const subtextCategories = categories.filter((c) => isSubtextCategory(c.slug));

  const workProblemsCount = problems.filter((p) => {
    const cat = categories.find((c) => c.id === p.category_id);
    return !cat || !isSubtextCategory(cat.slug);
  }).length;

  const baseCategoryProblems = isSubtextSelected
    ? []
    : problems.filter((p) => {
        const matchesCategory = selectedCategory
          ? p.category_id === selectedCategory
          : (() => {
              const cat = categories.find((c) => c.id === p.category_id);
              return !cat || !isSubtextCategory(cat.slug);
            })();
        const matchesCompany =
          !selectedCompanyFilter ||
          (p.companies && p.companies.some((c) => c.toLowerCase() === selectedCompanyFilter.toLowerCase()));
        const s = search.toLowerCase();
        const matchesSearch =
          !search ||
          p.title.toLowerCase().includes(s) ||
          p.prompt.toLowerCase().includes(s) ||
          (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(s))) ||
          (p.companies && p.companies.some((c) => c.toLowerCase().includes(s)));
        return matchesCategory && matchesCompany && matchesSearch;
      });

  const filteredProblems = baseCategoryProblems
    .filter((p) => (!showStarredOnly || isProblemStarred(p)) && (!showDifficultOnly || isProblemDifficult(p)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const baseCategorySubtexts = !isSubtextSelected
    ? []
    : subtexts.filter((s) => {
        const matchesCategory = s.category_id === selectedCategory;
        const q = search.toLowerCase();
        const matchesSearch =
          !search ||
          s.title.toLowerCase().includes(q) ||
          s.original_text.toLowerCase().includes(q) ||
          s.subtext.toLowerCase().includes(q) ||
          (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(q)));
        return matchesCategory && matchesSearch;
      });

  const filteredSubtexts = baseCategorySubtexts
    .filter((s) => (!showStarredOnly || isSubtextStarred(s)) && (!showDifficultOnly || isSubtextDifficult(s)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const starredCount = isSubtextSelected
    ? baseCategorySubtexts.filter((s) => isSubtextStarred(s)).length
    : baseCategoryProblems.filter((p) => isProblemStarred(p)).length;

  const difficultCount = isSubtextSelected
    ? baseCategorySubtexts.filter((s) => isSubtextDifficult(s)).length
    : baseCategoryProblems.filter((p) => isProblemDifficult(p)).length;

  const isAllVisibleSelected =
    filteredProblems.length > 0 && filteredProblems.every((p) => selectedProblemIds.has(p.id));

  const toggleProblemSelection = (problemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProblemIds((prev) => {
      const next = new Set(prev);
      if (next.has(problemId)) {
        next.delete(problemId);
      } else {
        next.add(problemId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredProblems.map((p) => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProblemIds.has(id));

    setSelectedProblemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleCreateCustomDeck = async (e: React.FormEvent, startImmediately: boolean = false) => {
    e.preventDefault();
    if (!newDeckName.trim() || selectedProblemIds.size === 0) return;

    setIsCreatingDeck(true);
    try {
      const created = await createReviewList({
        name: newDeckName.trim(),
        company: newDeckCompany.trim() || undefined,
        description: newDeckDesc.trim() || undefined,
        problem_ids: Array.from(selectedProblemIds),
      });
      setShowCreateDeckModal(false);
      setNewDeckName("");
      setNewDeckCompany("");
      setNewDeckDesc("");
      setSelectedProblemIds(new Set());
      onRefresh();

      if (startImmediately && onStartReviewListShuffle) {
        onStartReviewListShuffle(
          created.id,
          created.name,
          created.company,
          created.problem_count
        );
      }
    } catch (err) {
      console.error("Failed to create custom deck", err);
    } finally {
      setIsCreatingDeck(false);
    }
  };

  const handleBatchSetCadence = async (cadence: string) => {
    if (selectedProblemIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedProblemIds).map((id) =>
          updateProblem(id, { cadence })
        )
      );
      setSelectedProblemIds(new Set());
      onRefresh();
    } catch (err) {
      console.error("Failed to update cadence for selected problems", err);
    }
  };

  return (
    <div className="problem-manager">
      {/* Controls & Filter Toolbar */}
      <div className="manager-toolbar">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder={isSubtextSelected ? "Search subtexts, idioms, or quotes..." : "Search problem titles..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!isSubtextSelected && (
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
        )}

        <div className="action-buttons">
          <button
            className="secondary-action-btn"
            onClick={() => {
              setShowCatModal(true);
              setCatError(null);
              setEditingCatId(null);
            }}
          >
            <FolderCog size={16} /> Categories
          </button>
          <button
            type="button"
            className="primary-action-btn"
            onClick={handleOpenAddModal}
            title="Create a new entry"
          >
            <Plus size={16} /> Add Entry
          </button>
        </div>
      </div>

      {/* Category Filter Chips Bar: Work categories on Left, Subtexts on Right */}
      <div className="category-filter-chips-bar">
        <div className="category-filter-chips-left">
          <button
            className={`chip ${!selectedCategory ? "active" : ""}`}
            onClick={() => onSelectCategory(null)}
          >
            All Work ({workProblemsCount})
          </button>
          {workCategories.map((c) => {
            const count = problems.filter((p) => p.category_id === c.id).length;
            const theme = getCategoryTheme(c.slug || c.name);
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                className={`chip ${isSelected ? "active" : ""}`}
                style={isSelected ? undefined : { borderColor: theme.border }}
                onClick={() => onSelectCategory(c.id)}
              >
                <span
                  className="cat-chip-dot"
                  style={{ backgroundColor: theme.color }}
                />
                {formatCategoryName(c.name)} ({count})
              </button>
            );
          })}
        </div>

        {subtextCategories.length > 0 && (
          <div className="category-filter-chips-right">
            <span className="chips-divider" aria-hidden="true" />
            {subtextCategories.map((c) => {
              const count = subtexts.filter((s) => s.category_id === c.id).length;
              const theme = getCategoryTheme(c.slug || c.name);
              const isSelected = selectedCategory === c.id;
              return (
                <button
                  key={c.id}
                  className={`chip chip-subtext ${isSelected ? "active" : ""}`}
                  style={isSelected ? undefined : { borderColor: theme.border }}
                  onClick={() => onSelectCategory(c.id)}
                  title="Subtext & Idioms (reviewed independently)"
                >
                  <span
                    className="cat-chip-dot"
                    style={{ backgroundColor: theme.color }}
                  />
                  {formatCategoryName(c.name)} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Multi-select Deck Authoring Action Bar */}
      {selectedProblemIds.size > 0 && (
        <div className="deck-selection-toolbar">
          <div className="deck-selection-count">
            <span className="badge stats-badge">{selectedProblemIds.size}</span>
            <span>problems selected</span>
          </div>
          <div className="deck-selection-actions">
            <button
              type="button"
              className="primary-action-btn save-deck-btn"
              onClick={() => {
                setNewDeckName(
                  selectedCompanyFilter ? `${selectedCompanyFilter} Focus Deck` : ""
                );
                setNewDeckCompany(selectedCompanyFilter || "");
                setNewDeckDesc("");
                setShowCreateDeckModal(true);
              }}
            >
              <Layers size={15} /> Save as Deck
            </button>
            <button
              type="button"
              className="secondary-action-btn"
              onClick={() => handleBatchSetCadence("daily")}
              title="Set selected problems to Drill Soon (Intra-day review ~4h)"
            >
              🔄 Drill Selected (~4h)
            </button>
            <button
              type="button"
              className="secondary-action-btn"
              onClick={() => handleBatchSetCadence("monthly")}
              title="Park selected problems (21d deferred)"
            >
              ⏭️ Park Selected (21d)
            </button>
            <button
              type="button"
              className="secondary-action-btn"
              onClick={() => setSelectedProblemIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* List Header with Select All, Important/Difficult Filters, and Count */}
      <div className="problem-list-controls">
        <div className="problem-list-controls-left">
          {!isSubtextSelected ? (
            <button
              type="button"
              className="select-all-btn"
              onClick={handleToggleSelectAll}
              title={isAllVisibleSelected ? "Deselect all visible problems" : "Select all visible problems"}
            >
              {isAllVisibleSelected ? <CheckSquare size={13.5} /> : <Square size={13.5} />}
              <span>{isAllVisibleSelected ? "Deselect All Visible" : "Select All Visible"}</span>
            </button>
          ) : (
            <span className="subtext-view-label">✨ Subtext & Idiom Track</span>
          )}
          <button
            type="button"
            className={`starred-filter-toggle-btn ${showStarredOnly ? "active" : ""}`}
            onClick={() => setShowStarredOnly((prev) => !prev)}
            title={showStarredOnly ? "Show all entries" : "Show only entries marked as important"}
          >
            <Star size={12.5} fill={showStarredOnly ? "currentColor" : "none"} />
            <span>Important{starredCount > 0 ? ` (${starredCount})` : ""}</span>
          </button>
          <button
            type="button"
            className={`difficult-filter-toggle-btn ${showDifficultOnly ? "active" : ""}`}
            onClick={() => setShowDifficultOnly((prev) => !prev)}
            title={showDifficultOnly ? "Show all entries" : "Show only entries marked as very difficult"}
          >
            <Circle size={11.5} fill={showDifficultOnly ? "currentColor" : "none"} />
            <span>Difficult{difficultCount > 0 ? ` (${difficultCount})` : ""}</span>
          </button>
        </div>
        <span className="problem-list-count">
          {isSubtextSelected
            ? `Showing ${filteredSubtexts.length} ${filteredSubtexts.length === 1 ? "entry" : "entries"}`
            : `Showing ${filteredProblems.length} ${filteredProblems.length === 1 ? "problem" : "problems"}`}
        </span>
      </div>

      {/* Problem & Subtext Titles List */}
      <div className="problem-list">
        {filteredProblems.length === 0 && filteredSubtexts.length === 0 ? (
          <div className="empty-state">
            {isSubtextSelected ? "No subtext entries found in this category." : "No matching work entries found."}
          </div>
        ) : (
          <>
            {filteredProblems.map((problem) => {
            const isExpanded = expandedId === problem.id;
            const isSelected = selectedProblemIds.has(problem.id);
            const isStarred = isProblemStarred(problem);
            const isDifficult = isProblemDifficult(problem);
            const catName = getCategoryName(problem.category_id);
            const catSlug = getCategorySlug(problem.category_id);
            const catTheme = getCategoryTheme(catSlug || catName);
            const formattedCatName = formatCategoryName(catName);

            return (
              <div
                key={problem.id}
                className={`problem-item ${isExpanded ? "expanded" : ""} ${isSelected ? "problem-row-selected" : ""} ${isStarred ? "problem-row-starred" : ""} ${isDifficult ? "problem-row-difficult" : ""}`}
                onClick={() => setExpandedId(isExpanded ? null : problem.id)}
              >
                {/* Collapsed Row: Checkbox, Category Tag, Important Star & Difficult Red Circle Markers, Problem Title, Actions */}
                <div className="problem-row-header">
                  <div className="problem-title-wrapper">
                    <button
                      type="button"
                      className={`row-select-checkbox-btn ${isSelected ? "selected" : ""}`}
                      onClick={(e) => toggleProblemSelection(problem.id, e)}
                      title={isSelected ? "Deselect from deck" : "Select for deck"}
                    >
                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </button>
                    <span
                      className="problem-category-pill"
                      style={catTheme.style}
                    >
                      {formattedCatName}
                    </span>
                    <div className="problem-markers-group">
                      <button
                        type="button"
                        className={`problem-star-btn ${isStarred ? "starred" : ""}`}
                        onClick={(e) => handleToggleStar(problem, e)}
                        title={isStarred ? "Unmark as important" : "Mark as important"}
                      >
                        <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        className={`problem-difficult-btn ${isDifficult ? "difficult" : ""}`}
                        onClick={(e) => handleToggleDifficult(problem, e)}
                        title={isDifficult ? "Unmark as very difficult" : "Mark as very difficult"}
                      >
                        <Circle size={12.5} fill={isDifficult ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <h3 className="problem-title-text">{problem.title}</h3>
                  </div>
                  <div className="problem-row-actions">
                    <button
                      className="icon-edit-btn"
                      onClick={(e) => handleOpenEditModal(problem, e)}
                      title="Edit problem"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon-delete-btn"
                      onClick={(e) => handleDelete(problem.id, e)}
                      title="Delete problem"
                    >
                      <Trash2 size={13.5} />
                    </button>
                    <span className="expand-indicator">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </div>
                </div>

                {/* Expanded: Embedded Flashcard for Active Recall Testing */}
                {isExpanded && (
                  <div className="problem-expanded-details" onClick={(e) => e.stopPropagation()}>
                    <ProblemFlashcard
                      problem={problem}
                      categoryName={formattedCatName}
                      categorySlug={catSlug}
                      onReviewRecorded={onRefresh}
                      embedded={true}
                    />
                    {isProblemCategory(getCategorySlug(problem.category_id)) &&
                      problem.companies &&
                      problem.companies.length > 0 && (
                        <div className="expanded-footer-meta">
                          <div className="meta-group">
                            <span className="meta-label">Companies:</span>
                            <div className="meta-pills">
                              {problem.companies.map((c, i) => (
                                <span key={i} className="mini-company-pill">
                                  🏢 {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredSubtexts.map((subtext) => {
            const isExpanded = expandedSubtextId === subtext.id;
            const isStarred = isSubtextStarred(subtext);
            const isDifficult = isSubtextDifficult(subtext);
            const catName = getCategoryName(subtext.category_id);
            const catSlug = getCategorySlug(subtext.category_id);
            const catTheme = getCategoryTheme(catSlug || catName);
            const formattedCatName = formatCategoryName(catName);

            return (
              <div
                key={subtext.id}
                className={`problem-item ${isExpanded ? "expanded" : ""} ${isStarred ? "problem-row-starred" : ""} ${isDifficult ? "problem-row-difficult" : ""}`}
                style={{ borderLeft: "3px solid #818cf8" }}
                onClick={() => setExpandedSubtextId(isExpanded ? null : subtext.id)}
              >
                <div className="problem-row-header">
                  <div className="problem-title-wrapper">
                    <span
                      className="problem-category-pill"
                      style={catTheme.style}
                    >
                      {formattedCatName}
                    </span>
                    <div className="problem-markers-group">
                      <button
                        type="button"
                        className={`problem-star-btn ${isStarred ? "starred" : ""}`}
                        onClick={(e) => handleToggleSubtextStar(subtext, e)}
                        title={isStarred ? "Unmark as important" : "Mark as important"}
                      >
                        <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        className={`problem-difficult-btn ${isDifficult ? "difficult" : ""}`}
                        onClick={(e) => handleToggleSubtextDifficult(subtext, e)}
                        title={isDifficult ? "Unmark as very difficult" : "Mark as very difficult"}
                      >
                        <Circle size={12.5} fill={isDifficult ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <span className="subtext-badge-pill" style={{ marginRight: "6px" }}>
                      ✨ Subtext
                    </span>
                    <h3 className="problem-title-text">{subtext.title}</h3>
                  </div>

                  <div className="problem-row-actions">
                    <span className="cadence-indicator-tag">
                      {subtext.cadence ? subtext.cadence.replace("_", "-") : "weekly"}
                    </span>

                    <button
                      type="button"
                      className="row-action-btn edit-icon-btn"
                      onClick={(e) => handleOpenEditSubtext(subtext, e)}
                      title="Edit subtext entry"
                    >
                      <Pencil size={13.5} />
                    </button>

                    <button
                      type="button"
                      className="row-action-btn delete-icon-btn"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete subtext "${subtext.title}"?`)) {
                          await deleteSubtext(subtext.id);
                          if (expandedSubtextId === subtext.id) setExpandedSubtextId(null);
                          onRefresh();
                        }
                      }}
                      title="Delete subtext entry"
                    >
                      <Trash2 size={13.5} />
                    </button>

                    <button
                      type="button"
                      className="row-action-btn expand-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSubtextId(isExpanded ? null : subtext.id);
                      }}
                      title={isExpanded ? "Collapse preview" : "Expand preview"}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="problem-expanded-details" onClick={(e) => e.stopPropagation()}>
                    <SubtextFlashcard
                      subtext={subtext}
                      categoryName={formattedCatName}
                      categorySlug={catSlug}
                      onReviewRecorded={onRefresh}
                      embedded={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      </div>

      {/* Add Problem / Note Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div
            className={`modal-content modal-content-wide entry-modal-content ${isAddModalMaximized ? "maximized" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {formMode === "subtext"
                  ? "Add Subtext Entry"
                  : formMode === "note"
                  ? "Add Knowledge Note"
                  : "Add Problem"}
              </h2>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="modal-control-icon-btn"
                  onClick={() => setIsAddModalMaximized(!isAddModalMaximized)}
                  title={isAddModalMaximized ? "Restore size" : "Maximize modal"}
                >
                  {isAddModalMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  className="modal-close-icon-btn"
                  onClick={() => setShowAddModal(false)}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateProblem} className="entry-modal-form">
              <div className="entry-modal-body">
                {formMode === "subtext" ? (
                  /* Subtext Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={activeFormCatId}
                          onChange={(e) => handleFormCatChange(e.target.value)}
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
                        <label>Title / Focal Phrase or Headline:</label>
                        <input
                          type="text"
                          placeholder={getSubtextPlaceholders(getCategorySlug(activeFormCatId)).title}
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Original Text / Passage (Pasted Excerpt):</label>
                      <textarea
                        className="notes-editor-textarea subtext-input-original"
                        rows={5}
                        placeholder={getSubtextPlaceholders(getCategorySlug(activeFormCatId)).original}
                        value={originalText}
                        onChange={(e) => setOriginalText(e.target.value)}
                        onKeyDown={createIndentKeyDownHandler(setOriginalText)}
                        required
                      />
                      <span className="field-hint-text">
                        Unbounded container. Paste full articles, movie dialogue, or authentic usage sentences.
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Subtext & Meaning (Decoded Insight / Notes):</label>
                      <DualNotepad
                        value={subtextText}
                        onChange={setSubtextText}
                        placeholder={getSubtextPlaceholders(getCategorySlug(activeFormCatId)).subtext}
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={420}
                      />
                      <span className="field-hint-text">
                        Revealed on the back of the flashcard: unstated intention, definition, or nuance matrix.
                      </span>
                    </div>

                    <div className="form-group">
                      <label>Tags (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g. idiom, business, character, nuance"
                        value={tagsStr}
                        onChange={(e) => setTagsStr(e.target.value)}
                      />
                    </div>
                  </>
                ) : formMode === "note" ? (
                  /* Note Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={activeFormCatId}
                          onChange={(e) => handleFormCatChange(e.target.value)}
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
                        <label>Recall Prompt / Concept Question:</label>
                        <input
                          type="text"
                          placeholder="e.g. Difference between __new__ and __init__ in Python?"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="form-group note-editor-group">
                      <label>Note / Key Takeaways & Gotchas:</label>
                      <DualNotepad
                        value={notes}
                        onChange={setNotes}
                        placeholder="The explanation, code snippet, core insight, or takeaway... (Tab & Enter auto-indent supported)"
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={540}
                      />
                      <span className="field-hint-text">
                        Revealed on the back of the flashcard during review.
                      </span>
                    </div>
                  </>
                ) : (
                  /* Problem Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={activeFormCatId}
                          onChange={(e) => handleFormCatChange(e.target.value)}
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
                        rows={3}
                        placeholder="The question and constraints you challenge yourself to recall when looking at the problem title... (Tab supported)"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={createIndentKeyDownHandler(setPrompt)}
                        required
                      />
                    </div>

                    <div className="form-group note-editor-group">
                      <label>Notes (Solution & Implementation):</label>
                      <DualNotepad
                        value={notes}
                        onChange={setNotes}
                        placeholder="The key insights, formula, recurrence relation, or Python implementation..."
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={480}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="entry-modal-actions">
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
                  {isSubmitting
                    ? "Saving..."
                    : formMode === "subtext"
                    ? "Save Subtext"
                    : formMode === "note"
                    ? "Save Note"
                    : "Save Problem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {showEditModal && (editingProblem || editingSubtext) && (
        <div className="modal-overlay">
          <div
            className={`modal-content modal-content-wide entry-modal-content ${isEditModalMaximized ? "maximized" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {editFormMode === "subtext"
                  ? "Edit Subtext Entry"
                  : editFormMode === "note"
                  ? "Edit Note"
                  : "Edit Problem"}
              </h2>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="modal-control-icon-btn"
                  onClick={() => setIsEditModalMaximized(!isEditModalMaximized)}
                  title={isEditModalMaximized ? "Restore size" : "Maximize modal"}
                >
                  {isEditModalMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  className="modal-close-icon-btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProblem(null);
                    setEditingSubtext(null);
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateProblem} className="entry-modal-form">
              <div className="entry-modal-body">
                {editFormMode === "subtext" ? (
                  /* Edit Subtext Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={editCatId}
                          onChange={(e) => handleEditCatChange(e.target.value)}
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
                        <label>Review Cadence & Priority:</label>
                        <select
                          value={editCadence}
                          onChange={(e) => setEditCadence(e.target.value)}
                        >
                          <option value="daily">🔄 Drill Soon (Intra-day review ~4h)</option>
                          <option value="intra_week">📅 Mid-Week (Consolidation 2–3d)</option>
                          <option value="weekly">🗓️ Next Week (Standard 7d)</option>
                          <option value="monthly">⏭️ Skip / Park (Parked for 21d)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Title / Focal Phrase or Headline:</label>
                      <input
                        type="text"
                        placeholder={getSubtextPlaceholders(getCategorySlug(editCatId)).title}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Original Text / Passage (Pasted Excerpt):</label>
                      <textarea
                        className="notes-editor-textarea subtext-input-original"
                        rows={5}
                        placeholder={getSubtextPlaceholders(getCategorySlug(editCatId)).original}
                        value={editOriginalText}
                        onChange={(e) => setEditOriginalText(e.target.value)}
                        onKeyDown={createIndentKeyDownHandler(setEditOriginalText)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Subtext & Meaning (Decoded Insight / Notes):</label>
                      <DualNotepad
                        value={editSubtextText}
                        onChange={setEditSubtextText}
                        placeholder={getSubtextPlaceholders(getCategorySlug(editCatId)).subtext}
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={420}
                      />
                    </div>

                    <div className="form-group">
                      <label>Tags (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g. idiom, business, character, nuance"
                        value={editTagsStr}
                        onChange={(e) => setEditTagsStr(e.target.value)}
                      />
                    </div>
                  </>
                ) : editFormMode === "note" ? (
                  /* Edit Note Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={editCatId}
                          onChange={(e) => handleEditCatChange(e.target.value)}
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
                        <label>Review Cadence & Priority:</label>
                        <select
                          value={editCadence}
                          onChange={(e) => setEditCadence(e.target.value)}
                        >
                          <option value="daily">🔄 Drill Soon (Intra-day review ~4h)</option>
                          <option value="intra_week">📅 Mid-Week (Consolidation 2–3d)</option>
                          <option value="weekly">🗓️ Next Week (Standard 7d)</option>
                          <option value="monthly">⏭️ Skip / Park (Parked for 21d)</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Recall Prompt / Concept Question:</label>
                      <input
                        type="text"
                        placeholder="e.g. Difference between __new__ and __init__ in Python?"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        required
                      />
                      <span className="field-hint-text">
                        This question appears on the front of your flashcard during review.
                      </span>
                    </div>

                    <div className="form-group note-editor-group">
                      <label>Note / Key Takeaways & Gotchas:</label>
                      <DualNotepad
                        value={editNotes}
                        onChange={setEditNotes}
                        placeholder="The explanation, code snippet, core insight, or takeaway..."
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={540}
                      />
                    </div>
                  </>
                ) : (
                  /* Edit Problem Mode */
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category:</label>
                        <select
                          value={editCatId}
                          onChange={(e) => handleEditCatChange(e.target.value)}
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
                      <label>Review Cadence & Priority:</label>
                      <select
                        value={editCadence}
                        onChange={(e) => setEditCadence(e.target.value)}
                      >
                        <option value="daily">🔄 Drill Soon (Intra-day review ~4h)</option>
                        <option value="intra_week">📅 Mid-Week (Consolidation 2–3d)</option>
                        <option value="weekly">🗓️ Next Week (Standard 7d)</option>
                        <option value="monthly">⏭️ Skip / Park (Parked for 21d)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Hints (Problem Prompt & Constraints):</label>
                      <textarea
                        className="prompt-editor-textarea"
                        rows={3}
                        placeholder="The question and constraints... (Tab supported)"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        onKeyDown={createIndentKeyDownHandler(setEditPrompt)}
                        required
                      />
                    </div>

                    <div className="form-group note-editor-group">
                      <label>Notes (Solution & Implementation):</label>
                      <DualNotepad
                        value={editNotes}
                        onChange={setEditNotes}
                        placeholder="The key insights, formula, recurrence relation, or Python implementation..."
                        labelCol1="Pad 1"
                        labelCol2="Pad 2"
                        height={480}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="entry-modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProblem(null);
                    setEditingSubtext(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action-btn"
                  disabled={isUpdating}
                >
                  {isUpdating
                    ? "Saving..."
                    : editFormMode === "subtext"
                    ? "Update Subtext"
                    : editFormMode === "note"
                    ? "Update Note"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      {showCatModal && (
        <div
          className="modal-overlay"
          onClick={handleCloseCatModal}
        >
          <div
            className="modal-content category-manager-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="cat-modal-header-title">
                <FolderCog size={19} className="cat-modal-header-icon" />
                <h2>Categories</h2>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={handleCloseCatModal}
                title="Close"
              >
                ✕
              </button>
            </div>

            {catError && (
              <div className="cat-alert cat-alert-error">
                <AlertCircle size={15} />
                <span>{catError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCat} className="cat-quick-add-form">
              <input
                type="text"
                className="cat-quick-add-input"
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <button
                type="submit"
                className="primary-action-btn cat-quick-add-btn"
                disabled={isCatSubmitting || !newCatName.trim()}
              >
                <Plus size={15} />
                {isCatSubmitting ? "Adding..." : "Add"}
              </button>
            </form>

            <div className="cat-compact-list">
              {categories.length === 0 ? (
                <div className="cat-empty-notice">No categories yet.</div>
              ) : (
                categories.map((c) => {
                  const isSub = isSubtextCategory(c.slug);
                  const count = isSub
                    ? subtexts.filter((s) => s.category_id === c.id).length
                    : problems.filter((p) => p.category_id === c.id).length;
                  const theme = getCategoryTheme(c.slug || c.name);
                  const isEditing = editingCatId === c.id;

                  if (isEditing) {
                    return (
                      <div key={c.id} className="cat-compact-row editing">
                        <input
                          type="text"
                          className="cat-inline-edit-input"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEditCat(c);
                            } else if (e.key === "Escape") {
                              handleCancelEditCat();
                            }
                          }}
                          placeholder="Category name"
                          autoFocus
                        />
                        <div className="cat-item-actions">
                          <button
                            type="button"
                            className="cat-action-icon-btn save"
                            onClick={() => handleSaveEditCat(c)}
                            disabled={isCatUpdating || !editCatName.trim()}
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="cat-action-icon-btn cancel"
                            onClick={handleCancelEditCat}
                            disabled={isCatUpdating}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="cat-compact-row">
                      <div className="cat-compact-row-left">
                        <span
                          className="cat-chip-dot"
                          style={{ backgroundColor: theme.color }}
                        />
                        <span className="cat-item-name">{formatCategoryName(c.name)}</span>
                        <span className={`cat-count-pill ${count > 0 ? "active" : ""}`}>
                          {count}
                        </span>
                      </div>
                      <div className="cat-item-actions">
                        <button
                          type="button"
                          className="cat-action-icon-btn edit"
                          onClick={() => handleStartEditCat(c)}
                          title="Rename category"
                        >
                          <Pencil size={13.5} />
                        </button>
                        <button
                          type="button"
                          className={`cat-action-icon-btn delete ${count > 0 ? "blocked" : ""}`}
                          onClick={() => handleDeleteCat(c, count)}
                          disabled={deletingCatId === c.id}
                          title={
                            count > 0
                              ? `Cannot delete (${count} ${count === 1 ? "entry" : "entries"})`
                              : "Delete category"
                          }
                        >
                          <Trash2 size={13.5} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Custom Review Deck Modal */}
      {showCreateDeckModal && (
        <div className="modal-overlay" onClick={() => setShowCreateDeckModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Save Custom Review Deck</h2>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setShowCreateDeckModal(false)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomDeck}>
              <div className="deck-modal-summary">
                <span>Saving <strong>{selectedProblemIds.size}</strong> problems into a persistent review deck.</span>
              </div>
              <div className="form-group">
                <label>Deck Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Onsite Prep, Graph Hard Patterns..."
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Target Company (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Google, Meta, Amazon..."
                  value={newDeckCompany}
                  onChange={(e) => setNewDeckCompany(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  placeholder="Notes or focus topics for this deck..."
                  value={newDeckDesc}
                  onChange={(e) => setNewDeckDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setShowCreateDeckModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="secondary-action-btn"
                  disabled={isCreatingDeck || !newDeckName.trim() || selectedProblemIds.size === 0}
                >
                  {isCreatingDeck ? "Saving..." : "Save Deck"}
                </button>
                {onStartReviewListShuffle && (
                  <button
                    type="button"
                    className="primary-action-btn"
                    disabled={isCreatingDeck || !newDeckName.trim() || selectedProblemIds.size === 0}
                    onClick={(e) => handleCreateCustomDeck(e, true)}
                  >
                    Save & Test Now →
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
