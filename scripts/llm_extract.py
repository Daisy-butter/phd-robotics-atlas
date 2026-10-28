#!/usr/bin/env python3
"""
从论文摘要 / 正文建议 Method 节点与边（需本地或服务器 vLLM OpenAI 兼容 API）。

示例：
  export VLLM_BASE_URL=http://127.0.0.1:8000/v1
  python scripts/llm_extract.py --text-file content/papers/pact-vla.md

docker compose -f docker-compose.vllm.yml up -d
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = os.environ.get("VLLM_BASE_URL", "http://127.0.0.1:8000/v1")
DEFAULT_MODEL = os.environ.get("LLM_MODEL", "Qwen/Qwen3-7B")

SYSTEM = """你是机器人学习知识图谱助手。根据论文摘要，输出 JSON（不要 markdown 代码块）：
{
  "methods": ["method-vla", "method-wbc", ...],
  "suggested_edges": [
    {"target": "topic-vla", "type": "belongs_to_topic", "note": "一句话"},
    {"target": "paper-other-id", "type": "related_to", "note": "..."}
  ],
  "summary_zh": "一句中文核心 idea"
}
仅使用已知 method id: method-vla, method-wam, method-wbc, method-rsi, method-agentic
与 topic id: topic-vla, topic-wam, topic-wbc, topic-rsi, topic-agentic
边 type 仅限: belongs_to_topic, uses_method, related_to, contrasts, extends, cites"""


def load_text(path: str | None, inline: str | None) -> str:
    if inline:
        return inline.strip()
    if not path:
        raise SystemExit("Provide --text or --text-file")
    raw = open(path, encoding="utf-8").read()
    m = re.match(r"^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$", raw)
    return (m.group(1) if m else raw).strip()


def chat(base: str, model: str, user: str) -> str:
    url = base.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        raise SystemExit(f"API request failed ({url}): {e}") from e
    return data["choices"][0]["message"]["content"]


def parse_json_loose(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text)


def main() -> None:
    p = argparse.ArgumentParser(description="LLM extract methods/edges from paper text")
    p.add_argument("--text-file", help="Markdown file (uses body after frontmatter)")
    p.add_argument("--text", help="Inline abstract text")
    p.add_argument("--base-url", default=DEFAULT_BASE)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--dry-run", action="store_true", help="Print prompt only")
    args = p.parse_args()
    body = load_text(args.text_file, args.text)
    user = f"论文摘要与笔记：\n{body[:6000]}"
    if args.dry_run:
        print(user)
        return
    out = chat(args.base_url, args.model, user)
    try:
        parsed = parse_json_loose(out)
    except json.JSONDecodeError:
        print(out, file=sys.stderr)
        raise SystemExit("Model output was not valid JSON")
    print(json.dumps(parsed, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
