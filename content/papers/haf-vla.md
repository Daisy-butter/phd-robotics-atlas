---
id: paper-haf-vla
type: Paper
title: "HAF-VLA: Hierarchical Action Flow for Humanoid Vision-Language-Action"
team: "Peking University / Beijing Humanoid Robot Innovation Center et al."
date: "2026-10-26"
coreIdea: "在 π₀.₅ 上引入分层 action flow（腿头 → 腰 → 臂手），把全身运动学结构显式写入 VLA 动作生成。"
paperUrl: "https://arxiv.org/abs/2610.26584"
projectUrl: null
topics: [topic-vla, topic-wbc]
---

人形全身控制若仍把动作当成扁平向量，基座与腰姿错误会逼迫上身补偿。HAF-VLA 用分层流式生成，让下身与腰先定姿态语义，再生成臂手精细动作。
