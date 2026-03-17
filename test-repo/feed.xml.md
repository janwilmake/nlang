---
model: gpt-5.4-2026-03-05
trigger: "0 */12 * * *"
cacheTtl: 43200
---

Generate a valid RSS 2.0 XML feed for a blog at https://alexdev.example.com.

Use this site metadata:
@{data/site-meta.json}

And these are the available blog post slugs:
@{blog/name.json}

For each slug, create an <item> with:

- A human-readable title derived from the slug
- Link: https://alexdev.example.com/blog/{slug}.html
- A short description (1 sentence)
- pubDate in RFC 822 format, using January 2025 dates

Output ONLY valid XML, no markdown.
