---
model: gpt-5.4-2026-03-05
temperature: 0
---

Merge these two JSON data sources into a single JSON object with keys "meta", "skills", and "stats":

Site metadata:
@{data/site-meta.json}

Skills data:
@{data/skills.json}

Stats data:
@{data/stats.json}

Output ONLY valid JSON with proper formatting.
