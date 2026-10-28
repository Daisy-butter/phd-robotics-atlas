---
id: paper-fast-vla
type: Paper
title: "Fast-VLA: One-Shot Task Understanding with Lightweight Closed-Loop Actors"
team: "Huawei"
date: "2026-10-21"
coreIdea: "任务理解只跑一次大 VLM，之后由轻量 actor 闭环执行，显著降低在线推理成本。"
paperUrl: "https://arxiv.org/abs/2610.21389"
projectUrl: "https://garfield-kh.github.io/FastVLA"
topics: [topic-vla]
---

端到端大 VLA 每步都跑完整多模态栈，控制频率与功耗很难同时满足。Fast-VLA 把「理解」与「伺服」解耦：语义一次到位，闭环留给轻量策略。
