---
id: paper-pact-vla
type: Paper
title: "PACT-VLA: Delay-Robust Vision-Language-Action via Predictive Asynchronous Chunk Selection"
team: "HKUST(GZ) et al."
date: "2026-10-28"
coreIdea: "把异步推理延迟当作决策窗口，在提交前用更新观测选择最优 action chunk，提升 VLA 真机落地的延迟鲁棒性。"
paperUrl: "https://arxiv.org/abs/2610.28019"
projectUrl: null
topics: [topic-vla, topic-agentic]
---

异步推理场景下，模型输出滞后于环境变化。PACT-VLA 的核心不是再压低单次推理时延，而是承认延迟不可避免，并把这段「等待窗口」变成可利用的信息：用更新后的观测在提交前重选 / 校正 chunk。
