#!/usr/bin/env python3
"""
Kimi Wake Protocol — Session Start Loader

At session start, reconstruct working context from:
1. Canonical claims about Max (high confidence, user_stated/tool_observed)
2. Recent session summaries (last N days of memory/YYYY-MM-DD.md)
3. Contradiction state (claims with conflicting values)
4. Open loops (unresolved threads)
5. Active plan status

Usage:
    python3 scripts/kimi_wake_protocol.py

Outputs JSON to stdout for agent consumption.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from glob import glob

LEDGER_DIR = "memory-ledger"
MEMORY_DIR = "memory"
OBSIDIAN_DIR = "obsidian-vault/Agent-Kimi"


def load_jsonl(path):
    items = []
    if not os.path.exists(path):
        return items
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return items


def get_canonical_claims(claims, min_confidence=0.85, trust_classes=None):
    """Extract high-confidence canonical claims about Max."""
    if trust_classes is None:
        trust_classes = {"user_stated", "tool_observed"}
    canonical = []
    for c in claims:
        if c.get("subject") != "entity:max":
            continue
        if c.get("confidence", 0) < min_confidence:
            continue
        if c.get("trust") not in trust_classes:
            continue
        canonical.append(c)
    canonical.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    return canonical


def get_recent_claims(claims, days=7):
    """Get claims from last N days regardless of subject."""
    cutoff = datetime.now() - timedelta(days=days)
    recent = []
    for c in claims:
        ts = c.get("timestamp", c.get("created_at", ""))
        if not ts:
            continue
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt >= cutoff:
                recent.append(c)
        except ValueError:
            continue
    return recent


def find_contradictions(claims):
    """Find claims with same subject+predicate but different values."""
    grouped = {}
    for c in claims:
        key = (c.get("subject", ""), c.get("predicate", ""))
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(c)

    contradictions = []
    for (subj, pred), group in grouped.items():
        values = set(c.get("value", "") for c in group)
        if len(values) > 1:
            by_value = {}
            for c in group:
                v = c.get("value", "")
                ts = c.get("timestamp", c.get("created_at", "1970-01-01"))
                if v not in by_value or ts > by_value[v].get("timestamp", ""):
                    by_value[v] = c
            contradictions.append({
                "subject": subj,
                "predicate": pred,
                "values": list(values),
                "claims": list(by_value.values())
            })
    return contradictions


def get_recent_sessions(days=3):
    """Read recent daily memory files."""
    sessions = []
    cutoff = datetime.now() - timedelta(days=days)
    pattern = os.path.join(MEMORY_DIR, "*.md")
    for path in sorted(glob(pattern), reverse=True):
        fname = os.path.basename(path)
        if fname == "README.md":
            continue
        try:
            date_str = fname.replace(".md", "")
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if dt >= cutoff:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                sessions.append({
                    "date": date_str,
                    "content": content[:2000],
                    "path": path
                })
        except ValueError:
            continue
    return sessions


def get_open_loops():
    """Read open loops from Obsidian."""
    path = os.path.join(OBSIDIAN_DIR, "Open Loops.md")
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    loops = []
    for line in content.split("\n"):
        line = line.strip()
        if line.startswith("- [ ]") or (line.startswith("|") and "open" in line.lower()):
            loops.append(line)
    return loops[:10]


def get_active_plan():
    """Read active plan status."""
    path = "obsidian-vault/Agent-Shared/ACTIVE PLAN.md"
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    in_kimi = False
    lines = []
    for line in content.split("\n"):
        if "Kimi" in line and "lane" in line.lower():
            in_kimi = True
        if in_kimi:
            lines.append(line)
            if line.strip() == "" and len(lines) > 5:
                break
    return "\n".join(lines)


def main():
    claims = load_jsonl(os.path.join(LEDGER_DIR, "claims.jsonl"))
    entities = load_jsonl(os.path.join(LEDGER_DIR, "entities.jsonl"))
    edges = load_jsonl(os.path.join(LEDGER_DIR, "edges.jsonl"))

    wake = {
        "protocol_version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "ledger_stats": {
            "total_entities": len(entities),
            "total_claims": len(claims),
            "total_edges": len(edges)
        },
        "canonical_claims": get_canonical_claims(claims),
        "recent_claims": get_recent_claims(claims, days=1),
        "contradictions": find_contradictions(claims),
        "recent_sessions": get_recent_sessions(days=3),
        "open_loops": get_open_loops(),
        "active_plan": get_active_plan()
    }

    print(json.dumps(wake, indent=2, default=str))


if __name__ == "__main__":
    main()
