# Brain Shuffle Architecture & Design

## 1) Vision & Cognitive Foundation

Brain Shuffle is a knowledge retention and active recall platform engineered for software engineers and technical practitioners preparing for technical interviews and domain mastery across computer science and artificial intelligence (`coding`, `system_design`, `python`, `llm`, `vlm`).

### The Limitations of Traditional Spaced Repetition
Traditional spaced repetition software (such as Anki or SuperMemo) was formulated around discrete flashcards (vocabulary, historical facts, medical terms). Applied to software engineering, this paradigm exhibits several structural shortcomings:
- **Passive Recognition Trap**: Presenting a problem with pre-written context prompts the brain to recognize patterns rather than synthesize solutions from first principles.
- **Lack of Coding Formulation**: Engineers must formulate syntax, logic, and architectural trade-offs; reading an answer card does not exercise actual recall.
- **Calendar-Day Debt**: Fixed daily intervals accumulate demoralizing backlogs when a user pauses for several days, leading to review abandonment.
- **Disconnection from Target Domains**: Study in software engineering is contextual (e.g., preparing for an upcoming company interview loop, drilling Python syntax nuances, or studying distributed consensus). Rigid card decks lack dynamic, targeted composition.

### Core Architectural Principles
To solve these limitations, the system establishes four fundamental design principles:

1. **Title-First Active Recall**: Review begins strictly with the problem title or conceptual prompt. All hints, constraints, and solutions remain concealed until the user actively attempts retrieval.
2. **Active Synthesis Workspace**: For interview problems, an embedded multi-language code scratchpad provides a live environment to draft syntax or pseudo-code before revealing answers. For knowledge notes, the interface strips all distractions to present only the core prompt.
3. **Rolling Intent-Driven Cadence**: Reviews are scheduled using forward-looking user intent (`Drill Soon`, `Mid-Week`, `Next Week`, `Skip / Park`) across continuous rolling-time horizons rather than retrospective difficulty scores, eliminating calendar-day backlogs.
4. **On-Demand Targeted Decks**: Problems are tagged with topics and companies, allowing the shuffle engine to dynamically compile company loops, domain tracks, or custom saved decks on demand.

```mermaid
flowchart LR
    A["Problem / Note Ingestion"] --> B["Storage Layer (WAL SQLite)"]
    B --> C["Shuffle Engine (Rolling Cadence + Anti-Clustering)"]
    C --> D["Active Recall Cockpit (Title-First Presentation)"]
    D --> E["Active Retrieval / Code Formulation"]
    E --> F["Progressive Reveal (Hints & Notes)"]
    F --> G["Intent Cadence Selection (Drill Soon / Mid-Week / Weekly / Park)"]
    G --> B
    B -.-> H["Atomic Snapshots (VACUUM INTO)"]
```

---

## 2) System Model & Knowledge Tracks

The platform organizes learning materials into two specialized tracks, recognizing that algorithmic challenges and conceptual trivia demand fundamentally different cognitive workflows.

```mermaid
flowchart TD
    subgraph TrackDetection ["Category Classification Engine"]
        CatSelect["Item Category"]
        CheckTrack{"Slug is 'coding' or\n'system_design'?"}
        CatSelect --> CheckTrack
    end

    subgraph ProblemTrack ["Interview Problem Track"]
        PFields["Metadata: Title, Target Companies, Subtopic Tags, Hints, Reference Notes"]
        PUI["Recall: Title $\to$ Code Editor Scratchpad $\to$ Hints/Notes Reveal $\to$ Rating"]
    end

    subgraph NoteTrack ["Active Recall Note Track"]
        NFields["Metadata: Concept Prompt + Key Takeaway (Zero Companies, Zero Tags)"]
        NUI["Recall: Prompt Only $\to$ Reveal Key Takeaway $\to$ Rating"]
    end

    CheckTrack -->|Yes| PFields
    CheckTrack -->|No| NFields
    PFields --> PUI
    NFields --> NUI
```

### 1. Dual-Track Specifications
1. **Interview Problem Track** (`coding`, `system_design`):
   - Focuses on complex problems requiring algorithmic synthesis or architecture diagrams.
   - Retains full interview metadata: associated target companies, algorithmic subtopic tags, progressive hints, and an embedded code editor.
2. **Active Recall Note Track** (`python`, `cs`, `devops`, `ml`, etc.):
   - Focuses on quick conceptual recall: language syntax nuances, runtime behaviors, gotchas, and definitions.
   - Strips away extraneous fields (companies, tags, separate title fields); the prompt serves as both the question and row label.
   - The review experience presents the prompt in isolation, offering a single action to reveal the key takeaway.

### 2. Category Taxonomy & Visual Hierarchy
Categories structure the domain space and provide visual orientation across all views:
- **Title-Cased Normalization**: Category names are normalized to capitalized title case (e.g., `Coding`, `Python`, `System Design`) while preserving technical acronyms (`AWS`, `SQL`, `ML`, `AI`, `OS`).
- **Color-Coded Badges**: Each category receives a dedicated, high-contrast dark-mode palette (e.g., Indigo for Coding, Emerald for Python, Purple for System Design, Cyan for Database/SQL), ensuring instant visual differentiation in lists and flashcards.
- **Relational Integrity**: Category deletion is guarded by reference checks; categories containing existing problems cannot be deleted until those items are reassigned or removed.

### 3. Conceptual Entity Model

```mermaid
erDiagram
    CATEGORY ||--o{ PROBLEM : categorizes
    PROBLEM ||--o{ REVIEW_LOG : logs
    REVIEW_LIST ||--o{ REVIEW_LIST_PROBLEM : contains
    PROBLEM ||--o{ REVIEW_LIST_PROBLEM : referenced_by

    CATEGORY {
        uuid id
        string slug
        string name
        string description
    }

    PROBLEM {
        uuid id
        uuid category_id
        string title
        text prompt
        text notes
        list tags
        list companies
        int review_count
        float retention_score
        string cadence
        timestamp next_review_due
    }

    REVIEW_LIST {
        uuid id
        string name
        string company
        text description
    }

    REVIEW_LOG {
        uuid id
        uuid problem_id
        string rating
        timestamp reviewed_at
    }
```

---

## 3) User Experience & Workspace Design

The user interface is designed as an application shell that prioritizes stability, visual continuity, and focused ergonomics across its three primary tabs: **Shuffle Test**, **Problems**, and **Backup & Recovery**.

```mermaid
flowchart TD
    subgraph Shell ["Application Shell (Fixed 64px Header + Stable Scroll Gutter)"]
        Nav["Navigation: Brand Identity + Persistent Top-Level Tabs"]
    end

    subgraph Views ["Unified Main Canvas (max-width: 1080px, min-height: calc(100vh - 160px))"]
        Tab1["Shuffle Test: Decks Hub $\longleftrightarrow$ Active Test Room"]
        Tab2["Problems: Filter Toolbar + Category Chips + Problem List"]
        Tab3["Backup & Recovery: Unified Snapshot Dashboard + Migration Drawer"]
    end

    Nav --> Tab1
    Nav --> Tab2
    Nav --> Tab3
```

### 1. Unified Application Shell
To eliminate the layout jumps common in single-page applications, the shell enforces strict geometric consistency:
- **Fixed & Sticky Header**: Pinned at `top: 0` with dark glassmorphism and a fixed 64px height. Navigation tabs remain accessible from any scroll position.
- **Stable Scrollbar Gutter**: Configured with `scrollbar-gutter: stable`, permanently reserving browser scrollbar space to prevent 15px horizontal shifts between tall and short views.
- **Consistent Canvas Dimensions**: All views render within a shared container enforcing a `1080px` maximum width and a minimum viewport height (`min-height: calc(100vh - 160px)`), eliminating vertical bounce when switching tabs.

### 2. Shuffle Test & Decks Hub
The review workspace ([frontend/src/components/ShuffleView.tsx](frontend/src/components/ShuffleView.tsx)) operates as a dual-state cockpit:
- **State A (Decks Hub)**: The landing interface organizes review items into dedicated channels:
  - **Topics & Categories**: Dedicated decks for all domain categories (`Python Deck`, `Coding Deck`, etc.) distinguishing note tracks from problem tracks.
  - **Full Company Loops**: Aggregates all problems associated with specific employers (e.g., Google Full Loop, Amazon Full Loop).
  - **Coding by Company**: Focuses exclusively on algorithms and data structures filtered by target company.
  - **System Design by Company**: Focuses on architecture and distributed systems challenges.
  - **Custom Saved Decks**: Targeted study decks curated directly by the user.
  - **Quick Mix Shuffle**: A universal one-click action that draws a 5-item cross-topic drill.
- **State B (Active Testing Room)**: Presents problems sequentially in [frontend/src/components/ProblemFlashcard.tsx](frontend/src/components/ProblemFlashcard.tsx):
  - Card counter (`Card X of Y`) and session reviewed badge.
  - Bidirectional navigation via header controls or keyboard shortcuts (`ArrowLeft` / `ArrowRight`), automatically bypassing shortcut listeners when typing in code editors or inputs.
  - Immediate exit breadcrumb (`← Decks`) returning to the hub.

### 3. Problem Curation & Multi-Select Deck Building
The curation interface ([frontend/src/components/ProblemManager.tsx](frontend/src/components/ProblemManager.tsx)) combines LeetCode-style efficiency with custom deck compilation:
- **Compact List Rows**: Each row displays an item selection checkbox, color-coded category badge, title, quick actions (edit, delete), and an expansion toggle.
- **In-Place Recall**: Expanding any row mounts the active recall card directly within the list, allowing quick review without navigating away.
- **Multi-Select Deck Authoring**: Selecting multiple problem checkboxes reveals a floating action bar to save the selection as a persistent custom deck or update review cadences in bulk.
- **Non-Dismissive Modal Dialogs**: Creation and editing modals require explicit confirmation (`Save` or `Cancel`), preventing accidental dismissal on backdrop clicks. Textareas support automatic indentation on `Enter` and 4-space indentation on `Tab`.

---

## 4) Rolling Cadence & Shuffle Engine

The platform replaces traditional calendar-date algorithms with an intent-driven rolling cadence engine implemented in [src/brain_shuffle/services/shuffle_engine.py](src/brain_shuffle/services/shuffle_engine.py).

```mermaid
flowchart TD
    ReviewIntent["User Review Intent Action"]
    ReviewIntent --> Daily["Drill Soon (+4 Hours)"]
    ReviewIntent --> IntraWeek["Mid-Week (+2.5 Days)"]
    ReviewIntent --> Weekly["Next Week (+7 Days)"]
    ReviewIntent --> Monthly["Skip / Park (+21 Days)"]

    Daily --> HorizonCalc["Calculate Next Due Horizon (Rolling Continuous Time)"]
    IntraWeek --> HorizonCalc
    Weekly --> HorizonCalc
    Monthly --> HorizonCalc

    HorizonCalc --> Pool["Problem Pool"]
    Pool --> ShuffleEngine["Shuffle Engine Batch Evaluation"]

    subgraph SelectionMechanics ["Batch Selection Criteria"]
        Recency["Recency Ring Buffer (Exclude Last 3 Reviewed Items)"]
        CadenceWeight["Cadence Weighting (Boost Overdue, Attenuate Early)"]
        Interleaving["Anti-Clustering Interleaver (Enforce Topic Diversity)"]
    end

    ShuffleEngine --> SelectionMechanics
    SelectionMechanics --> CandidateBatch["Balanced Study Batch"]
```

### 1. Rolling Action Horizons
Instead of grading memory on a 1-to-5 scale, users declare forward-looking intent:

| Action Intent | Target Cadence | Rolling Horizon | Next Due Interval | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| 🔄 **Drill Soon** | `daily` | Rolling Intra-Day | $+4\text{ hours}$ | Concepts missed or requiring immediate same-day drill |
| 📅 **Mid-Week** | `intra_week` | Rolling Intra-Week | $+60\text{ hours}$ (2.5d) | Near-term consolidation for tricky problems |
| 🗓️ **Next Week** | `weekly` | Rolling Weekly | $+168\text{ hours}$ (7d) | Standard weekly active recall maintenance |
| ⏭️ **Skip / Park** | `monthly` | Rolling Deferred | $+504\text{ hours}$ (21d) | Well-mastered items or low-priority edge cases |

Because due dates are relative to the timestamp of the last review attempt, pausing practice for several days does not create an artificial backlog of hundreds of overdue cards.

### 2. Candidate Selection & Priority Boosting
When constructing a review batch, the engine evaluates candidates using three rules:
1. **Recency Buffer**: Excludes the last 3 reviewed items to eliminate immediate repeats within a study session.
2. **Unreviewed Priority**: Newly ingested items that have never been tested receive a priority boost to ensure prompt initial review.
3. **Overdue Escalation vs. Cooldown Attenuation**:
   - Items whose due dates have passed receive priority boosts scaled to how long they have been due.
   - Items still in their cooldown windows have their selection probability significantly reduced, preventing over-testing.

### 3. Topic Interleaving & Anti-Clustering
To prevent cognitive priming (e.g., solving three tree recursion problems in a row, which tips off the solution method), the engine applies interleaving:
- **Topic Signature**: Inspects tags, category domains, and keywords.
- **Anti-Clustering Penalty**: Successive cards with overlapping tags receive selection penalties. The sequence dynamically alternates between algorithms, architectures, and language concepts to enforce varied practice.

---

## 5) Persistence, Snapshots & Data Reliability

The system uses a local-first storage architecture designed for speed, zero-friction maintenance, and resilience against data corruption.

```mermaid
flowchart LR
    subgraph Operational ["Active Runtime"]
        App["FastAPI Application"]
        DB[("SQLite Database<br/>data/brain_shuffle.db")]
        WAL["Write-Ahead Log<br/>(Concurrent Reads/Writes)"]
        App <--> DB
        DB --- WAL
    end

    subgraph Snapshotting ["Snapshot Engine (VACUUM INTO)"]
        Worker["Async Lifespan Worker / On-Demand"]
        Snapshot[("Compacted Snapshot<br/>data/backups/brain_shuffle_snapshot.db")]
        Rollback[("Rollback Copy<br/>data/brain_shuffle.db.rollback.bak")]
        Worker -->|Atomic Pass| Snapshot
        Snapshot -.->|Modal-Guarded Restore| Rollback
        Rollback -.->|Safe Overwrite| DB
    end
```

### 1. Persistence Engine & Concurrency
- **Primary Engine**: Embedded SQLite at [data/brain_shuffle.db](data/brain_shuffle.db), with optional containerized PostgreSQL fallback configured via [docker-compose.yml](docker-compose.yml).
- **Write-Ahead Logging (WAL)**: Initialized with `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL`. Readers never block writers and writers never block readers, allowing background snapshots to proceed without interrupting live user study.
- **Busy Timeout**: Configured with a 5-second busy timeout to eliminate lock contention.

### 2. Native Compacting Snapshots (`VACUUM INTO`)
Rather than relying on brittle text serialization, backups leverage SQLite's native atomic `VACUUM INTO` command:
- **Atomic File Creation**: The snapshot engine creates a defragmented, byte-level copy of the database at [data/backups/brain_shuffle_snapshot.db](data/backups/brain_shuffle_snapshot.db) in an isolated read transaction.
- **Page Defragmentation**: Reclaims space from deleted problems and re-indexes B-trees into a contiguous file.
- **Zero-Friction Operations**: Backups happen without file dialogs or manual exports.

### 3. Automated Lifecycle & Safety Guardrails
- **Heartbeat Worker**: A background task evaluates database modifications every 30 minutes. If changes have occurred since the last snapshot, a new snapshot is taken automatically.
- **Shutdown Persistence**: Process termination hooks take an immediate snapshot upon server shutdown.
- **Restoration Safety**:
  - Restoring a snapshot requires confirmation through a guarded modal dialog in [frontend/src/components/BackupManager.tsx](frontend/src/components/BackupManager.tsx).
  - Prior to restoration, an automatic rollback copy (`data/brain_shuffle.db.rollback.bak`) is created. If the snapshot is corrupt, the system reverts automatically.
- **Secondary JSON Portability**: A collapsible portability drawer provides JSON export and import for transferring libraries between different operating systems or machines.
