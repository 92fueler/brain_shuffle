export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface Problem {
  id: string;
  category_id: string;
  title: string;
  prompt: string;
  notes: string;
  tags: string[];
  companies: string[];
  review_count: number;
  retention_score: number;
  cadence?: string;
  is_starred?: boolean;
  is_difficult?: boolean;
  sort_order?: number;
  last_reviewed_at?: string | null;
  next_review_due?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProblemCreatePayload {
  category_id: string;
  title: string;
  prompt: string;
  notes: string;
  tags: string[];
  companies: string[];
  cadence?: string;
  is_starred?: boolean;
  is_difficult?: boolean;
}

export type ReviewAction =
  | "drill_soon"
  | "intra_week"
  | "weekly"
  | "skip_park"
  | "again"
  | "hard"
  | "good"
  | "easy";

export interface ReviewSubmission {
  rating: ReviewAction;
  time_spent_seconds?: number;
  reflection?: string;
}

export interface CompanyStat {
  name: string;
  problem_count: number;
  coding_count: number;
  system_design_count: number;
  other_count: number;
}

export interface ReviewList {
  id: string;
  name: string;
  company?: string | null;
  description?: string | null;
  created_at: string;
  problem_count: number;
  problem_ids: string[];
}

export interface ReviewListCreatePayload {
  name: string;
  company?: string;
  description?: string;
  problem_ids: string[];
}

export interface BackupPayload {
  version: string;
  exported_at: string;
  categories: {
    slug: string;
    name: string;
    description?: string | null;
    problems: {
      title: string;
      prompt: string;
      notes: string;
      tags: string[];
      companies: string[];
      review_count: number;
      retention_score: number;
      cadence?: string;
      is_starred?: boolean;
      is_difficult?: boolean;
      sort_order?: number;
      last_reviewed_at?: string | null;
      next_review_due?: string | null;
      review_logs?: {
        rating: string;
        time_spent_seconds?: number | null;
        reflection?: string | null;
        reviewed_at: string;
      }[];
    }[];
    subtexts?: {
      title: string;
      original_text: string;
      subtext: string;
      tags: string[];
      cadence?: string;
      is_starred?: boolean;
      is_difficult?: boolean;
      sort_order?: number;
      review_count: number;
      retention_score: number;
      last_reviewed_at?: string | null;
      next_review_due?: string | null;
      review_logs?: {
        rating: string;
        time_spent_seconds?: number | null;
        reflection?: string | null;
        reviewed_at: string;
      }[];
    }[];
  }[];
  review_lists?: {
    name: string;
    company?: string | null;
    description?: string | null;
    problem_titles: string[];
  }[];
}

export const isProblemCategory = (slug?: string | null): boolean => {
  if (!slug) return true;
  const s = slug.toLowerCase();
  return (
    s === "coding" ||
    s.startsWith("coding_") ||
    s.startsWith("coding-") ||
    s.startsWith("system_design") ||
    s.startsWith("system-design")
  );
};

export interface Subtext {
  id: string;
  category_id: string;
  title: string;
  original_text: string;
  subtext: string;
  tags: string[];
  cadence: string;
  is_starred?: boolean;
  is_difficult?: boolean;
  sort_order?: number;
  review_count: number;
  retention_score: number;
  last_reviewed_at?: string | null;
  next_review_due?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubtextCreatePayload {
  category_id: string;
  title: string;
  original_text: string;
  subtext: string;
  tags?: string[];
  cadence?: string;
  is_starred?: boolean;
  is_difficult?: boolean;
}

export interface SubtextUpdatePayload {
  category_id?: string;
  title?: string;
  original_text?: string;
  subtext?: string;
  tags?: string[];
  cadence?: string;
  is_starred?: boolean;
  is_difficult?: boolean;
  sort_order?: number;
}

const SUBTEXT_CATEGORY_PREFIXES = [
  "subtext",
  "idiom",
  "phrase",
  "vocab",
  "cinema",
  "dialogue",
  "conversation",
  "news",
];

export const isSubtextCategory = (slug?: string | null): boolean => {
  if (!slug) return false;
  const s = slug.toLowerCase();
  return SUBTEXT_CATEGORY_PREFIXES.some((prefix) => s.startsWith(prefix));
};

