-- Add subtask support to project_tasks table
-- Allows tasks to have parent tasks (subtasks)

-- Add parent_task_id column for subtask relationships
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "parent_task_id" integer;

-- Add promoted_to_todo column for promoting subtasks to to-do list
ALTER TABLE "project_tasks" ADD COLUMN IF NOT EXISTS "promoted_to_todo" boolean DEFAULT false NOT NULL;

-- Create index for efficient subtask queries
CREATE INDEX IF NOT EXISTS "idx_project_tasks_parent"
ON "project_tasks"("parent_task_id");

-- Create index for to-do list queries (tasks promoted to to-do)
CREATE INDEX IF NOT EXISTS "idx_project_tasks_promoted_todo"
ON "project_tasks"("promoted_to_todo") WHERE "promoted_to_todo" = true;
