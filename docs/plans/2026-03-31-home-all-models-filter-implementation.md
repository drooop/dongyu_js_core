---
title: "Home All Models Filter Implementation Plan"
doc_type: implementation-plan
status: active
updated: 2026-03-31
source: ai
---

# Home All Models Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an explicit `All models` state to the Home model selector so the table can show rows across every model while preserving existing row-level actions and secondary filters.

**Architecture:** Represent `All models` as `selected_model_id=''` instead of overloading `0`. Update Home option derivation, row derivation, and status text to understand that state, and make create actions explicit about missing model targets instead of guessing. Keep changes local to the Home editor flow.

**Tech Stack:** Vue client snapshot derivation, ModelTable-backed Home UI JSON, local/remote Home editor flow.

---
