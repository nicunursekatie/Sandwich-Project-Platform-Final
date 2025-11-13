-- Migration: Identify duplicate projects (same title, different statuses)
-- Created: 2025-01-XX

-- ============================================================================
-- STEP 1: PREVIEW - Find duplicate projects by title
-- ============================================================================
-- Run this to see which projects are duplicated:

SELECT 
  title,
  COUNT(*) as duplicate_count,
  STRING_AGG(DISTINCT status::text, ', ' ORDER BY status::text) as statuses,
  STRING_AGG(id::text, ', ' ORDER BY id) as project_ids,
  STRING_AGG(
    id::text || ' (' || status || ', created: ' || TO_CHAR(created_at, 'YYYY-MM-DD') || ')',
    ' | ' ORDER BY created_at
  ) as details
FROM projects
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, title;

-- ============================================================================
-- STEP 2: PREVIEW - Find projects that exist as both 'in_progress' and 'completed'
-- ============================================================================
-- Run this to see specific duplicates with these statuses:

WITH duplicate_titles AS (
  SELECT title
  FROM projects
  WHERE status IN ('in_progress', 'completed')
  GROUP BY title
  HAVING COUNT(DISTINCT status) > 1
)
SELECT 
  p.id,
  p.title,
  p.status,
  p.priority,
  p.category,
  p.assignee_name,
  p.created_at,
  p.updated_at,
  p.google_sheet_row_id,
  CASE 
    WHEN p.status = 'completed' AND p.updated_at < (
      SELECT updated_at 
      FROM projects p2 
      WHERE p2.title = p.title 
        AND p2.status = 'in_progress'
      LIMIT 1
    ) THEN 'OLDER_COMPLETED'
    WHEN p.status = 'completed' THEN 'NEWER_COMPLETED'
    ELSE 'IN_PROGRESS'
  END as priority_action
FROM projects p
WHERE p.title IN (SELECT title FROM duplicate_titles)
  AND p.status IN ('in_progress', 'completed')
ORDER BY p.title, p.created_at;

-- ============================================================================
-- STEP 3: DECISION - Choose which duplicates to keep/archive
-- ============================================================================
-- Based on the results above, decide which version to keep.
-- Generally:
-- - Keep the 'in_progress' version if work is ongoing
-- - Archive the 'completed' version if work is done
-- - Keep the newer version if one is clearly more recent
--
-- After reviewing, you can manually:
-- 1. Archive the completed duplicates that are outdated
-- 2. Delete duplicates that are clearly mistakes
-- 3. Merge data if needed before archiving one

-- ============================================================================
-- STEP 4: OPTIONAL - Auto-archive old completed duplicates
-- ============================================================================
-- WARNING: Review Step 2 results carefully before running this!
-- This will archive completed projects that have a newer in_progress version

/*
-- First, archive the older completed duplicates
INSERT INTO archived_projects (
  original_project_id,
  title,
  description,
  priority,
  category,
  assignee_id,
  assignee_name,
  assignee_ids,
  assignee_names,
  due_date,
  start_date,
  completion_date,
  progress_percentage,
  notes,
  requirements,
  deliverables,
  resources,
  blockers,
  tags,
  estimated_hours,
  actual_hours,
  budget,
  created_by,
  created_by_name,
  created_at,
  completed_at,
  archived_at,
  google_sheet_row_id
)
SELECT 
  p.id as original_project_id,
  p.title,
  p.description,
  COALESCE(p.priority, 'medium') as priority,
  COALESCE(p.category, 'general') as category,
  p.assignee_id,
  p.assignee_name,
  p.assignee_ids,
  p.assignee_names,
  p.due_date,
  p.start_date,
  COALESCE(p.completion_date, TO_CHAR(NOW(), 'YYYY-MM-DD')) as completion_date,
  COALESCE(p.progress_percentage, 100) as progress_percentage,
  p.notes,
  p.requirements,
  p.deliverables,
  p.resources,
  p.blockers,
  p.tags,
  p.estimated_hours,
  p.actual_hours,
  p.budget,
  p.created_by,
  p.created_by_name,
  p.created_at,
  COALESCE(p.completion_date::timestamp, NOW()) as completed_at,
  p.updated_at as archived_at,
  p.google_sheet_row_id
FROM projects p
WHERE p.status = 'completed'
  AND EXISTS (
    -- Only archive if there's an in_progress version
    SELECT 1 
    FROM projects p2 
    WHERE p2.title = p.title 
      AND p2.status = 'in_progress'
      AND p2.id != p.id
  )
  -- Only archive if the completed version is older
  AND p.updated_at <= (
    SELECT MAX(updated_at)
    FROM projects p3
    WHERE p3.title = p.title
      AND p3.status = 'in_progress'
  )
  -- Don't archive if already archived
  AND NOT EXISTS (
    SELECT 1 FROM archived_projects 
    WHERE original_project_id = p.id
  );

-- Then delete the archived completed duplicates from projects table
DELETE FROM projects
WHERE id IN (
  SELECT original_project_id 
  FROM archived_projects 
  WHERE original_project_id IN (
    SELECT p.id
    FROM projects p
    WHERE p.status = 'completed'
      AND EXISTS (
        SELECT 1 
        FROM projects p2 
        WHERE p2.title = p.title 
          AND p2.status = 'in_progress'
          AND p2.id != p.id
      )
      AND p.updated_at <= (
        SELECT MAX(updated_at)
        FROM projects p3
        WHERE p3.title = p.title
          AND p3.status = 'in_progress'
      )
  )
);
*/

