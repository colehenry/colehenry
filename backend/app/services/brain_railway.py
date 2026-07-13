"""Read-only Railway deployment and log tools for Brain.

Only two explicitly configured targets can be queried. Project tokens remain
server-side, project/environment scope is discovered from Railway, deployment
IDs are checked against that scope before details or logs are returned, and log
messages are bounded and redacted. This module intentionally contains no
GraphQL mutations and never reads variables or service configuration.
"""

import re
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services.brain_tool_registry import BrainTool

RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2"
MAX_DEPLOYMENTS = 20
MAX_LOG_LINES = 200
MAX_LOG_MESSAGE_CHARS = 2_000
MAX_LOG_OUTPUT_CHARS = 50_000
MAX_FILTER_CHARS = 200


@dataclass(frozen=True)
class RailwayTarget:
    name: str
    token: str
    service_id: str


def _configured_targets() -> tuple[RailwayTarget, ...]:
    settings = get_settings()
    candidates = (
        RailwayTarget(
            "colehenry",
            settings.brain_railway_colehenry_token.strip(),
            settings.brain_railway_colehenry_service_id.strip(),
        ),
        RailwayTarget(
            "lapwise",
            settings.brain_railway_lapwise_token.strip(),
            settings.brain_railway_lapwise_service_id.strip(),
        ),
    )
    return tuple(target for target in candidates if target.token and target.service_id)


def target_names() -> tuple[str, ...]:
    return tuple(target.name for target in _configured_targets())


def available() -> bool:
    return bool(_configured_targets())


def _target(name: str) -> RailwayTarget:
    requested = (name or "").strip().lower()
    for target in _configured_targets():
        if target.name == requested:
            return target
    raise ValueError("Railway target is not configured in Brain's allowlist")


def _bounded_limit(value: int | None, maximum: int, default: int) -> int:
    return max(1, min(int(value or default), maximum))


def _graphql(target: RailwayTarget, query: str, variables: dict | None = None) -> dict:
    try:
        response = httpx.post(
            RAILWAY_GRAPHQL,
            headers={
                "Project-Access-Token": target.token,
                "Content-Type": "application/json",
            },
            json={"query": query, "variables": variables or {}},
            timeout=30,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ValueError("Railway request failed") from exc

    payload = response.json()
    if payload.get("errors") or not isinstance(payload.get("data"), dict):
        raise ValueError("Railway API returned an error")
    return payload["data"]


def _scope(target: RailwayTarget) -> dict:
    data = _graphql(
        target,
        """
        query BrainRailwayProjectToken {
          projectToken { projectId environmentId }
        }
        """,
    )
    scope = data.get("projectToken") or {}
    project_id = str(scope.get("projectId") or "")
    environment_id = str(scope.get("environmentId") or "")
    if not project_id or not environment_id:
        raise ValueError("Railway project token did not provide project scope")
    return {"project_id": project_id, "environment_id": environment_id}


def _safe_meta(meta: object) -> dict:
    if not isinstance(meta, dict):
        return {}
    aliases = {
        "branch": "branch",
        "commitAuthor": "commit_author",
        "commitHash": "commit_hash",
        "commitMessage": "commit_message",
        "image": "image",
        "repo": "repository",
        "repository": "repository",
        "rootDirectory": "root_directory",
    }
    safe: dict = {}
    for source, destination in aliases.items():
        value = meta.get(source)
        if isinstance(value, (str, int, float, bool)) and value != "":
            safe[destination] = str(value)[:2_000]
    return safe


def _deployment_summary(item: dict) -> dict:
    summary = {
        "id": item.get("id"),
        "status": item.get("status"),
        "created_at": item.get("createdAt"),
        "status_updated_at": item.get("statusUpdatedAt"),
        "url": item.get("url"),
        "static_url": item.get("staticUrl"),
    }
    summary.update(_safe_meta(item.get("meta")))
    return {key: value for key, value in summary.items() if value is not None}


def list_targets() -> dict:
    return {"targets": list(target_names()), "access": "read-only"}


def list_deployments(target_name: str, limit: int = 10, successful_only: bool = False) -> dict:
    target = _target(target_name)
    scope = _scope(target)
    bounded = _bounded_limit(limit, MAX_DEPLOYMENTS, 10)
    data = _graphql(
        target,
        """
        query BrainRailwayDeployments($input: DeploymentListInput!, $first: Int) {
          deployments(input: $input, first: $first) {
            edges {
              node { id status createdAt statusUpdatedAt url staticUrl meta }
            }
          }
        }
        """,
        {
            "input": {
                "projectId": scope["project_id"],
                "environmentId": scope["environment_id"],
                "serviceId": target.service_id,
            },
            "first": bounded,
        },
    )
    edges = ((data.get("deployments") or {}).get("edges") or [])
    deployments = [
        _deployment_summary(edge.get("node") or {})
        for edge in edges
        if isinstance(edge, dict)
    ]
    if successful_only:
        deployments = [item for item in deployments if item.get("status") == "SUCCESS"]
    return {
        "target": target.name,
        "deployments": deployments,
        "successful_only": bool(successful_only),
    }


def _deployment_detail(target: RailwayTarget, deployment_id: str) -> tuple[dict, dict]:
    identifier = (deployment_id or "").strip()
    if not identifier or len(identifier) > 100:
        raise ValueError("invalid Railway deployment ID")
    scope = _scope(target)
    data = _graphql(
        target,
        """
        query BrainRailwayDeployment($id: String!) {
          deployment(id: $id) {
            id projectId environmentId serviceId status createdAt statusUpdatedAt
            updatedAt url staticUrl meta diagnosis
          }
        }
        """,
        {"id": identifier},
    )
    deployment = data.get("deployment") or {}
    if (
        str(deployment.get("projectId") or "") != scope["project_id"]
        or str(deployment.get("environmentId") or "") != scope["environment_id"]
        or str(deployment.get("serviceId") or "") != target.service_id
    ):
        raise ValueError("deployment is outside the configured Railway target")
    return deployment, scope


def get_deployment(target_name: str, deployment_id: str) -> dict:
    target = _target(target_name)
    deployment, _ = _deployment_detail(target, deployment_id)
    result = _deployment_summary(deployment)
    if deployment.get("updatedAt") is not None:
        result["updated_at"] = deployment.get("updatedAt")
    diagnosis = deployment.get("diagnosis")
    if isinstance(diagnosis, str) and diagnosis:
        result["diagnosis"] = diagnosis[:4_000]
    return {"target": target.name, "deployment": result}


_URL_CREDENTIALS_RE = re.compile(
    r"(?P<scheme>[a-z][a-z0-9+.-]*://)(?:[^\s/@:]+)(?::[^\s/@]*)?@",
    re.IGNORECASE,
)
_BEARER_RE = re.compile(r"(?i)\b(bearer\s+)[A-Za-z0-9._~+/=-]+")
_SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(api[_-]?key|authorization|client[_-]?secret|database[_-]?url|password|"
    r"private[_-]?key|secret|token)\b(\s*[=:]\s*)([^\s,;]+)"
)
_JSON_SECRET_RE = re.compile(
    r'(?i)([\"\'](?:api[_-]?key|authorization|client[_-]?secret|database[_-]?url|password|'
    r'private[_-]?key|secret|token)[\"\']\s*:\s*[\"\'])(.*?)([\"\'])'
)
_KNOWN_TOKEN_RE = re.compile(
    r"\b(?:github_pat_|gh[pousr]_|sk-|tvly-)[A-Za-z0-9_-]{8,}\b",
    re.IGNORECASE,
)
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")


def redact_log_message(message: object) -> str:
    text = str(message or "")[:MAX_LOG_MESSAGE_CHARS]
    text = _URL_CREDENTIALS_RE.sub(r"\g<scheme>[REDACTED]@", text)
    text = _BEARER_RE.sub(r"\1[REDACTED]", text)
    text = _SECRET_ASSIGNMENT_RE.sub(r"\1\2[REDACTED]", text)
    text = _JSON_SECRET_RE.sub(r"\1[REDACTED]\3", text)
    text = _KNOWN_TOKEN_RE.sub("[REDACTED]", text)
    return _JWT_RE.sub("[REDACTED]", text)


def get_logs(
    target_name: str,
    deployment_id: str,
    kind: str = "runtime",
    limit: int = 100,
    filter_text: str = "",
) -> dict:
    target = _target(target_name)
    deployment, _ = _deployment_detail(target, deployment_id)
    log_kind = (kind or "runtime").strip().lower()
    if log_kind not in {"build", "runtime"}:
        raise ValueError("Railway log kind must be build or runtime")
    bounded = _bounded_limit(limit, MAX_LOG_LINES, 100)
    safe_filter = str(filter_text or "")[:MAX_FILTER_CHARS]
    field = "buildLogs" if log_kind == "build" else "deploymentLogs"
    data = _graphql(
        target,
        f"""
        query BrainRailwayLogs($deploymentId: String!, $limit: Int, $filter: String) {{
          {field}(deploymentId: $deploymentId, limit: $limit, filter: $filter) {{
            timestamp message severity
          }}
        }}
        """,
        {"deploymentId": deployment.get("id"), "limit": bounded, "filter": safe_filter},
    )
    raw_logs = data.get(field) or []
    logs: list[dict] = []
    output_chars = 0
    truncated = False
    for item in raw_logs:
        if not isinstance(item, dict):
            continue
        message = redact_log_message(item.get("message"))
        if output_chars + len(message) > MAX_LOG_OUTPUT_CHARS:
            truncated = True
            break
        output_chars += len(message)
        logs.append(
            {
                "timestamp": item.get("timestamp"),
                "severity": item.get("severity"),
                "message": message,
            }
        )
    return {
        "target": target.name,
        "deployment_id": deployment.get("id"),
        "kind": log_kind,
        "logs": logs,
        "truncated": truncated or len(logs) < len(raw_logs),
    }


def _object_schema(properties: dict, required: tuple[str, ...] = ()) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": False,
    }


def tools() -> list[BrainTool]:
    target_property = {
        "type": "string",
        "enum": ["colehenry", "lapwise"],
        "description": "Configured Railway project alias.",
    }
    return [
        BrainTool(
            name="list_railway_targets",
            description="List the Railway projects Brain can inspect. Access is read-only.",
            parameters=_object_schema({}),
            handler=lambda db, args: list_targets(),
            label=lambda db, args: "listing Railway projects",
            available=available,
        ),
        BrainTool(
            name="list_railway_deployments",
            description=(
                "List recent deployments for one configured Railway service, including status "
                "and safe Git commit metadata when Railway provides it."
            ),
            parameters=_object_schema(
                {
                    "target": target_property,
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_DEPLOYMENTS},
                    "successful_only": {"type": "boolean"},
                },
                ("target",),
            ),
            handler=lambda db, args: list_deployments(
                args.get("target", ""), args.get("limit", 10), args.get("successful_only", False)
            ),
            label=lambda db, args: f"checking {args.get('target', '')} deployments",
            available=available,
        ),
        BrainTool(
            name="get_railway_deployment",
            description=(
                "Read details for one deployment returned by list_railway_deployments. "
                "The deployment must belong to the configured target."
            ),
            parameters=_object_schema(
                {
                    "target": target_property,
                    "deployment_id": {"type": "string"},
                },
                ("target", "deployment_id"),
            ),
            handler=lambda db, args: get_deployment(
                args.get("target", ""), args.get("deployment_id", "")
            ),
            label=lambda db, args: (
                f"reading {args.get('target', '')} deployment "
                f"{str(args.get('deployment_id', ''))[:12]}"
            ),
            available=available,
        ),
        BrainTool(
            name="get_railway_logs",
            description=(
                "Read bounded, redacted build or runtime logs for a verified configured "
                "deployment. Secrets and credential-like values are removed."
            ),
            parameters=_object_schema(
                {
                    "target": target_property,
                    "deployment_id": {"type": "string"},
                    "kind": {"type": "string", "enum": ["build", "runtime"]},
                    "limit": {"type": "integer", "minimum": 1, "maximum": MAX_LOG_LINES},
                    "filter": {
                        "type": "string",
                        "maxLength": MAX_FILTER_CHARS,
                        "description": "Optional Railway log filter.",
                    },
                },
                ("target", "deployment_id"),
            ),
            handler=lambda db, args: get_logs(
                args.get("target", ""),
                args.get("deployment_id", ""),
                args.get("kind", "runtime"),
                args.get("limit", 100),
                args.get("filter", ""),
            ),
            label=lambda db, args: (
                f"reading {args.get('target', '')} {args.get('kind', 'runtime')} logs"
            ),
            available=available,
        ),
    ]
