from pathlib import Path
from sqlmodel import Session, select
import typer
from brain_shuffle.db import engine, init_db
from brain_shuffle.models.category import Category
from brain_shuffle.models.problem import Problem
from brain_shuffle.models.review_list import ReviewList, ReviewListProblemLink
from brain_shuffle.services.backup_service import BackupService

cli = typer.Typer(help="Brain Shuffle CLI utilities for database operations and serialization backups.")


@cli.command()
def dump(
    output: Path = typer.Option(
        Path("./data/backups/brain_shuffle_backup.json"),
        "--output",
        "-o",
        help="Destination JSON file for serialized database dump",
    ),
) -> None:
    """Dump all categories, problems, and review logs to a serialized JSON file."""
    init_db()
    with Session(engine) as session:
        service = BackupService(session)
        saved = service.dump_to_file(output)
        typer.echo(f"Successfully exported database snapshot to: {saved}")


@cli.command()
def restore(
    input_file: Path = typer.Option(
        ...,
        "--input",
        "-i",
        help="Source JSON file containing serialized data to restore",
    ),
) -> None:
    """Restore database state from a serialized JSON file."""
    if not input_file.exists():
        typer.echo(f"Error: input file '{input_file}' does not exist.", err=True)
        raise typer.Exit(code=1)

    init_db()
    with Session(engine) as session:
        service = BackupService(session)
        count = service.load_from_file(input_file)
        typer.echo(f"Successfully restored {count} problems from: {input_file}")


@cli.command("seed-demo")
@cli.command("seed")
def seed_demo() -> None:
    """Seed initial categories (Coding, System Design, LLM, VLM) and starter problems with companies."""
    init_db()
    with Session(engine) as session:
        demo_data = [
            {
                "slug": "coding",
                "name": "Coding",
                "description": "Algorithms, data structures, and LeetCode patterns",
                "problems": [
                    {
                        "title": "Two-Pointer: Container With Most Water",
                        "prompt": "How do you achieve O(N) time and O(1) space for Container With Most Water? Which pointer moves at each step and why?",
                        "notes": "Start with left=0, right=len-1. Calculate current area = min(height[l], height[r]) * (r - l). Always move the pointer pointing to the shorter line inward, because moving the taller line can never produce a larger area with a smaller width.",
                        "tags": ["two-pointers", "greedy", "leetcode"],
                        "companies": ["Google", "Meta", "Amazon"],
                    },
                    {
                        "title": "Dynamic Programming: 0/1 Knapsack",
                        "prompt": "Explain the 1D space-optimized recurrence for the 0/1 Knapsack problem. Why must the inner weight loop run backwards?",
                        "notes": "dp[w] = max(dp[w], dp[w - weight[i]] + value[i]). The inner weight loop runs backwards from W down to weight[i] to ensure that each item is used at most once; running forwards would allow unbounded multiple uses (unbounded knapsack).",
                        "tags": ["dp", "knapsack", "optimization"],
                        "companies": ["Google", "ByteDance"],
                    },
                ],
            },
            {
                "slug": "system_design",
                "name": "System Design",
                "description": "Distributed systems, architectural patterns, and scalability",
                "problems": [
                    {
                        "title": "Consistent Hashing & Virtual Nodes",
                        "prompt": "What problem does consistent hashing solve in distributed caching? Why are virtual nodes required?",
                        "notes": "Consistent hashing maps both servers and keys to a 360-degree hash ring. When a node is added or removed, only k/N keys need remapping on average instead of all keys. Virtual nodes (multiple tokens per physical server) prevent hot spots and ensure uniform key distribution across non-uniform hardware.",
                        "tags": ["distributed-systems", "caching", "hashing"],
                        "companies": ["Amazon", "Meta", "Google"],
                    },
                    {
                        "title": "Token Bucket vs Leaky Bucket Rate Limiting",
                        "prompt": "Compare Token Bucket vs Leaky Bucket algorithms for API rate limiting. Which allows bursts?",
                        "notes": "Token bucket adds tokens at a constant rate up to capacity and drops requests when tokens are empty; it permits bursts up to capacity. Leaky bucket processes requests at a strictly constant rate (FIFO queue leaks at constant rate); it smooths traffic and prevents bursts.",
                        "tags": ["rate-limiting", "api-gateway", "reliability"],
                        "companies": ["Stripe", "Uber", "Google"],
                    },
                ],
            },
            {
                "slug": "llm",
                "name": "Large Language Models",
                "description": "Transformer architectures, attention mechanisms, training, and inference",
                "problems": [
                    {
                        "title": "FlashAttention: IO-Aware Tiling",
                        "prompt": "Why does standard attention scale quadratically in memory IO? How does FlashAttention reduce HBM reads/writes without approximation?",
                        "notes": "Standard attention materializes the full N x N attention matrix in slow GPU HBM. FlashAttention divides Q, K, V into tiles that fit in fast SRAM, computes softmax incrementally using the online softmax trick, and avoids storing intermediate N x N attention scores, reducing memory accesses from O(N^2) to O(N).",
                        "tags": ["transformers", "attention", "gpu-memory", "cuda"],
                        "companies": ["OpenAI", "Meta", "Anthropic"],
                    },
                    {
                        "title": "KV Cache During Auto-Regressive Decoding",
                        "prompt": "What is the purpose of the KV Cache in LLM inference? What are its memory implications?",
                        "notes": "During auto-regressive generation, past token representations do not change. Caching past Key and Value tensors avoids recomputing them for every generated token, turning O(N^2) compute into O(N) per step. Memory footprint per request = 2 * layers * heads * head_dim * seq_len * precision bytes.",
                        "tags": ["inference", "kv-cache", "memory"],
                        "companies": ["OpenAI", "Google", "Anthropic"],
                    },
                ],
            },
            {
                "slug": "vlm",
                "name": "Vision-Language Models",
                "description": "Multimodal architectures, visual encoders, projection layers, and alignment",
                "problems": [
                    {
                        "title": "CLIP: Contrastive Dual-Encoder Architecture",
                        "prompt": "How does CLIP train joint image and text representations? What is the loss formulation?",
                        "notes": "CLIP uses separate visual and text encoders to project images and text into a shared embedding space. It trains on batches of (image, text) pairs using symmetric cross-entropy infoNCE loss: maximizing cosine similarity along the diagonal (matching pairs) while minimizing similarity for off-diagonal pairs.",
                        "tags": ["clip", "multimodal", "contrastive-learning"],
                        "companies": ["OpenAI", "Google"],
                    },
                    {
                        "title": "LLaVA: Linear Projection vs Cross-Attention Resamplers",
                        "prompt": "How does LLaVA connect the vision encoder to the LLM? How does this differ from Flamingo / Perceiver resamplers?",
                        "notes": "LLaVA uses a simple linear projection (or 2-layer MLP) to map visual tokens from CLIP ViT into the LLM token embedding dimension, treating them as prefix tokens. Flamingo uses gated cross-attention dense layers with a fixed-length Perceiver resampler.",
                        "tags": ["llava", "vlm", "multimodal-projector"],
                        "companies": ["Meta", "Microsoft"],
                    },
                ],
            },
        ]

        total_problems = 0
        google_problem_ids = []

        for cat_info in demo_data:
            cat = session.exec(select(Category).where(Category.slug == cat_info["slug"])).first()
            if not cat:
                cat = Category(
                    slug=cat_info["slug"],
                    name=cat_info["name"],
                    description=cat_info["description"],
                )
                session.add(cat)
                session.commit()
                session.refresh(cat)

            for p_info in cat_info["problems"]:
                existing = session.exec(
                    select(Problem)
                    .where(Problem.category_id == cat.id)
                    .where(Problem.title == p_info["title"])
                ).first()
                if not existing:
                    problem = Problem(
                        category_id=cat.id,
                        title=p_info["title"],
                        prompt=p_info["prompt"],
                        notes=p_info["notes"],
                        tags=p_info["tags"],
                        companies=p_info["companies"],
                    )
                    session.add(problem)
                    session.commit()
                    session.refresh(problem)
                    total_problems += 1
                    if "Google" in problem.companies:
                        google_problem_ids.append(problem.id)
                else:
                    existing.companies = p_info["companies"]
                    session.add(existing)
                    session.commit()
                    if "Google" in existing.companies:
                        google_problem_ids.append(existing.id)

        # Seed sample persistent review list for Google
        existing_rl = session.exec(select(ReviewList).where(ReviewList.name == "Google High Priority")).first()
        if not existing_rl and google_problem_ids:
            rl = ReviewList(
                name="Google High Priority",
                company="Google",
                description="Coding and System Design questions commonly asked at Google",
            )
            session.add(rl)
            session.commit()
            session.refresh(rl)
            for pid in google_problem_ids:
                session.add(ReviewListProblemLink(review_list_id=rl.id, problem_id=pid))
            session.commit()

        typer.echo(f"Seeded demo categories, {total_problems} problems, and initial review lists successfully.")


if __name__ == "__main__":
    cli()
