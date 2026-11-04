---
title: "A version guard that checked the compiler, not the headers"
description: "Why vLLM crashed at sampler warmup on my machine, how a FlashInfer guard picked a CUB API using the wrong version, and why the fix was deleting nine lines instead of repairing the guard."
date: 2026-11-03
pillar: serving
tags: [flashinfer, cuda, cccl, jit, open-source]
repo: https://github.com/flashinfer-ai/flashinfer/pull/5124
draft: false
---

## The claim

A guard in FlashInfer's sampling kernel chose which CUB API to call by checking the *compiler's* version. FlashInfer compiles against its own bundled copy of CUB, so the compiler's version said nothing about which API existed. On an older toolkit, the mismatch became a compile error that named neither the real cause nor the unsupported toolkit. The fix was to delete the fallback branch: one file, nine lines, merged as [PR #5124](https://github.com/flashinfer-ai/flashinfer/pull/5124). I opened it on September 10 and it was merged on November 3.

## How it showed up

`vllm serve Qwen/Qwen3-1.7B` on my RTX 3080 loaded the model, allocated the KV cache and captured CUDA graphs. Then it died while warming up the sampler:

```
error: cub::_V_300302_SM_860::BlockAdjacentDifference has no member "FlagHeads"
```

Everything before that point had worked on my old system toolkit (CUDA 12.0), because nothing before it compiled anything. FlashInfer JIT-compiles its sampling kernel at startup, and that was the first time nvcc ran. My workaround was `VLLM_USE_FLASHINFER_SAMPLER=0`, and the real fix on my side was upgrading to CUDA 13.3.1. But that didn't explain *why* it broke.

## Why it happens

Three facts combine:

1. **FlashInfer's bundled headers win.** It adds its own CCCL (NVIDIA's CUB/Thrust bundle) with `-I`, while the toolkit's headers go in with `-isystem`, so the vendored copy takes precedence. The wheel I was running bundles CCCL 3.3.2.
2. **CCCL 3.0 removed `FlagHeads`.** The public `FlagHeads` overloads of `BlockAdjacentDifference` are gone; `SubtractLeft` is the replacement.
3. **The guard looked at the wrong thing.** A branch near line 112 of `sampling.cuh` chose between `SubtractLeft` and `FlagHeads` using `__CUDACC_VER_*`, the compiler's version. On nvcc older than 12.1 it took the `FlagHeads` branch, against a CCCL that no longer has it.

The compiler's version is a fair stand-in for CUB's version only when you compile against the toolkit's own CUB. Once a project vendors its headers and puts them first, the stand-in breaks. The error message doesn't help either: "no member `FlagHeads`" says nothing about toolchains or what is supported.

The branch made sense when it was written. It was added in May 2024 for CUDA 11.8, whose bundled CUB predates `SubtractLeft` (it closed an earlier report of the same failure in the opposite direction).

## Why delete instead of fixing the guard

The right predicate is the version of the headers on the include path (`CUB_VERSION` / `CCCL_VERSION`), not the compiler's. But FlashInfer's minimum supported CUDA is now 12.9, and every CUB reachable under that floor already has `SubtractLeft`. A correct guard would be true on every supported setup, so the branch it protected could never run. Repairing it wasn't an option anyway: in CCCL 3.6.0 a `FlagHeads` symbol still exists, but it is a private helper taking `int linear_tid`, not the public overload the code calls.

## Evidence

I used one probe file, picked the API branch explicitly with `-D`, and varied only the CUB/CCCL headers on the include path:

| nvcc | CUB / CCCL | Source | `FlagHeads` | `SubtractLeft` |
| --- | --- | --- | --- | --- |
| 12.0.140 | CUB 2.0.1 | Ubuntu `libcub-dev` | pass (deprecated) | pass |
| 12.0.140 | CCCL 3.0.0 | NVIDIA/cccl tag `v3.0.0` | **fail** | pass |
| 12.0.140 | CCCL 3.0.3 | NVIDIA/cccl tag `v3.0.3` | **fail** | pass |
| 12.0.140 | CCCL 3.3.2 | `flashinfer-python` 0.6.18.post1 wheel | **fail** | pass |
| 13.3.73 | CCCL 3.3.2 | same wheel | **fail** | pass |
| 12.0.140 | CCCL 3.6.0 | `3rdparty/cccl` at `main` | **fail** | pass |

`FlagHeads` is deprecated in CUB 2.0.1 and absent from CCCL 3.0.0 onward. `SubtractLeft` compiled in every row, including CUB 2.0.1, which is older than anything reachable under the CUDA 12.9 floor. After the change, `sampling.cuh` itself compiles under both nvcc 12.0.140 and 13.3.73 against bundled CCCL 3.6.0.

One small thing that mattered: another report of the same failure said "bundled CCCL 3.0.3", but its error text contained `_V_300302`. CUB encodes versions as `MMMmmmpp`, so that is 3.3.2, the same version I had hit, not 3.0.3. Decoding the number correctly is what showed the two reports matched.

## What this does not show

- **It is not a performance change.** There are no benchmarks. The change deletes code that could not run on any supported configuration.
- **nvcc 12.0 compiling is a side effect.** 12.0 is below the supported floor of 12.9. I am not claiming 12.0 is supported, and other JIT paths may still fail on it.
- **It was verified by compiling, not by running every combination.** CI runs CUDA 12.9 and 13.0 only, so no tested configuration takes the removed branch. A green run means no regression on supported versions, which is the claim.
- **It is one bug in one project.** The general lesson below is my belief from this case, not something I have tested elsewhere.

## Takeaways

1. **When a project vendors its own headers, detect versions from those headers, not from the compiler.** The same failure can appear anywhere a build puts its own copy of a dependency ahead of the system's.
2. **When a support floor moves, look for branches that only existed for the old floor.** They are not harmless. This one broke an otherwise workable setup with a misleading error.
3. **Sometimes the best guard fix is no guard.** Before repairing a version check, ask whether any supported version can still take the other branch.

## Reproduce or verify it

The minimal reproduction (`probe.cu`) is in the collapsed section of the [PR description](https://github.com/flashinfer-ai/flashinfer/pull/5124). Compile it once with `-D` selecting each API and point `-I` at each CCCL tag in the table. The include-order detail comes from `build_common_cflags` in FlashInfer's `jit/cpp_ext.py`. Thanks to the maintainers who ran CI and reviewed the change.
