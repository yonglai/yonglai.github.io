# yonglai.github.io

My engineering blog: running AI systems in production, with measurements.

## Writing workflow

1. Copy `drafts/_TEMPLATE.md` to `drafts/<slug>.md` and write there. `drafts/` is never published.
2. When it's ready, move it to `src/content/posts/<slug>.md` (the filename becomes the URL).
3. `npm run dev` to preview at http://localhost:4321, `npm run build` to check the build.
4. Push to `main`. GitHub Actions builds and deploys.

## Post rules

- One claim per post, stated in the first two paragraphs.
- Numbers come with variance (3+ runs), hardware, and versions.
- Every post links the repo and exact commit that produced its numbers (`repo:` in frontmatter).
- Every post has a "What this does not show" section.
- Code and raw data live in experiment repos; this repo holds only writing and small figures.

## Pillars

`serving` · `mlops` · `agent-infra` · `agentic-ai` · `platform`
(labels are in `src/content.config.ts`).

## One-time deploy setup

1. Create an empty public repo named `yonglai.github.io` on GitHub.
2. `git remote add origin git@github.com:yonglai/yonglai.github.io.git && git push -u origin main`
3. Repo Settings → Pages → Source: **GitHub Actions**.
4. Site goes live at https://yonglai.github.io.

## Custom domain (later)

Add `public/CNAME` containing the domain, set `site` in `astro.config.mjs`,
point DNS at GitHub Pages, and update `public/robots.txt`.
