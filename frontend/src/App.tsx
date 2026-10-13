import { useState, useEffect } from "react";
import type { Category, Problem, CompanyStat, ReviewList, Subtext } from "./types";
import {
  fetchCategories,
  fetchProblems,
  fetchCompanies,
  fetchReviewLists,
  fetchSubtexts,
} from "./api";
import { ShuffleView } from "./components/ShuffleView";
import { ProblemManager } from "./components/ProblemManager";
import { BackupManager } from "./components/BackupManager";
import { Shuffle, BookOpen, Database, Brain } from "lucide-react";
import "./App.css";

type AppTab = "drills" | "entries" | "backups";

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("drills");
  const [categories, setCategories] = useState<Category[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [subtexts, setSubtexts] = useState<Subtext[]>([]);
  const [companies, setCompanies] = useState<CompanyStat[]>([]);
  const [reviewLists, setReviewLists] = useState<ReviewList[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeReviewList, setActiveReviewList] = useState<{
    id: string;
    name: string;
    company?: string | null;
    problem_count?: number;
  } | null>(null);

  const refreshData = async () => {
    try {
      const [cats, probs, comps, lists, subs] = await Promise.all([
        fetchCategories(),
        fetchProblems(),
        fetchCompanies(),
        fetchReviewLists(),
        fetchSubtexts(),
      ]);
      setCategories(cats);
      setProblems(probs);
      setCompanies(comps);
      setReviewLists(lists);
      setSubtexts(subs);
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleStartReviewListShuffle = (
    reviewListId: string,
    name: string,
    company?: string | null,
    problem_count?: number
  ) => {
    setActiveReviewList({ id: reviewListId, name, company, problem_count });
    setSelectedCategory(null);
    setActiveTab("drills");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-brand">
            <div className="brand-icon">
              <Brain size={24} />
            </div>
            <div className="brand-text">
              <h1>BrainShuffle</h1>
              <p className="tagline">Learn anything • Shuffle anytime • Remember longer</p>
            </div>
          </div>

          <nav className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === "drills" ? "active" : ""}`}
              onClick={() => setActiveTab("drills")}
            >
              <Shuffle size={16} />
              <span>Drills</span>
            </button>
            <button
              className={`nav-tab ${activeTab === "entries" ? "active" : ""}`}
              onClick={() => setActiveTab("entries")}
            >
              <BookOpen size={16} />
              <span>Entries ({problems.length + subtexts.length})</span>
            </button>
            <button
              className={`nav-tab ${activeTab === "backups" ? "active" : ""}`}
              onClick={() => setActiveTab("backups")}
            >
              <Database size={16} />
              <span>Backups</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-container">
          {activeTab === "drills" && (
            <ShuffleView
              categories={categories}
              companies={companies}
              allProblems={problems}
              subtexts={subtexts}
              reviewLists={reviewLists}
              activeReviewList={activeReviewList}
              onClearReviewList={() => setActiveReviewList(null)}
              onRefreshReviewLists={refreshData}
            />
          )}

          {activeTab === "entries" && (
            <ProblemManager
              categories={categories}
              problems={problems}
              subtexts={subtexts}
              onRefresh={refreshData}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onStartReviewListShuffle={handleStartReviewListShuffle}
            />
          )}

          {activeTab === "backups" && (
            <BackupManager onRefresh={refreshData} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
