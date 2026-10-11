from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from brain_shuffle.api import api_router
from brain_shuffle.config import settings

app = FastAPI(
    title="Brain Shuffle API",
    description="Knowledge retention, active recall, and problem shuffle engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/healthz", tags=["health"])
def healthz() -> dict[str, str]:
    return {"status": "ok", "environment": settings.ENVIRONMENT}


def main() -> None:
    import uvicorn

    uvicorn.run("brain_shuffle.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=True)


if __name__ == "__main__":
    main()
