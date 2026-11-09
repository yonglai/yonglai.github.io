---
title: "A passing /health check doesn't mean your vLLM engine can decode"
description: "I froze the engine of a single-GPU vLLM pod on k3s. The default health check stayed green and users hung for 108 seconds. A dummy-decode readiness probe pulled the pod out in 37."
date: 2026-11-08
pillar: mlops
tags: [vllm, kubernetes, readiness-probe, k3s, mlops]
repo: https://github.com/yonglai/inference-track/tree/d805a4bd003ec7ef5b1e13d5afda1475a389a03b
draft: true
---

## The claim

vLLM's `/health` endpoint tells you the API server is alive, not that the engine can still produce tokens. When I froze the engine process, `/health` kept returning 200 and Kubernetes kept sending traffic to the pod. A readiness probe that runs a real 4-token completion removed the pod from the Service after 37 seconds. I also expected it to catch a broken compiler toolchain, and it didn't need to: vLLM's own startup already does.

## Setup

One GeForce RTX 3080 (10 GB, sm_86, driver 595.91.07) on a single-node k3s box. `vllm/vllm-openai:v0.30.0` serving Qwen2.5-1.5B-Instruct in bf16, FlashInfer 0.6.18.post1. One replica, `Recreate` strategy. Startup and liveness probes are `httpGet /health`. Only the readiness probe changes between runs:

- **health:** exec probe that calls `GET /health`.
- **decode:** the same, plus a 4-token completion with `top_p` and `top_k` set (so it goes through the FlashInfer sampler). Period 10 s, timeout 10 s, 3 failures.

A client outside the cluster sends one such completion per second through the Service with a 5 s timeout. Each scenario below is a single run, except the healthy baseline.

## Evidence

**Engine frozen (`SIGSTOP` on the EngineCore process):**

| | health-only probe | decode probe |
|---|---|---|
| Pod leaves endpoints | never (108 s observed) | after 37 s |
| Client requests during freeze | 18 of 18 timed out at 5 s | 7 timed out at 5 s, then instant connection-refused |
| Restarts | 0 | 0 |
| After thaw | 200s within 1 s | pod READY and 200s within about 1 s |

During the freeze I also called the pod directly: `/health` returned 200 in 18 ms while a sampled completion timed out at 5 s.

**Healthy pod:** time to READY was 45 to 50 s in both modes, and the decode probe never failed. The first user request took 40 to 43 ms behind the health probe and 29 ms behind the decode probe, because the probe's own request had already warmed the path (one decode run only).

**Broken toolchain, which I expected the probe to catch:**

- Hiding `nvcc` changed nothing. The image ships `flashinfer-jit-cache`, so the sampler kernel is prebuilt and no compile happens.
- Removing that cache too and hiding `nvcc` made the pod crash during startup after about 41 s: ninja exited 127 while building FlashInfer's `sampling` module. The pod went into CrashLoopBackOff and never became ready, under either probe.

- With the cache removed but `nvcc` present, the pod started fine but took about 95 s to become ready instead of 45 to 50 s. vLLM's engine init went from 11.5 to 13.2 s to 66 s, which is FlashInfer building its sampler kernel. The startup probe logged 19 connection-refused failures during that time and then passed, with no restarts.

## Why it happens

vLLM runs the API server and the engine as separate processes. `/health` is answered by the API server, so a stopped engine doesn't affect it. Liveness uses the same endpoint, so it never fired either: 108 s of freeze, zero restarts.

The decode probe works because it asks the question users actually care about: can this pod return a token right now? The detection time is just `failureThreshold × periodSeconds` plus the timeout, so you can trade speed against false positives.

Startup is a different story. vLLM already runs a sampler pass while initialising, so a missing compiler fails the pod loudly before it ever reports ready. That is good behaviour, and it means the decode probe adds nothing for that class of failure.

## What this does not show

- One run per scenario (baseline aside), on one machine, one model, one vLLM version. The numbers are illustrative, not a distribution.
- A frozen process is a simulation of a hung engine, not a recording of a real one. I did not reproduce a natural hang such as a CUDA error or a deadlock.
- Under real load the probe's request queues behind user requests. A busy but healthy pod could miss the 10 s timeout and be pulled out of rotation. I did not test this, and it is the main risk of the approach.
- With a single replica, removing the pod turns slow responses into refused connections. That fails faster but is still an outage. The gain is clearer with several replicas.
- I did not try the decode probe on liveness. A restart on a false positive is more expensive than leaving the pod unready.
- The cold build added about 53 to 55 s and fit inside the 300 s startup budget (60 probes at 5 s). A larger model or more kernels to build could exceed it and look like a crash loop. The compiled kernel lives in the container filesystem, so every restart pays it again unless the cache directory is mounted from the host (not tested).
- `Recreate` means a bad rollout takes the Service to zero endpoints. On one GPU you can't overlap two pods, so this is a constraint, not a bug.

## Reproduce or verify it

Everything is in `vllm-k8s/readiness/` of the repo linked above: the probe (`decode_probe.py`), the freeze script, the deployment with env switches (`PROBE_MODE`, `BREAK_NVCC`, `REMOVE_JIT_CACHE`), and a README with the exact commands. To check the core claim yourself, freeze the engine and compare the two calls:

```bash
kubectl -n vllm exec deploy/vllm-qwen -- python3 /experiment/freeze_engine.py freeze
# /health still answers 200; a sampled /v1/completions times out
kubectl -n vllm exec deploy/vllm-qwen -- python3 /experiment/freeze_engine.py thaw
```
