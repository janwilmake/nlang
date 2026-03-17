---
model: gpt-4o-mini
trigger: "0 8 * * 1"
temperature: 0.8
cacheTtl: 0
---
Generate a weekly developer news digest HTML page. Pick 5 fictional but plausible tech news items for the week of January 13, 2025. 

Each item should have:
- A headline
- A 2-sentence summary
- A fictional source

Style it with inline CSS, dark theme (#0d1117 bg, #c9d1d9 text).
Include a header "Weekly Dev Digest" and the date.
Output a complete HTML document.