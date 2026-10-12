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
  return s === "coding" || s.startsWith("system_design") || s.startsWith("system-design");
};
