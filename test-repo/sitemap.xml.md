---
model: gpt-5.4-2026-03-05
temperature: 0
cacheTtl: -1
---

Generate a sitemap.xml for a website at https://alexdev.example.com with these pages:

- / (index.html) - priority 1.0, daily changefreq
- /about.md - priority 0.8, weekly
- /blog/index.html - priority 0.9, daily
- /blog/hello-world.html - priority 0.7, monthly
- /blog/getting-started-with-rust.html - priority 0.7, monthly
- /blog/why-typescript.html - priority 0.7, monthly
- /feed.xml - priority 0.5, daily

Use lastmod of 2025-01-15. Output ONLY valid XML.
