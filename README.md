# yonglai.github.io

My engineering blog: running AI systems in production: what works, what breaks, and why.

## Writing workflow

1. Copy `drafts/_TEMPLATE.md` to `drafts/<slug>.md` and write there. `drafts/` is never published.
2. When it's ready, move it to `src/content/posts/<slug>.md` (the filename becomes the URL).
3. `npm run dev` to preview at http://localhost:4321, `npm run build` to check the build.
4. Push to `main`. GitHub Actions builds and deploys.

## Post rules

- One claim per post, stated in the first two paragraphs.
- Every claim is backed by evidence a reader can check: data, a trace, a runnable repo, or a worked example. The kind depends on the pillar (see below).
- Performance claims come with variance (3+ runs), hardware, and versions.
- If a post has code, link the repo and exact commit (`repo:` in frontmatter).
- Every post has a "What this does not show" section.
- Code and raw data live in experiment repos; this repo holds only writing and small figures.

## Pillars

`serving` · `mlops` · `agent-infra` · `agentic-ai` · `platform`
(labels are in `src/content.config.ts`).

The kind of evidence depends on the pillar:

| Pillar        | Typical evidence                                                                   |
| ------------- | ---------------------------------------------------------------------------------- |
| `serving`     | Benchmarks with variance, profiles, traces                                         |
| `mlops`       | A working setup, its metrics, a failure I caused and how I detected it             |
| `agent-infra` | Traces of real agent runs, latency and cost per task, failure logs                 |
| `agentic-ai`  | Eval results, a failure taxonomy from actual runs                                  |
| `platform`    | Design tradeoffs with a checked cost or failure model, incident-style walkthroughs |

## One-time deploy setup

1. Create an empty public repo named `yonglai.github.io` on GitHub.
2. `git remote add origin git@github.com:yonglai/yonglai.github.io.git && git push -u origin main`
3. Repo Settings → Pages → Source: **GitHub Actions**.
4. Site goes live at https://yonglai.github.io.

## Custom domain (later)

Add `public/CNAME` containing the domain, set `site` in `astro.config.mjs`,
point DNS at GitHub Pages, and update `public/robots.txt`.
