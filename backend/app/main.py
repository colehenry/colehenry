from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.routers import auth, catan, challenges, projects

settings = get_settings()

app = FastAPI(title="colehenry.dev API")

# Session cookie is only used to hold OAuth state during the Google redirect.
app.add_middleware(SessionMiddleware, secret_key=settings.jwt_secret)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catan.router)
app.include_router(challenges.router)
app.include_router(projects.router)


@app.get("/health")
def health():
    return {"ok": True}
