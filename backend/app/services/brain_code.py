"""Read-only GitHub source-code tools for Brain.

The connector is deliberately narrow: repositories are allowlisted, credentials
never enter tool output, reads are bounded, and common secret/generated paths
are excluded from both discovery and retrieval.
"""

import base64
import re
from pathlib import PurePosixPath
from urllib.parse import quote

import httpx

from app.config import get_settings
from app.services.brain_tool_registry import BrainTool

GITHUB_API = "https://api.github.com"
MAX_TREE_ENTRIES = 300
MAX_SEARCH_RESULTS = 10
MAX_FILE_BYTES = 512_000
MAX_LINES_PER_READ = 400
MAX_HISTORY_ITEMS = 20
MAX_DIFF_FILES = 40
MAX_PATCH_CHARS = 2_500
MAX_PR_BODY_CHARS = 6_000
IGNORED_DIRS = {
    ".git",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "vendor",
}
IGNORED_NAMES = {
    "bun.lockb",
    "credentials.json",
    "id_ed25519",
    "id_rsa",
    "package-lock.json",
    "pnpm-lock.yaml",
    "secrets.json",
    "yarn.lock",
}
SECRET_SUFFIXES = {".key", ".p12", ".pem", ".pfx"}


def code_repositories() -> tuple[str, ...]:
    """Canonical, de-duplicated GitHub repository allowlist."""
    configured = (part.strip() for part in get_settings().brain_code_repos.split(","))
    repos: list[str] = []
    seen: set[str] = set()
    for repo in configured:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
            continue
        key = repo.lower()
        if key not in seen:
            seen.add(key)
            repos.append(repo)
    return tuple(repos)


def available() -> bool:
    settings = get_settings()
    return bool(settings.brain_code_github_token and code_repositories())


def _headers(*, text_matches: bool = False) -> dict:
    accept = (
        "application/vnd.github.text-match+json"
        if text_matches
        else "application/vnd.github+json"
    )
    return {
        "Authorization": f"Bearer {get_settings().brain_code_github_token}",
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _allowed_repo(repo: str) -> str:
    match = {candidate.lower(): candidate for candidate in code_repositories()}.get(
        (repo or "").strip().lower()
    )
    if match is None:
        raise ValueError("repository is not in Brain's code allowlist")
    return match


def _normalized_path(path: str, *, allow_empty: bool = False) -> str:
    raw = (path or "").strip()
    if not raw and allow_empty:
        return ""
    parsed = PurePosixPath(raw)
    if not raw or raw.startswith("/") or parsed.is_absolute() or ".." in parsed.parts:
        raise ValueError("invalid repository path")
    return parsed.as_posix()


def path_allowed(path: str) -> bool:
    """Keep credentials, generated output, dependencies, and large lockfiles
    out of both discovery and reads. Safe env templates remain inspectable."""
    try:
        normalized = _normalized_path(path)
    except ValueError:
        return False
    parsed = PurePosixPath(normalized)
    lower_parts = {part.lower() for part in parsed.parts[:-1]}
    name = parsed.name.lower()
    if lower_parts & IGNORED_DIRS or name in IGNORED_DIRS:
        return False
    if name in IGNORED_NAMES or parsed.suffix.lower() in SECRET_SUFFIXES:
        return False
    if name == ".env" or (
        name.startswith(".env.")
        and name not in {".env.example", ".env.sample", ".env.template"}
    ):
        return False
    if name.startswith("credentials.") or name.startswith("secrets."):
        return False
    return True


def _safe_ref(ref: str, field: str = "ref") -> str:
    value = (ref or "").strip()
    if not value or not re.fullmatch(r"[A-Za-z0-9_./:-]+", value):
        raise ValueError(f"invalid {field}")
    if ".." in value or value.startswith(("/", "-")):
        raise ValueError(f"invalid {field}")
    return value


def _bounded_limit(limit: int | None, maximum: int = MAX_HISTORY_ITEMS) -> int:
    return max(1, min(int(limit or 10), maximum))


def _commit_summary(item: dict) -> dict:
    commit = item.get("commit") or {}
    author = commit.get("author") or {}
    committer = commit.get("committer") or {}
    return {
        "sha": item.get("sha"),
        "message": str(commit.get("message") or "")[:2_000],
        "author": author.get("name") or (item.get("author") or {}).get("login"),
        "authored_at": author.get("date"),
        "committed_at": committer.get("date"),
        "parents": [parent.get("sha") for parent in item.get("parents", [])],
        "url": item.get("html_url"),
    }


def _pull_summary(item: dict) -> dict:
    return {
        "number": item.get("number"),
        "title": item.get("title"),
        "state": item.get("state"),
        "draft": bool(item.get("draft")),
        "author": (item.get("user") or {}).get("login"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
        "closed_at": item.get("closed_at"),
        "merged_at": item.get("merged_at"),
        "merge_commit_sha": item.get("merge_commit_sha"),
        "base": (item.get("base") or {}).get("ref"),
        "head": (item.get("head") or {}).get("ref"),
        "url": item.get("html_url"),
    }


def _file_change(item: dict) -> dict | None:
    filename = item.get("filename", "")
    if not path_allowed(filename):
        return None
    patch = item.get("patch")
    clipped_patch = str(patch)[:MAX_PATCH_CHARS] if patch is not None else None
    return {
        "path": filename,
        "previous_path": item.get("previous_filename"),
        "status": item.get("status"),
        "additions": item.get("additions"),
        "deletions": item.get("deletions"),
        "changes": item.get("changes"),
        "patch": clipped_patch,
        "patch_truncated": patch is not None and len(str(patch)) > MAX_PATCH_CHARS,
        "url": item.get("blob_url"),
    }


def _safe_file_changes(items: list[dict]) -> list[dict]:
    changes: list[dict] = []
    for item in items:
        change = _file_change(item)
        if change is not None:
            changes.append(change)
        if len(changes) >= MAX_DIFF_FILES:
            break
    return changes


def _repo_metadata(repo: str) -> dict:
    canonical = _allowed_repo(repo)
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}", headers=_headers(), timeout=20
    )
    response.raise_for_status()
    data = response.json()
    return {
        "repository": canonical,
        "default_branch": data.get("default_branch") or "main",
        "private": bool(data.get("private")),
        "updated_at": data.get("updated_at"),
    }


def list_repositories() -> dict:
    return {"repositories": list(code_repositories())}


def list_tree(repo: str, path: str = "", ref: str = "") -> dict:
    canonical = _allowed_repo(repo)
    prefix = _normalized_path(path, allow_empty=True)
    selected_ref = (ref or "").strip() or _repo_metadata(canonical)["default_branch"]

    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/git/trees/{quote(selected_ref, safe='')}",
        params={"recursive": "1"},
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()

    entries = []
    matched_count = 0
    prefix_with_slash = f"{prefix.rstrip('/')}/" if prefix else ""
    for entry in payload.get("tree", []):
        entry_path = entry.get("path", "")
        if prefix and entry_path != prefix and not entry_path.startswith(prefix_with_slash):
            continue
        if not path_allowed(entry_path):
            continue
        matched_count += 1
        if len(entries) >= MAX_TREE_ENTRIES:
            continue
        entries.append(
            {
                "path": entry_path,
                "type": "file" if entry.get("type") == "blob" else "directory",
                "size": entry.get("size"),
                "sha": entry.get("sha"),
            }
        )
    return {
        "repository": canonical,
        "ref": selected_ref,
        "tree_sha": payload.get("sha"),
        "path": prefix,
        "entries": entries,
        "truncated": bool(payload.get("truncated")) or matched_count > len(entries),
    }


def search(
    repo: str,
    query: str,
    path: str = "",
    extensions: list[str] | None = None,
) -> dict:
    canonical = _allowed_repo(repo)
    term = (query or "").strip()
    if not term:
        raise ValueError("search query is required")
    prefix = _normalized_path(path, allow_empty=True)
    qualifiers = [term, f"repo:{canonical}"]
    if prefix:
        qualifiers.append(f"path:{prefix}")
    for extension in (extensions or [])[:5]:
        cleaned = str(extension).strip().lstrip(".")
        if re.fullmatch(r"[A-Za-z0-9_+-]+", cleaned):
            qualifiers.append(f"extension:{cleaned}")

    response = httpx.get(
        f"{GITHUB_API}/search/code",
        params={"q": " ".join(qualifiers), "per_page": MAX_SEARCH_RESULTS},
        headers=_headers(text_matches=True),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    matches = []
    for item in payload.get("items", []):
        item_repo = (item.get("repository") or {}).get("full_name", "")
        item_path = item.get("path", "")
        if item_repo.lower() != canonical.lower() or not path_allowed(item_path):
            continue
        fragments = [
            str(match.get("fragment", ""))[:800]
            for match in (item.get("text_matches") or [])[:3]
            if match.get("fragment")
        ]
        matches.append(
            {
                "path": item_path,
                "sha": item.get("sha"),
                "url": item.get("html_url"),
                "fragments": fragments,
            }
        )
    return {
        "repository": canonical,
        "query": term,
        "total_count": payload.get("total_count", len(matches)),
        "matches": matches,
    }


def read(
    repo: str,
    path: str,
    ref: str = "",
    start_line: int = 1,
    end_line: int | None = None,
) -> dict:
    canonical = _allowed_repo(repo)
    normalized = _normalized_path(path)
    if not path_allowed(normalized):
        raise ValueError("file is excluded from Brain's code tools")

    start = max(1, int(start_line or 1))
    requested_end = (
        int(end_line) if end_line is not None else start + MAX_LINES_PER_READ - 1
    )
    end = max(start, min(requested_end, start + MAX_LINES_PER_READ - 1))
    params = {"ref": ref.strip()} if ref and ref.strip() else None
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/contents/{quote(normalized, safe='/')}",
        params=params,
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or payload.get("type") != "file":
        raise ValueError("path does not identify a file")
    if int(payload.get("size") or 0) > MAX_FILE_BYTES:
        raise ValueError("file is too large for Brain's code tools")
    if payload.get("encoding") != "base64" or not payload.get("content"):
        raise ValueError("GitHub did not return readable file content")

    raw = base64.b64decode(payload["content"])
    if b"\x00" in raw:
        raise ValueError("binary files are not readable by Brain")
    lines = raw.decode("utf-8", "replace").splitlines()
    selected = lines[start - 1 : end]
    numbered = "\n".join(
        f"{line_number}: {line}"
        for line_number, line in enumerate(selected, start=start)
    )
    actual_end = start + len(selected) - 1 if selected else start - 1
    return {
        "repository": canonical,
        "path": normalized,
        "ref": (ref or "default branch").strip(),
        "sha": payload.get("sha"),
        "start_line": start,
        "end_line": actual_end,
        "total_lines": len(lines),
        "truncated": actual_end < len(lines),
        "content": numbered,
    }


def list_commits(repo: str, branch: str = "", limit: int = 10) -> dict:
    canonical = _allowed_repo(repo)
    selected_branch = (
        _safe_ref(branch, "branch")
        if (branch or "").strip()
        else _repo_metadata(canonical)["default_branch"]
    )
    count = _bounded_limit(limit)
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/commits",
        params={"sha": selected_branch, "per_page": count},
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return {
        "repository": canonical,
        "branch": selected_branch,
        "commits": [_commit_summary(item) for item in response.json()[:count]],
    }


def get_commit(repo: str, ref: str) -> dict:
    canonical = _allowed_repo(repo)
    selected_ref = _safe_ref(ref)
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/commits/{quote(selected_ref, safe='')}",
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    raw_files = payload.get("files") or []
    safe_files = _safe_file_changes(raw_files)
    return {
        "repository": canonical,
        "commit": _commit_summary(payload),
        "stats": payload.get("stats") or {},
        "files": safe_files,
        "files_truncated": len(safe_files) < len(raw_files),
    }


def compare_refs(repo: str, base: str, head: str) -> dict:
    canonical = _allowed_repo(repo)
    base_ref = _safe_ref(base, "base ref")
    head_ref = _safe_ref(head, "head ref")
    response = httpx.get(
        (
            f"{GITHUB_API}/repos/{canonical}/compare/"
            f"{quote(base_ref, safe='')}...{quote(head_ref, safe='')}"
        ),
        headers=_headers(),
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    raw_files = payload.get("files") or []
    commits = payload.get("commits") or []
    safe_files = _safe_file_changes(raw_files)
    return {
        "repository": canonical,
        "base": base_ref,
        "head": head_ref,
        "status": payload.get("status"),
        "ahead_by": payload.get("ahead_by"),
        "behind_by": payload.get("behind_by"),
        "total_commits": payload.get("total_commits"),
        "commits": [_commit_summary(item) for item in commits[-MAX_HISTORY_ITEMS:]],
        "files": safe_files,
        "files_truncated": len(safe_files) < len(raw_files),
        "url": payload.get("html_url"),
    }


def list_pull_requests(
    repo: str,
    state: str = "open",
    base: str = "",
    limit: int = 10,
) -> dict:
    canonical = _allowed_repo(repo)
    selected_state = (state or "open").strip().lower()
    if selected_state not in {"open", "closed", "all"}:
        raise ValueError("pull request state must be open, closed, or all")
    count = _bounded_limit(limit)
    params: dict = {
        "state": selected_state,
        "sort": "updated",
        "direction": "desc",
        "per_page": count,
    }
    selected_base = ""
    if (base or "").strip():
        selected_base = _safe_ref(base, "base branch")
        params["base"] = selected_base
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/pulls",
        params=params,
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    return {
        "repository": canonical,
        "state": selected_state,
        "base": selected_base or None,
        "pull_requests": [_pull_summary(item) for item in response.json()[:count]],
    }


def list_recent_merges(
    repo: str,
    branch: str = "",
    limit: int = 10,
) -> dict:
    canonical = _allowed_repo(repo)
    selected_branch = (
        _safe_ref(branch, "branch")
        if (branch or "").strip()
        else _repo_metadata(canonical)["default_branch"]
    )
    count = _bounded_limit(limit)
    response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/pulls",
        params={
            "state": "closed",
            "base": selected_branch,
            "sort": "updated",
            "direction": "desc",
            "per_page": 100,
        },
        headers=_headers(),
        timeout=30,
    )
    response.raise_for_status()
    merged = [item for item in response.json() if item.get("merged_at")]
    merged.sort(key=lambda item: item.get("merged_at") or "", reverse=True)
    return {
        "repository": canonical,
        "branch": selected_branch,
        "merges": [_pull_summary(item) for item in merged[:count]],
    }


def get_pull_request(repo: str, number: int) -> dict:
    canonical = _allowed_repo(repo)
    pull_number = int(number)
    if pull_number < 1:
        raise ValueError("pull request number must be positive")
    detail_response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/pulls/{pull_number}",
        headers=_headers(),
        timeout=30,
    )
    detail_response.raise_for_status()
    files_response = httpx.get(
        f"{GITHUB_API}/repos/{canonical}/pulls/{pull_number}/files",
        params={"per_page": 100},
        headers=_headers(),
        timeout=30,
    )
    files_response.raise_for_status()
    payload = detail_response.json()
    raw_files = files_response.json()
    safe_files = _safe_file_changes(raw_files)
    return {
        "repository": canonical,
        "pull_request": _pull_summary(payload),
        "body": str(payload.get("body") or "")[:MAX_PR_BODY_CHARS],
        "additions": payload.get("additions"),
        "deletions": payload.get("deletions"),
        "changed_files": payload.get("changed_files"),
        "commits": payload.get("commits"),
        "files": safe_files,
        "files_truncated": len(safe_files) < len(raw_files),
    }


def _object_schema(properties: dict, required: tuple[str, ...] = ()) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": False,
    }


def tools() -> list[BrainTool]:
    """LLM schemas and handlers for this connector."""
    return [
        BrainTool(
            name="list_code_repositories",
            description="List the private source-code repositories Brain is allowed to inspect.",
            parameters=_object_schema({}),
            handler=lambda db, args: list_repositories(),
            label=lambda db, args: "listing code repositories",
            available=available,
        ),
        BrainTool(
            name="list_code_tree",
            description=(
                "List files and directories in an allowlisted source-code repository. "
                "Use a path to narrow large repositories. Generated, dependency, lock, "
                "credential, and secret files are excluded."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "path": {"type": "string", "description": "Optional repository-relative prefix."},
                    "ref": {"type": "string", "description": "Optional branch, tag, or commit SHA."},
                },
                ("repo",),
            ),
            handler=lambda db, args: list_tree(
                args.get("repo", ""), args.get("path", ""), args.get("ref", "")
            ),
            label=lambda db, args: (
                f"browsing {args.get('repo', '')}"
                + (f"/{args.get('path')}" if args.get("path") else "")
            ),
            available=available,
        ),
        BrainTool(
            name="search_code",
            description=(
                "Search code in one allowlisted GitHub repository. Returns matching paths and "
                "small fragments; follow up with read_code before drawing conclusions."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "query": {"type": "string", "description": "Symbol, text, or code to find."},
                    "path": {"type": "string", "description": "Optional repository-relative prefix."},
                    "extensions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 5,
                        "description": "Optional extensions such as py, ts, or tsx.",
                    },
                },
                ("repo", "query"),
            ),
            handler=lambda db, args: search(
                args.get("repo", ""),
                args.get("query", ""),
                args.get("path", ""),
                args.get("extensions"),
            ),
            label=lambda db, args: (
                f'searching {args.get("repo", "")} for "{args.get("query", "")}"'
            ),
            available=available,
        ),
        BrainTool(
            name="read_code",
            description=(
                "Read up to 400 numbered lines from one text file in an allowlisted source-code "
                "repository. Credential, secret, generated, dependency, lock, binary, and "
                "oversized files are refused."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "path": {"type": "string", "description": "Repository-relative file path."},
                    "ref": {"type": "string", "description": "Optional branch, tag, or commit SHA."},
                    "start_line": {"type": "integer", "minimum": 1},
                    "end_line": {"type": "integer", "minimum": 1},
                },
                ("repo", "path"),
            ),
            handler=lambda db, args: read(
                args.get("repo", ""),
                args.get("path", ""),
                args.get("ref", ""),
                args.get("start_line", 1),
                args.get("end_line"),
            ),
            label=lambda db, args: (
                f"reading {args.get('repo', '')}/{args.get('path', '')}"
                + (f":{args.get('start_line')}" if args.get("start_line") else "")
            ),
            available=available,
        ),
        BrainTool(
            name="list_commits",
            description=(
                "List the newest commits on a branch in an allowlisted repository. "
                "Use this for recent commit history; use get_commit to inspect a commit's diff."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "branch": {"type": "string", "description": "Branch name; defaults to the repository default."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_HISTORY_ITEMS},
                },
                ("repo",),
            ),
            handler=lambda db, args: list_commits(
                args.get("repo", ""), args.get("branch", ""), args.get("limit", 10)
            ),
            label=lambda db, args: (
                f"checking recent commits in {args.get('repo', '')}"
                + (f"/{args.get('branch')}" if args.get("branch") else "")
            ),
            available=available,
        ),
        BrainTool(
            name="get_commit",
            description=(
                "Get one commit's metadata, statistics, changed files, and bounded patches. "
                "Use the SHA returned by list_commits or a known ref."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "ref": {"type": "string", "description": "Commit SHA, branch, or tag."},
                },
                ("repo", "ref"),
            ),
            handler=lambda db, args: get_commit(args.get("repo", ""), args.get("ref", "")),
            label=lambda db, args: (
                f"reading commit {str(args.get('ref', ''))[:12]} in {args.get('repo', '')}"
            ),
            available=available,
        ),
        BrainTool(
            name="compare_refs",
            description=(
                "Compare two branches, tags, or commit SHAs in one allowlisted repository. "
                "Returns ahead/behind counts, commits, changed files, and bounded patches."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "base": {"type": "string", "description": "Base branch, tag, or SHA."},
                    "head": {"type": "string", "description": "Head branch, tag, or SHA."},
                },
                ("repo", "base", "head"),
            ),
            handler=lambda db, args: compare_refs(
                args.get("repo", ""), args.get("base", ""), args.get("head", "")
            ),
            label=lambda db, args: (
                f"comparing {args.get('base', '')}…{args.get('head', '')} "
                f"in {args.get('repo', '')}"
            ),
            available=available,
        ),
        BrainTool(
            name="list_pull_requests",
            description=(
                "List recent open, closed, or all pull requests in an allowlisted repository. "
                "Optionally filter by base branch. Use list_recent_merges for merged PRs."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "state": {"type": "string", "enum": ["open", "closed", "all"]},
                    "base": {"type": "string", "description": "Optional base branch."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_HISTORY_ITEMS},
                },
                ("repo",),
            ),
            handler=lambda db, args: list_pull_requests(
                args.get("repo", ""),
                args.get("state", "open"),
                args.get("base", ""),
                args.get("limit", 10),
            ),
            label=lambda db, args: f"checking pull requests in {args.get('repo', '')}",
            available=available,
        ),
        BrainTool(
            name="list_recent_merges",
            description=(
                "List the most recently merged pull requests into a branch, ordered by merge "
                "time. This is the primary tool for questions about the latest merge into main."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "branch": {"type": "string", "description": "Base branch; defaults to the repository default."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_HISTORY_ITEMS},
                },
                ("repo",),
            ),
            handler=lambda db, args: list_recent_merges(
                args.get("repo", ""), args.get("branch", ""), args.get("limit", 10)
            ),
            label=lambda db, args: (
                f"checking recent merges into {args.get('branch') or 'the default branch'} "
                f"in {args.get('repo', '')}"
            ),
            available=available,
        ),
        BrainTool(
            name="get_pull_request",
            description=(
                "Get one pull request's details, description, statistics, changed files, and "
                "bounded patches. Use it after list_pull_requests or list_recent_merges."
            ),
            parameters=_object_schema(
                {
                    "repo": {"type": "string", "description": "Exact owner/repository name."},
                    "number": {"type": "integer", "minimum": 1},
                },
                ("repo", "number"),
            ),
            handler=lambda db, args: get_pull_request(
                args.get("repo", ""), args.get("number", 0)
            ),
            label=lambda db, args: (
                f"reading PR #{args.get('number', '')} in {args.get('repo', '')}"
            ),
            available=available,
        ),
    ]
