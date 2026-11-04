---
title: "Three wrong answers, three checks: Bedrock's grounding tiers against a claim-level verifier"
description: "Bedrock's default grounding check passed all three wrong answers from my insurance agent. The Standard tier caught one, a claim-level checker caught all three, and each had a cost. Injected errors made the two Bedrock grounding checks look better than they were."
date: 2026-11-02
pillar: agentic-ai
tags: [bedrock, guardrails, rag, evaluation, hallucination, agents]
repo: https://github.com/yonglai/bedrock-support-bot/tree/99256b9b98cbaf002466ed98214852cd5f4eb605
draft: false
---

_Measured October to November 2026 · Claude Haiku 4.5 on Amazon Bedrock · a fictional insurer with 11 short policy documents_

## The claim

An answer can be supported by the retrieved sources and still be wrong, because a true figure is attached to the wrong plan, person or service. In my agent, three wrong answers passed Bedrock's default (**Classic**) contextual grounding check at scores of **0.96 to 0.99**. The **Standard** tier caught one of the three. A second model call that checks each claim against the sources caught all three, but it also flagged 1 of the 26 answers I had judged correct, and the correct re-run of Q501. On errors I injected on purpose, the two Bedrock grounding checks looked much better than they did on the real ones: Classic caught 18 of 31 against 0 of 3, and Standard caught 30 of 31 against 1 of 3.

## Setup

Everything here is a prototype for a contact-centre assistant for a **fictional** insurer, "Evergreen Life". The policy documents and customers are invented.

|                 |                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model           | Claude Haiku 4.5 via the Bedrock Converse API (inference profile)                                                                                                 |
| Retrieval       | Bedrock Knowledge Base, hierarchical chunking (retrieves the parent document), top 3                                                                              |
| Tools           | `search_policy` (forced as the first call), `get_my_plan` (no arguments: identity comes from the session), `calculate`, `escalate_to_human`                       |
| Safety layers   | Rule-based triage, input guardrail, the tool loop, an output grounding check, one retry, then human handoff                                                       |
| Grounding check | Bedrock Guardrails contextual grounding, threshold 0.75; relevance, threshold 0.5. My agent's guardrail did not set a tier, so it ran on **Classic**, the default |
| Documents       | 11 short Markdown files (a few hundred characters each)                                                                                                           |
| Questions       | Dev and held-out sets used while building, plus 12 "fresh" questions written after the design was fixed and run once                                              |

Small corpus, small question sets, and Claude Haiku 4.5 throughout except one verifier check with Sonnet 4.5. The numbers say what happened in this setup.

## 1. Three wrong answers that passed

**Q501**, customer on the Enhanced plan: _"How much will my plan pay toward a counsellor each year?"_

> …your plan will pay up to **$2,500 per calendar year** toward psychologists, registered social workers, and psychotherapists, **reimbursed at 90%**…

The mental-health document says **80%**. The 90% is the Enhanced plan's general rate from a different document.

**Q506**, customer on the Standard plan with a 16-year-old son: _"My son needs new glasses and I need an eye exam. What can we claim?"_

> **For your son (age 16, under 18):** Eyeglasses or contact lenses: up to $150 every 12 months. **Eye exams: up to $100 every 24 months.**

The vision document gives the $100 eye exam limit **for adults only**. Re-running the agent on Q506 produced a related invention: _"Your son would need his own eye exam as well, which would fall under the same coverage limits as yours."_ That is the third wrong answer.

In the original run these two scored grounding 0.94 and 0.98. Re-scored later against rebuilt sources (the original run did not save its sources) they scored 0.96, 0.98 and 0.99. My key-fact scoring (does the answer contain `$2,500`, or `$150` and `$100`) passed them too. I found them by reading the answers.

## 2. What I compared

Three checks, on the same text:

1. **Classic grounding**: the default tier of the Bedrock contextual grounding check.
2. **Standard grounding**: the newer tier, announced on 20 October 2026. It needs cross-Region inference through a guardrail profile and is only offered in some Regions. I created a second guardrail, identical except for the tier, with only the grounding and relevance checks.
3. **A claim-level verifier**: a second Claude Haiku 4.5 call (temperature 0). It gets the question, the sources (including the customer's own record) and the answer, splits the answer into factual claims, and decides for each whether the sources state it **and that it applies to the situation the answer applies it to**. A figure given for another plan, for adults when the answer applies it to a child, or for another service is not supported.

Inputs, none of them generated for this comparison:

- **26 clean answers** from the dev, held-out and agent sets, assumed correct. Every flag was read by hand.
- **31 injected errors**: for each answer, a version with the percentage, the dollar amount or the plan name swapped for a value the answer did not already contain.
- **The three real errors** above, scored against the sources the agent retrieved on the re-run, plus the correct re-run of Q501 (it says 80%).

All sources go to the guardrail as one grounding-source block, exactly as the agent sends them.

## 3. Results

|                      | Clean blocked | Injected blocked (of 31) | Real errors caught (of 3) | Correct Q501 re-run blocked | Median call |
| -------------------- | ------------- | ------------------------ | ------------------------- | --------------------------- | ----------- |
| Classic grounding    | 0 of 26       | 18 (58%)                 | **0**                     | no                          | 307 ms      |
| Standard grounding   | 0 of 26       | 30 (97%)                 | **1**                     | no                          | 512 ms      |
| Claim-level verifier | 1 of 26       | 31 (100%)                | **3**                     | **yes**                     | about 1.2 s |

The 31 injected errors split into three kinds, and the checks did not do equally well on each:

| Injected error      | How many | Classic blocked | Standard blocked | Verifier flagged |
| ------------------- | -------- | --------------- | ---------------- | ---------------- |
| Wrong dollar amount | 18       | 10              | 17               | 18               |
| Wrong plan name     | 5        | 3               | 5                | 5                |
| Wrong percentage    | 8        | 5               | 8                | 8                |

The three real errors, one by one:

| Answer                              | Classic score | Standard         | Verifier   |
| ----------------------------------- | ------------- | ---------------- | ---------- |
| Q501, "90%" instead of 80%          | 0.96          | **caught** (0.0) | **caught** |
| Q506, son gets the adult eye exam   | 0.98          | missed (1.0)     | **caught** |
| Q506 re-run, "same limits as yours" | 0.99          | missed (1.0)     | **caught** |

**A check on the check.** A trivial rule, "the answer contains a number that appears nowhere in the sources", would have caught only **14 of the 26** numeric injections, because the wrong value usually exists elsewhere in the sources. The verifier caught all 26, and Standard grounding caught 25, so both do more than string matching.

Two details of the scores: Standard returned only **0.0 or 1.0** on all 61 items, so there is no threshold to tune. Classic's scores are graded, and one clean answer sat at 0.76, just above my 0.75 threshold.

## 4. Why it happens

- **Every figure in a wrong answer is in the sources.** 90% is the Enhanced plan's rate in one document and $100 every 24 months is a vision limit in another. The text is supported; the **attachment** is wrong. A check built around "is this supported by the sources?" is satisfied by a true statement placed in the wrong context.
- **The documentation says multiple grounding-source blocks are evaluated together.** That is consistent with what I saw, because the check cannot tell which document a figure came from. I did not test whether sending the documents as separate blocks changes anything, so this is "consistent with", not a diagnosis.
- **Injected errors are easier than real ones.** Swapping a number produces a statement the sources contradict. A scope error produces a sentence that sounds plausible and is simply not stated: the sources say nothing about children's eye exams. Standard grounding caught 30 of 31 injected errors but only the one real error that was a wrong number. It missed both scope errors. If I had only the injection test, I would have concluded Standard was nearly enough. Other work reports the same gap between synthetic and natural errors (see Related work), though the one direct comparison I found is a vendor's own.

## 5. The false flags, and what they were really about

The verifier flagged one of the 26 clean answers (Q10) and the correct Q501 re-run. Both say psychologists on the Enhanced plan are reimbursed at **80%**. The overview document says the **Enhanced plan reimburses eligible expenses at 90%**, and the mental-health document says psychologists get 80% and varies only the dollar cap by plan. Both can be true, but nothing says the specific rule overrides the general one.

Same documents, same verifier, same temperature: on the stored wrong answer it chose 80%; on the correct re-run it chose 90%. When the sources disagree with themselves, its verdict depends on the wording of the answer. In the later Sonnet 4.5 check, Sonnet passed the correct re-run, so a larger model handled this case better, but it flagged a different answer for another reason (see the limits below). Standard grounding blocked neither answer.

Two of my "false" flags exposed a contradiction in my own documents. That is a defect to fix at the source ("psychologists, social workers and psychotherapists: 80% on both plans" in the overview). I have not made that change or re-measured after it.

## Next steps

1. **Fix the documents first.** Two of the verifier's flags came from a contradiction in my own policy files. Consistent sources should remove that kind of false flag.
2. **Treat a verifier flag as "retry once, then hand off to a person", not "block the answer".** My agent already has a retry and a human handoff, so a false flag would cost one retry or one handoff instead of a lost answer. For figures a customer will act on, I would accept that cost.
3. **Do not gate the verifier behind Standard grounding.** "Both must agree" missed two of the three real errors, and "either flags it" caught nothing the verifier did not. The real choice is latency: Standard took a median of 512 ms against about 1.2 s for the verifier.
4. **Measure the whole loop on questions the agent has not seen.** Track how often answers are flagged, how often the retry fixes them, how many go to a person, and the added latency.

## What this does not show

- **Three real errors.** Two questions, three answers. The numbers say how the checks behaved on these, not how often they catch real mistakes.
- **Injected errors are blunt.** I made them, one per answer, by swapping a value.
- **One repeat, minutes apart.** I ran the guardrail scoring a second time on the 57 clean and injected answers. Every block decision and every score was identical, for both tiers. That says the scores are stable within a session, not that they stay the same across days or model updates. I did not repeat the two re-run items, because the agent's answers change between runs.
- **Rebuilt sources for the stored errors.** The agent's original run did not save its sources, so I scored the two stored wrong answers against sources from a fresh retrieval run. They may differ from what the agent saw.
- **The verifier is the same model as the agent, and I tried only one other.** Both are Claude Haiku 4.5, and the LLM-as-a-judge literature describes self-enhancement bias. A re-run with Claude Sonnet 4.5 on the same 57 answers flagged the same 31 of 31 injected errors and 1 of 26 clean answers, though a different clean one (Sonnet's Q5 flag was over-strict: the disability document never mentions plans). Both models flagged both stored wrong answers, and each flagged one correct re-run, for different reasons. So the catch rate did not depend on the verifier model, but neither removed the false flags. Both sit at the ceiling on blunt injected errors, Sonnet 4.5 is from the same vendor, and it was about three times slower (median 4.0 s against 1.2 s). The grounding checks run on AWS's side, so this concerns the verifier only.
- **No combined check was run, but the saved results show what one would do.** "Either check flags it" catches exactly what the verifier catches, because every answer Standard blocked was also flagged by the verifier (31 of 31 injected, 1 of 26 clean flagged). "Both must agree" drops both false flags but catches only 30 of 31 injected and 1 of 3 real errors. With three real errors I draw no conclusion from that.
- **The agent's answers vary between runs.** A later re-run of Q506 did not repeat the invented child's eye exam, so a repeat of this experiment may not reproduce the same errors. The three real errors are fixed text I scored, not an error rate.
- **One account and Region, one corpus.** Eleven short documents. A larger corpus has more near-duplicate figures, which makes attachment errors more likely.
- **No adversarial testing and no load testing.** I did not try to manipulate any check through the question, and I did not measure behaviour at load. Both are standard practice for customer-facing systems and both are gaps here.
- **The verifier is not wired into the agent.** These are offline measurements of checks, not of an agent that uses them.

## Related work

I searched for earlier work on checking whether RAG answers are supported by their sources, and the papers and pages below are the ones closest to this post.

**Checking claim by claim is established.** [FActScore](https://ai.meta.com/research/publications/factscore-fine-grained-atomic-evaluation-of-factual-precision-in-long-form-text-generation) splits text into atomic facts and scores the share a knowledge source supports (I read the abstract). [MiniCheck](https://arxiv.org/html/2404.10774v2) trains small checkers that reach GPT-4-level accuracy on a 10-dataset benchmark at much lower cost. Its checkers assume each claim can be verified against a single document, and attachment errors live where that assumption is thin. [Langfuse](https://langfuse.com/resources/engineering/rag-faithfulness-evaluation.md), [Traceloop](https://traceloop.com/blog/automatically-detecting-hallucinations-in-rag-applications) and a [piece on checking answers against retrieved sources](https://oneuptime.com/blog/post/2026-08-31-evaluate-rag-hallucinations-against-sources/markdown) apply it to RAG. The last one says plan names must stay inside the claim and lists "correct facts attributed to the wrong source" as a test case.

**Natural errors are harder than constructed ones.** [RAGTruth](https://arxiv.org/html/2401.00396v1) has about 18,000 human-annotated RAG responses from six models. Response-level detection F1 ranged from 1% to about 81% depending on method and model, and the authors call detection "a significant challenge". A [vendor page for the LibreEval benchmark](https://arize.com/resources/llm-hallucination-dataset/) reports that synthetic hallucinations are easier to detect than natural ones, with base models' recall about 35% lower on natural examples. That matches what I saw with injected versus real errors, but it is self-reported and I could not check it. A [paper on synthetic training data for hallucination detection](https://arxiv.org/html/2407.05474v1) lists the same caveat, that synthetic errors may differ from unintentional ones.

**Grounded is not the same as true.** Azure's [groundedness documentation](https://learn.microsoft.com/en-gb/azure/ai-services/content-safety/concepts/groundedness) defines groundedness relative to the supplied sources and tells you to make sure the sources are accurate. [ClashEval](https://arxiv.org/html/2404.10198v2) studies a different failure: when a retrieved document is deliberately wrong, models often adopt it (GPT-4o 60.8% of the time when its own prior was right). My failures are the reverse case, correct documents misapplied.

**Citations are a related check.** [ALCE](https://arxiv.org/pdf/2305.14627) scores "citation recall": an NLI model checks that the passages a statement cites actually entail it, and it found that about half of ChatGPT and GPT-4 answers on its long-form set were not fully supported by their citations. [VeriCite](https://arxiv.org/pdf/2510.11394) verifies statements with an NLI model before writing the final answer, which improves citation quality with mixed effects on correctness. Both check support by a cited passage, not whether a figure belongs to this customer. My agent's answers carry `[S1]`-style citations, so I also tried that check, and I write it up as a separate short post.

**Judge models have known biases.** A [survey of LLM-as-a-judge](https://arxiv.org/abs/2411.15594) describes self-enhancement bias, concreteness bias (specific details such as numbers favoured even when inaccurate) and adversarial inflation. All three apply to a Haiku verifier checking Haiku answers full of numbers.

**The grounding tiers.** AWS's [documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.md) describes the tiers and says several grounding sources are evaluated together. The [announcement of the Standard tier](https://aws.amazon.com/about-aws/whats-new/2026/10/bedrock-guardrails-grounding-standard/) is dated 20 October 2026, about two weeks before I measured. It says Standard is "more robust" and scores reworded answers more consistently, at the same price, and it gives no accuracy numbers.

**What I didn't find:** a measured comparison of the Classic and Standard tiers, a catch rate on injected errors compared with a trivial baseline for a managed grounding check, or the same checks scored on injected and real errors side by side. Those are what this post adds, on a tiny sample.

## Takeaways

1. **A passing grounding score and a passing key-fact check are weak evidence of correctness.** Both can pass a true statement in the wrong place.
2. **Test a check with real errors, not only injected ones.** On injected errors Standard grounding looked nearly sufficient. On the real ones it missed two of three.
3. **Compare against a trivial baseline.** The "number not in the sources" rule (14 of 26) shows how much work the checks are doing.
4. **Read every flag on the clean set.** Two of my "false" flags exposed a contradiction in my own documents, which I would not have found by counting flags.
5. **The tier matters.** If you use the managed grounding check, find out which tier you are on, and test both on your own data.

## Reproduce

Code, data and raw results are in [`yonglai/bedrock-support-bot`](https://github.com/yonglai/bedrock-support-bot/tree/99256b9b98cbaf002466ed98214852cd5f4eb605) at commit `99256b9`. Check that commit out to match the numbers here.

```bash
# claim-level verifier: collects 26 answers + sources, injects errors
RETRIEVER=kb VARIANT=hierarchical MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  uv run python src/step7_eval_verifier.py
# the two real errors, checked against rebuilt sources
RETRIEVER=kb VARIANT=hierarchical MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  uv run python src/step7b_verifier_known_bad.py

# a different verifier model on the same answers (VERIFIER_MODEL_ID is any model your account can call)
RETRIEVER=kb VARIANT=hierarchical MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
VERIFIER_MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0 \
  uv run python src/step12_verifier_model.py

# Classic vs Standard grounding on the same text
uv run python src/step10a_tier_guardrails_create.py
RETRIEVER=kb VARIANT=hierarchical MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  uv run python src/step10b_compare_grounding_tiers.py
# repeat the scoring and compare the two runs
OUT=eval/results_grounding_tiers_run2.json \
RETRIEVER=kb VARIANT=hierarchical MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0 \
  uv run python src/step10b_compare_grounding_tiers.py
uv run python src/step10c_repeat_check.py \
  eval/results_grounding_tiers.json eval/results_grounding_tiers_run2.json
uv run python src/step10z_tier_guardrails_teardown.py
```

- Verifier prompt and parser: `src/verify.py`. Error injection: `src/mutate.py`. Tier comparison: `src/step10b_compare_grounding_tiers.py`.
- Raw results: `eval/results_verifier.json`, `eval/results_verifier_known_bad.json`, `eval/results_verifier_model.json`, `eval/results_grounding_tiers.json`, `eval/results_grounding_tiers_run2.json`.
- Running notes, including dead ends: `docs/notes.md`.
