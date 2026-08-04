# Task Tree UX Redesign — Spec

**Date:** 2026-08-04

## Goal

Replace the dumb flat `Subtask` checklist with a true recursive task tree where every node is a full `Task`. Add AI-assisted ticket improvement, expand the writing area, and replace the clashing color system with a professional, readable palette.

---

## 1. Data Model — Unify Subtask into Task

### What changes
- Remove the `Subtask` model, `subtasks` table, and all related schemas.
- Add to `Task`:
  - `parent_id: str | None` — nullable FK → `tasks.id`, ON DELETE CASCADE
  - `order: int` — position among siblings (default 0)
  - `children` — self-referential relationship, ordered by `order`, cascade delete-orphan
- `TaskOut` gains `parent_id`, `order`, and `children: list[TaskOut]` (recursive).

### Migration (Alembic)
1. Add `parent_id` and `order` columns to `tasks`.
2. For each row in `subtasks`: create a `Task` with `title=subtask.title`, `parent_id=subtask.task_id`, `order=subtask.order`, `status='done' if subtask.done else 'pending'`, `priority='medium'`, `description=''`.
3. Drop the `subtasks` table.

### Cycle guard
When setting `parent_id` (create or update), reject if the new parent is the task itself or any of its descendants. Walk ancestors of the target to verify.

---

## 2. Backend API Changes

| Endpoint | Change |
|---|---|
| `GET /api/tasks` | Returns root tasks only (`parent_id IS NULL`), children eagerly nested |
| `GET /api/tasks/{id}` | Returns full nested subtree |
| `POST /api/tasks` | Accepts optional `parent_id` to create child directly |
| `PUT /api/tasks/{id}` | Accepts `parent_id` and `order` (re-parenting / linking, with cycle guard) |
| `DELETE /api/tasks/{id}` | Cascades to all children (SQLAlchemy cascade handles it) |
| `POST /api/tasks/{id}/improve` | NEW — sends task to AI, returns `{title, description, suggested_subtasks}` without persisting |
| All `/api/tasks/{id}/subtasks/*` | REMOVED |

### `POST /api/tasks/{id}/improve` response shape
```json
{
  "title": "Improved title",
  "description": "Expanded, clearer description.",
  "suggested_subtasks": [{"title": "Sub A"}, {"title": "Sub B"}]
}
```

### `improve_task()` in `ai_parser.py`
Reuses the existing provider dispatch (`_call_ai`). New system prompt instructs AI to return the improved ticket JSON (not an array — a single object). Handles all providers (openai, anthropic, gemini, grok).

---

## 3. Frontend — Task Tree UI

### New components
- **`TaskTree`** — root wrapper, renders a list of top-level `TaskNode`s.
- **`TaskNode`** (recursive) — renders one task and its children. Props: `task`, `depth`, `onRefresh`.

### Each node displays
- `▶/▼` chevron — expand/collapse children (local `useState`, no persistence).
- Checkbox — toggles `status` between `pending`/`done` (calls `PUT /api/tasks/{id}`).
- Task title (link to `TaskDetail`).
- Priority badge (muted palette — see Section 5).
- `+ Add subtask` — shows inline input to create a child task.
- `Link existing` — opens a searchable picker (modal or dropdown) listing all tasks not already in this subtree; on select, calls `PUT /api/tasks/{selectedId}` with `{ parent_id: thisTaskId }`.
- Delete icon — confirm dialog; warns subtree will also be deleted.

### Description toggle on cards
- Dashboard `TaskCard` and `TaskNode`: description collapsed by default.
- `▼ Show description` / `▲ Hide` toggle button beneath title, expands inline.

### Dashboard
- Renders `<TaskTree tasks={rootTasks} />` instead of flat `TaskCard` list.
- Filters (status, priority) apply to roots only (children always shown when parent is shown).

---

## 4. TaskDetail — More Space + AI Improve

- Max container width: `max-w-4xl` (was `max-w-2xl`).
- Description `textarea`: `rows={12}`, auto-grow with CSS (`min-height: 200px; resize: vertical`).
- **"Improve with AI" button** next to the description label.
  - On click → calls `POST /api/tasks/{id}/improve` → shows a review panel beneath the button.
  - Review panel shows proposed title (editable), proposed description (editable), and a list of suggested subtasks each with a checkbox.
  - **Apply** → `PUT` updates title/description; for each checked suggestion, creates a child task.
  - **Cancel/Dismiss** → closes the panel, discards suggestions.
  - Loading spinner, error box (mirrors InputPanel pattern).

---

## 5. Color / Readability Overhaul

### Fix `index.css`
- Move `@tailwind base/components/utilities` to the very top of the file.
- Remove the unused purple-accent CSS-var block (conflicts with Tailwind classes throughout the app).
- Remove the fixed `#root { width: 1126px; text-align: center }` (fights `max-w-*` layouts).
- Keep dark-mode vars only if they are actually referenced; otherwise strip.

### Professional palette (Tailwind classes, no new library)
| Element | Before | After |
|---|---|---|
| Priority low | `bg-green-100 text-green-700` | `bg-slate-100 text-slate-600` |
| Priority medium | `bg-yellow-100 text-yellow-700` | `bg-amber-50 text-amber-700 border border-amber-200` |
| Priority high | `bg-red-100 text-red-700` | `bg-rose-50 text-rose-700 border border-rose-200` |
| Status pending | `text-gray-500` | `text-slate-500` |
| Status in_progress | `text-blue-600` | `text-indigo-600` |
| Status done | `text-green-600` | `text-emerald-600` |
| Card bg | `bg-white border-gray-200` | `bg-white border-slate-200 shadow-sm` |
| Primary button | `bg-blue-600` | `bg-indigo-600` |
| Nav active | `text-blue-600` | `text-slate-900 font-semibold` |
| Label text | `text-gray-400` | `text-slate-500` |
| Placeholder text | `placeholder-gray-300` | `placeholder-slate-400` |

---

## Out of Scope
- Drag-to-reorder within the tree.
- Real-time collaboration.
- Changing the `ParsePreview` or InputPanel AI parsing flow (subtasks created there remain as suggestions that become child tasks on confirm).
- Mobile-specific layout changes beyond what the responsive Tailwind classes provide.
