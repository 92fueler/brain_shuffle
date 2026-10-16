import type {
  Category,
  Problem,
  ProblemCreatePayload,
  ReviewSubmission,
  CompanyStat,
  ReviewList,
  ReviewListCreatePayload,
  BackupPayload,
  Subtext,
  SubtextCreatePayload,
  SubtextUpdatePayload,
} from "./types";

const BASE_URL = "/api";

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/categories/`);
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export async function createCategory(slug: string, name: string, description?: string): Promise<Category> {
  const res = await fetch(`${BASE_URL}/categories/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, name, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create category");
  }
  return res.json();
}

export async function updateCategory(
  id: string,
  payload: { name?: string; slug?: string; description?: string }
): Promise<Category> {
  const res = await fetch(`${BASE_URL}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update category");
  }
  return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/categories/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete category");
  }
}

export async function fetchProblems(
  categoryId?: string,
  company?: string,
  search?: string
): Promise<Problem[]> {
  const params = new URLSearchParams();
  if (categoryId) params.append("category_id", categoryId);
  if (company) params.append("company", company);
  if (search) params.append("search", search);
  const res = await fetch(`${BASE_URL}/problems/?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load problems");
  return res.json();
}

export async function createProblem(payload: ProblemCreatePayload): Promise<Problem> {
  const res = await fetch(`${BASE_URL}/problems/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create problem");
  return res.json();
}

export async function updateProblem(
  problemId: string,
  payload: Partial<ProblemCreatePayload> & { cadence?: string }
): Promise<Problem> {
  const res = await fetch(`${BASE_URL}/problems/${problemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update problem");
  return res.json();
}

export async function deleteProblem(problemId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/problems/${problemId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete problem");
}

export async function reorderProblems(orderedIds: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/problems/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder problems");
}

export async function fetchCompanies(): Promise<CompanyStat[]> {
  const res = await fetch(`${BASE_URL}/companies/`);
  if (!res.ok) throw new Error("Failed to load companies");
  return res.json();
}

export async function fetchReviewLists(): Promise<ReviewList[]> {
  const res = await fetch(`${BASE_URL}/review-lists/`);
  if (!res.ok) throw new Error("Failed to load review lists");
  return res.json();
}

export async function createReviewList(payload: ReviewListCreatePayload): Promise<ReviewList> {
  const res = await fetch(`${BASE_URL}/review-lists/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create review list");
  return res.json();
}

export async function deleteReviewList(listId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/review-lists/${listId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete review list");
}

export async function fetchShuffleBatch(options?: {
  categoryId?: string;
  company?: string;
  reviewListId?: string;
  limit?: number;
  mode?: string;
  excludeIds?: string[];
}): Promise<Problem[]> {
  const params = new URLSearchParams();
  if (options?.categoryId) params.append("category_id", options.categoryId);
  if (options?.company) params.append("company", options.company);
  if (options?.reviewListId) params.append("review_list_id", options.reviewListId);
  params.append("limit", (options?.limit || 5).toString());
  params.append("mode", options?.mode || "cadence");
  if (options?.excludeIds) {
    for (const id of options.excludeIds) {
      params.append("exclude_ids", id);
    }
  }
  const res = await fetch(`${BASE_URL}/shuffle/?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load shuffle batch");
  return res.json();
}

export async function submitReview(
  problemId: string,
  submission: ReviewSubmission
): Promise<Problem> {
  const res = await fetch(`${BASE_URL}/problems/${problemId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error("Failed to submit review");
  return res.json();
}

export async function exportBackup(): Promise<BackupPayload> {
  const res = await fetch(`${BASE_URL}/backup/export`);
  if (!res.ok) throw new Error("Failed to export backup");
  return res.json();
}

export async function importBackup(payload: BackupPayload): Promise<{ status: string; imported_problems: number }> {
  const res = await fetch(`${BASE_URL}/backup/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to import backup");
  return res.json();
}

export async function dumpLocalSnapshot(): Promise<{ status: string; file_path: string }> {
  const res = await fetch(`${BASE_URL}/backup/dump-local`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to dump local snapshot");
  return res.json();
}

export interface SnapshotStatus {
  exists: boolean;
  file_path: string;
  size_bytes: number;
  last_modified: string | null;
  problem_count: number;
}

export async function fetchSnapshotStatus(): Promise<SnapshotStatus> {
  const res = await fetch(`${BASE_URL}/backup/status`);
  if (!res.ok) throw new Error("Failed to fetch snapshot status");
  return res.json();
}

export async function createSnapshotNow(): Promise<{ status: string; snapshot: SnapshotStatus }> {
  const res = await fetch(`${BASE_URL}/backup/snapshot-now`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to create snapshot");
  return res.json();
}

export async function restoreSnapshot(): Promise<{ status: string; restored_problems: number }> {
  const res = await fetch(`${BASE_URL}/backup/restore-snapshot`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to restore snapshot");
  return res.json();
}

// Subtext API functions
export async function fetchSubtexts(params?: {
  category_id?: string;
  tag?: string;
  search?: string;
}): Promise<Subtext[]> {
  const query = new URLSearchParams();
  if (params?.category_id) query.append("category_id", params.category_id);
  if (params?.tag) query.append("tag", params.tag);
  if (params?.search) query.append("search", params.search);

  const url = `${BASE_URL}/subtexts/?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load subtexts");
  return res.json();
}

export async function fetchSubtext(id: string): Promise<Subtext> {
  const res = await fetch(`${BASE_URL}/subtexts/${id}`);
  if (!res.ok) throw new Error("Failed to fetch subtext");
  return res.json();
}

export async function createSubtext(payload: SubtextCreatePayload): Promise<Subtext> {
  const res = await fetch(`${BASE_URL}/subtexts/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create subtext");
  }
  return res.json();
}

export async function updateSubtext(id: string, payload: SubtextUpdatePayload): Promise<Subtext> {
  const res = await fetch(`${BASE_URL}/subtexts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update subtext");
  }
  return res.json();
}

export async function deleteSubtext(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/subtexts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete subtext");
}

export async function reorderSubtexts(orderedIds: string[]): Promise<void> {
  const res = await fetch(`${BASE_URL}/subtexts/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder subtexts");
}

export async function submitSubtextReview(id: string, submission: ReviewSubmission): Promise<Subtext> {
  const res = await fetch(`${BASE_URL}/subtexts/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) throw new Error("Failed to submit subtext review");
  return res.json();
}

export async function fetchSubtextShuffleBatch(params?: {
  categoryId?: string;
  tag?: string;
  limit?: number;
  mode?: string;
}): Promise<Subtext[]> {
  const query = new URLSearchParams();
  if (params?.categoryId) query.append("category_id", params.categoryId);
  if (params?.tag) query.append("tag", params.tag);
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.mode) query.append("mode", params.mode);

  const url = `${BASE_URL}/subtexts/shuffle?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load subtext shuffle batch");
  return res.json();
}



