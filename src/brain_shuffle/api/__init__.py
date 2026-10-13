from fastapi import APIRouter
from brain_shuffle.api.categories import router as categories_router
from brain_shuffle.api.problems import router as problems_router
from brain_shuffle.api.shuffle import router as shuffle_router
from brain_shuffle.api.backup import router as backup_router
from brain_shuffle.api.companies import router as companies_router
from brain_shuffle.api.review_lists import router as review_lists_router
from brain_shuffle.api.subtexts import router as subtexts_router

api_router = APIRouter(prefix="/api")
api_router.include_router(categories_router)
api_router.include_router(problems_router)
api_router.include_router(subtexts_router)
api_router.include_router(shuffle_router)
api_router.include_router(backup_router)
api_router.include_router(companies_router)
api_router.include_router(review_lists_router)

__all__ = ["api_router"]
