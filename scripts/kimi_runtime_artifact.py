#!/usr/bin/env python3
"""
Kimi Runtime Artifact — Per-Session Receipt Generator

Tracks what Kimi did in a session:
- Files read
- Claims written
- Things learned but held back (with reasons)
- Subagent delegations
- External actions (Linear posts, etc.)
- Frame budget: time spent on reflex vs answer vs background

Usage:
    # At session start
    python3 scripts/kimi_runtime_artifact.py init --session-id SESSION_NAME

    # During session (append events)
    python3 scripts/kimi_runtime_artifact.py event --type read --target "file.md" --notes "Key insight"
    python3 scripts/kimi_runtime_artifact.py event --type claim --target "entity:max" --notes "New preference"
    python3 scripts/kimi_runtime_artifact.py event --type held_back --target "some_fact" --reason "low_confidence"

    # At session end
    python3 scripts/kimi_runtime_artifact.py finalize --session-id SESSION_NAME

Artifacts written to: obsidian-vault/Agent-Kimi/runtime-artifacts/
"""

import json
import os
import sys
import argparse
from datetime import datetime

ARTIFACT_DIR = "obsidian-vault/Agent-Kimi/runtime-artifacts"


def ensure_dir():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)


def get_artifact_path(session_id):
    return os.path.join(ARTIFACT_DIR, f"{session_id}.json")


def init_artifact(session_id):
    ensure_dir()
    artifact = {
        "session_id": session_id,
        "started_at": datetime.now().isoformat(),
        "finalized_at": None,
        "events": [],
        "summary": {
            "files_read": [],
            "claims_written": [],
            "held_back": [],
            "subagent_delegations": [],
            "external_actions": [],
            "frame_budget_ms": {
                "reflex": 0,
                "answer": 0,
                "background": 0
            }
        }
    }
    path = get_artifact_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(artifact, f, indent=2)
    print(f"[artifact] Initialized: {path}")
    return path


def load_artifact(session_id):
    path = get_artifact_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_artifact(session_id, artifact):
    path = get_artifact_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(artifact, f, indent=2)


def add_event(session_id, event_type, target, notes="", reason=""):
    artifact = load_artifact(session_id)
    if artifact is None:
        print(f"[artifact] Error: No artifact for session {session_id}. Run init first.")
        sys.exit(1)

    event = {
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "target": target,
        "notes": notes,
        "reason": reason
    }
    artifact["events"].append(event)

    summary = artifact["summary"]
    if event_type == "read":
        if target not in summary["files_read"]:
            summary["files_read"].append(target)
    elif event_type == "claim":
        if target not in summary["claims_written"]:
            summary["claims_written"].append(target)
    elif event_type == "held_back":
        summary["held_back"].append({"target": target, "reason": reason})
    elif event_type == "subagent":
        summary["subagent_delegations"].append({"target": target, "notes": notes})
    elif event_type == "external":
        summary["external_actions"].append({"target": target, "notes": notes})

    save_artifact(session_id, artifact)
    print(f"[artifact] Event: {event_type} -> {target}")


def finalize_artifact(session_id):
    artifact = load_artifact(session_id)
    if artifact is None:
        print(f"[artifact] Error: No artifact for session {session_id}")
        sys.exit(1)

    artifact["finalized_at"] = datetime.now().isoformat()

    if len(artifact["events"]) >= 2:
        start = datetime.fromisoformat(artifact["started_at"])
        end = datetime.fromisoformat(artifact["finalized_at"])
        total_seconds = (end - start).total_seconds()
        artifact["summary"]["session_duration_seconds"] = total_seconds

    save_artifact(session_id, artifact)
    path = get_artifact_path(session_id)
    print(f"[artifact] Finalized: {path}")
    print(f"[artifact] Summary: {len(artifact['summary']['files_read'])} files, "
          f"{len(artifact['summary']['claims_written'])} claims, "
          f"{len(artifact['summary']['held_back'])} held back")


def main():
    parser = argparse.ArgumentParser(description="Kimi Runtime Artifact Tracker")
    subparsers = parser.add_subparsers(dest="command")

    init_parser = subparsers.add_parser("init", help="Initialize a new session artifact")
    init_parser.add_argument("--session-id", required=True, help="Session identifier")

    event_parser = subparsers.add_parser("event", help="Add an event to the current session")
    event_parser.add_argument("--session-id", required=True, help="Session identifier")
    event_parser.add_argument("--type", required=True,
                              choices=["read", "claim", "held_back", "subagent", "external", "frame"],
                              help="Event type")
    event_parser.add_argument("--target", required=True, help="What was acted upon")
    event_parser.add_argument("--notes", default="", help="Additional notes")
    event_parser.add_argument("--reason", default="", help="Reason (for held_back)")

    finalize_parser = subparsers.add_parser("finalize", help="Finalize the session artifact")
    finalize_parser.add_argument("--session-id", required=True, help="Session identifier")

    args = parser.parse_args()

    if args.command == "init":
        init_artifact(args.session_id)
    elif args.command == "event":
        add_event(args.session_id, args.type, args.target, args.notes, args.reason)
    elif args.command == "finalize":
        finalize_artifact(args.session_id)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
