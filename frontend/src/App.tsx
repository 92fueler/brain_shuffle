import { useState, useEffect } from "react";
import type { Category, Problem, CompanyStat, ReviewList } from "./types";
import { fetchCategories, fetchProblems, fetchCompanies, fetchReviewLists } from "./api";
import { ShuffleView } from "./components/ShuffleView";
import { ProblemManager } from "./components/ProblemManager";
import { BackupManager } from "./components/BackupManager";
import { Shuffle, BookOpen, Database, Brain } from "lucide-react";
import "./App.css";

export function App() {
  const [activeTab, setActiveTab] = useState<"shuffle" | "problems" | "backup">("shuffle");
  const [categories, setCategories] = useState<Category[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
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
      const [cats, probs, comps, lists] = await Promise.all([
        fetchCategories(),
        fetchProblems(),
        fetchCompanies(),
        fetchReviewLists(),
      ]);
      setCategories(cats);
      setProblems(probs);
      setCompanies(comps);
      setReviewLists(lists);
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
    setActiveTab("shuffle");
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <Brain size={28} />
          </div>
          <div className="brand-text">
            <h1>Brain Shuffle</h1>
            <p className="tagline">Learn anything • Shuffle anytime • Remember longer</p>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === "shuffle" ? "active" : ""}`}
            onClick={() => setActiveTab("shuffle")}
          >
            <Shuffle size={18} />
            <span>Shuffle Test</span>
          </button>
          <button
            className={`nav-tab ${activeTab === "problems" ? "active" : ""}`}
            onClick={() => setActiveTab("problems")}
          >
            <BookOpen size={18} />
            <span>Problems ({problems.length})</span>
          </button>
          <button
            className={`nav-tab ${activeTab === "backup" ? "active" : ""}`}
            onClick={() => setActiveTab("backup")}
          >
            <Database size={18} />
            <span>Backup & Recovery</span>
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === "shuffle" && (
          <ShuffleView
            categories={categories}
            companies={companies}
            reviewLists={reviewLists}
            activeReviewList={activeReviewList}
            onClearReviewList={() => setActiveReviewList(null)}
            onRefreshReviewLists={refreshData}
          />
        )}

        {activeTab === "problems" && (
          <ProblemManager
            categories={categories}
            problems={problems}
            onRefresh={refreshData}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onStartReviewListShuffle={handleStartReviewListShuffle}
          />
        )}

        {activeTab === "backup" && (
          <BackupManager onRefresh={refreshData} />
        )}
      </main>
    </div>
  );
}

export default App;
