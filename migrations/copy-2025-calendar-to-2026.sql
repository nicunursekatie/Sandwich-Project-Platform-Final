-- Copy all 2025 yearly calendar items to 2026
-- Run this once to migrate items to the correct year

INSERT INTO yearly_calendar_items (
  month, year, title, description, category, priority,
  created_by, created_by_name, assigned_to, assigned_to_names,
  is_recurring, is_completed, created_at, updated_at
)
SELECT
  month,
  2026 as year,
  title,
  description,
  category,
  priority,
  created_by,
  created_by_name,
  assigned_to,
  assigned_to_names,
  is_recurring,
  false as is_completed,  -- Reset completion status for new year
  NOW() as created_at,
  NOW() as updated_at
FROM yearly_calendar_items
WHERE year = 2025;

-- Optionally delete the 2025 items after copying (uncomment if desired):
-- DELETE FROM yearly_calendar_items WHERE year = 2025;
