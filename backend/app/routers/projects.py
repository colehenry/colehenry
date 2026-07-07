from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_email, require_owner
from app.models import Project, User, Visibility
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _is_owner(request: Request) -> bool:
    email = get_current_email(request)
    return email is not None and email.lower() == get_settings().owner_email.lower()


@router.get("", response_model=list[ProjectOut])
def list_projects(request: Request, db: Session = Depends(get_db)):
    """Public reads. Non-owners only see public projects."""
    query = select(Project).order_by(Project.sort_order, Project.id)
    if not _is_owner(request):
        query = query.where(Project.visibility == Visibility.public)
    return db.execute(query).scalars().all()


@router.get("/{slug}", response_model=ProjectOut)
def get_project(slug: str, request: Request, db: Session = Depends(get_db)):
    project = db.execute(
        select(Project).where(Project.slug == slug)
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.visibility != Visibility.public and not _is_owner(request):
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    exists = db.execute(
        select(Project).where(Project.slug == body.slug)
    ).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="Slug already exists")
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
