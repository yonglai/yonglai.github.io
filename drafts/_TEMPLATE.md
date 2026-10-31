---
title: "One claim, stated plainly"
description: "One or two sentences: what you measured and what it shows."
date: 2026-01-01
pillar: serving   # serving | mlops | agent-infra | agentic-ai | platform
tags: []
repo: https://github.com/yonglai/REPO/tree/COMMIT   # exact commit that produced the numbers
draft: false
---

## The claim

One or two sentences. If you can't state it in two sentences, the post isn't ready.

## Setup

Hardware, driver/CUDA, library versions, model, dtype, workload. Enough that a stranger can rerun it.

## Evidence

Numbers with variance (3+ runs), plus one trace or profile that explains the mechanism.
Show the table or chart first, then explain it.

## Why it happens

The mechanism. This is where the insight lives: not what changed, but why.

## What this does not show

Where the setup doesn't generalize: other hardware, models, batch sizes, versions.
Say it before a reader does.

## Reproduce it

Commands to rerun, linking the repo and commit in the frontmatter.
