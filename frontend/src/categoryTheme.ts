export interface CategoryTheme {
  color: string;
  bg: string;
  border: string;
  style: {
    color: string;
    backgroundColor: string;
    borderColor: string;
  };
}

/**
 * Format category names to proper Capitalized Title Case:
 * e.g., "coding" -> "Coding", "python" -> "Python", "system_design" -> "System Design".
 * Preserves common technical uppercase acronyms like AWS, SQL, ML, OS, AI.
 */
export function formatCategoryName(name?: string | null): string {
  if (!name || !name.trim()) return "Problem";
  const clean = name.trim().replace(/_/g, " ");

  return clean
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      const upper = word.toUpperCase();
      // Keep acronyms intact
      if (word.length > 1 && word === upper) {
        return word;
      }
      if (upper === "AWS" || upper === "SQL" || upper === "ML" || upper === "AI" || upper === "OS" || upper === "API") {
        return upper;
      }
      if (word.toLowerCase() === "devops") {
        return "DevOps";
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Preset color configurations for standard technical domains
const PRESET_THEMES: Record<string, { color: string; bg: string; border: string }> = {
  // Coding / LeetCode / Algorithms: Indigo
  coding: {
    color: "#a5b4fc",
    bg: "rgba(99, 102, 241, 0.15)",
    border: "rgba(99, 102, 241, 0.35)",
  },
  // Python: Emerald / Mint Green (distinct from Indigo)
  python: {
    color: "#6ee7b7",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  // System Design / Architecture: Soft Purple
  system_design: {
    color: "#d8b4fe",
    bg: "rgba(168, 85, 247, 0.15)",
    border: "rgba(168, 85, 247, 0.35)",
  },
  "system-design": {
    color: "#d8b4fe",
    bg: "rgba(168, 85, 247, 0.15)",
    border: "rgba(168, 85, 247, 0.35)",
  },
  // Databases / SQL: Cyan
  database: {
    color: "#67e8f9",
    bg: "rgba(6, 182, 212, 0.15)",
    border: "rgba(6, 182, 212, 0.35)",
  },
  sql: {
    color: "#67e8f9",
    bg: "rgba(6, 182, 212, 0.15)",
    border: "rgba(6, 182, 212, 0.35)",
  },
  // Machine Learning / AI / LLMs: Rose
  ml: {
    color: "#fda4af",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  ai: {
    color: "#fda4af",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  llm: {
    color: "#fda4af",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  vlm: {
    color: "#fda4af",
    bg: "rgba(244, 63, 94, 0.15)",
    border: "rgba(244, 63, 94, 0.35)",
  },
  // DevOps / Infrastructure / SRE / Cloud: Amber
  devops: {
    color: "#fcd34d",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  infra: {
    color: "#fcd34d",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  sre: {
    color: "#fcd34d",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  // JavaScript / TypeScript / Web: Yellow / Gold
  javascript: {
    color: "#fde047",
    bg: "rgba(234, 179, 8, 0.15)",
    border: "rgba(234, 179, 8, 0.35)",
  },
  typescript: {
    color: "#93c5fd",
    bg: "rgba(59, 130, 246, 0.15)",
    border: "rgba(59, 130, 246, 0.35)",
  },
  // Low-level / Systems: Sky
  cpp: {
    color: "#7dd3fc",
    bg: "rgba(14, 165, 233, 0.15)",
    border: "rgba(14, 165, 233, 0.35)",
  },
  rust: {
    color: "#fdba74",
    bg: "rgba(249, 115, 22, 0.15)",
    border: "rgba(249, 115, 22, 0.35)",
  },
  // Subtext & Universal Journaling: Indigo / Violet
  subtext: {
    color: "#a78bfa",
    bg: "rgba(139, 92, 246, 0.15)",
    border: "rgba(139, 92, 246, 0.35)",
  },
  subtexts: {
    color: "#a78bfa",
    bg: "rgba(139, 92, 246, 0.15)",
    border: "rgba(139, 92, 246, 0.35)",
  },
  // Idioms & Phrases: Warm Amber
  idioms: {
    color: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  idiom: {
    color: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  phrases: {
    color: "#f472b6",
    bg: "rgba(236, 72, 153, 0.15)",
    border: "rgba(236, 72, 153, 0.35)",
  },
  // Vocabulary: Mint Emerald
  vocabulary: {
    color: "#34d399",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  vocab: {
    color: "#34d399",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.35)",
  },
  // Cinema & Movies: Electric Sky
  cinema: {
    color: "#38bdf8",
    bg: "rgba(14, 165, 233, 0.15)",
    border: "rgba(14, 165, 233, 0.35)",
  },
  movies: {
    color: "#38bdf8",
    bg: "rgba(14, 165, 233, 0.15)",
    border: "rgba(14, 165, 233, 0.35)",
  },
  // Spoken Dialogue & Conversations: Cyan / Teal
  conversations: {
    color: "#2dd4bf",
    bg: "rgba(20, 184, 166, 0.15)",
    border: "rgba(20, 184, 166, 0.35)",
  },
  dialogue: {
    color: "#2dd4bf",
    bg: "rgba(20, 184, 166, 0.15)",
    border: "rgba(20, 184, 166, 0.35)",
  },
  // News Analysis: Soft Purple
  news: {
    color: "#c084fc",
    bg: "rgba(168, 85, 247, 0.15)",
    border: "rgba(168, 85, 247, 0.35)",
  },
};

// Deterministic dynamic fallback palette for arbitrary user-created categories
const DYNAMIC_PALETTE = [
  { color: "#7dd3fc", bg: "rgba(14, 165, 233, 0.15)", border: "rgba(14, 165, 233, 0.35)" }, // Sky
  { color: "#f472b6", bg: "rgba(236, 72, 153, 0.15)", border: "rgba(236, 72, 153, 0.35)" }, // Pink
  { color: "#fdba74", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.35)" }, // Orange
  { color: "#5eead4", bg: "rgba(20, 184, 166, 0.15)", border: "rgba(20, 184, 166, 0.35)" }, // Teal
  { color: "#c4b5fd", bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.35)" }, // Violet
  { color: "#bef264", bg: "rgba(132, 204, 22, 0.15)", border: "rgba(132, 204, 22, 0.35)" }, // Lime
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Get distinct color palette and inline styles for a category based on slug or name.
 */
export function getCategoryTheme(slugOrName?: string | null): CategoryTheme {
  const key = (slugOrName || "coding").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const preset = PRESET_THEMES[key];
  if (preset) {
    return {
      ...preset,
      style: {
        color: preset.color,
        backgroundColor: preset.bg,
        borderColor: preset.border,
      },
    };
  }

  // Deterministic fallback based on string hash for custom user categories
  const index = hashString(key) % DYNAMIC_PALETTE.length;
  const picked = DYNAMIC_PALETTE[index];
  return {
    ...picked,
    style: {
      color: picked.color,
      backgroundColor: picked.bg,
      borderColor: picked.border,
    },
  };
}
