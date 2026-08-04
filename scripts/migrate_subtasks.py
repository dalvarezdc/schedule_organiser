#!/usr/bin/env python3
"""
One-shot migration: convert existing Subtask rows into child Task rows,
then add parent_id/order columns to tasks if they don't exist yet.

Run from the repo root:
    python scripts/migrate_subtasks.py
"""
import sqlite3
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "schedule.db"


def migrate(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Add parent_id and order columns to tasks (idempotent)
    existing_cols = {row[1] for row in cur.execute("PRAGMA table_info(tasks)")}
    if "parent_id" not in existing_cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE")
        print("Added parent_id column to tasks")
    else:
        print("parent_id column already exists")
    if "order" not in existing_cols:
        cur.execute("ALTER TABLE tasks ADD COLUMN 'order' INTEGER DEFAULT 0")
        print("Added order column to tasks")
    else:
        print("order column already exists")

    # 2. Check if subtasks table exists
    tables = {row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "subtasks" not in tables:
        print("No subtasks table found — nothing to migrate.")
        conn.commit()
        conn.close()
        return

    # 3. Migrate each subtask row into a Task row
    subtasks = cur.execute("SELECT * FROM subtasks").fetchall()
    migrated = 0
    for sub in subtasks:
        new_id = str(uuid.uuid4())
        status = "done" if sub["done"] else "pending"
        cur.execute(
            """
            INSERT INTO tasks (id, title, description, status, priority,
                               parent_id, 'order', created_at, updated_at)
            VALUES (?, ?, '', ?, 'medium', ?, ?, datetime('now'), datetime('now'))
            """,
            (new_id, sub["title"], status, sub["task_id"], sub["order"]),
        )
        migrated += 1

    print(f"Migrated {migrated} subtask(s) to child Task rows")

    # 4. Drop the subtasks table
    cur.execute("DROP TABLE subtasks")
    print("Dropped subtasks table")

    conn.commit()
    conn.close()
    print("Migration complete.")


if __name__ == "__main__":
    migrate(DB_PATH)
