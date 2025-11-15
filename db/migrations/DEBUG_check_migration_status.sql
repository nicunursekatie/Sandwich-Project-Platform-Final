-- Check if the new tables exist and have correct structure

-- Check if project_assignments table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'project_assignments'
) as project_assignments_exists;

-- If it exists, show its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_assignments'
ORDER BY ordinal_position;

-- Check if other new tables exist
SELECT
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'task_assignments') as task_assignments_exists,
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_board_assignments') as team_board_assignments_exists,
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'meeting_projects') as meeting_projects_exists;
