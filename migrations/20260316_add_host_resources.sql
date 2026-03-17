-- Create host_resources table for manageable reference materials
CREATE TABLE IF NOT EXISTS host_resources (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  file_type VARCHAR(20),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed with existing hardcoded documents
INSERT INTO host_resources (title, description, category, file_type, file_url, file_name, sort_order) VALUES
  ('TSP Host Handbook', 'Complete guide for host collection sites — everything you need to know about hosting a sandwich collection', 'document', 'PDF', '/documents/tsp-host-handbook.pdf', 'tsp-host-handbook.pdf', 1),
  ('Deli Sandwich Labels', 'Pre-formatted labels for deli meat sandwiches with ingredient info', 'document', 'PDF', '/documents/deli-labels.pdf', 'deli-labels.pdf', 2),
  ('PB&J Sandwich Labels', 'Pre-formatted labels for peanut butter & jelly sandwiches', 'document', 'PDF', '/documents/pbj-labels.pdf', 'pbj-labels.pdf', 3),
  ('Volunteer Sign-In Sheet', 'Sign-in sheet for tracking volunteer attendance at your site', 'document', 'PDF', '/documents/volunteer-sign-in-sheet.pdf', 'volunteer-sign-in-sheet.pdf', 4),
  ('Food Safety for Hosts', 'Food safety guidelines and best practices for host collection sites', 'document', 'PDF', '/documents/food-safety-hosts.pdf', 'food-safety-hosts.pdf', 5),
  ('Deli Sandwich Making 101', 'Step-by-step guide for making deli sandwiches', 'document', 'PDF', '/documents/deli-sandwich-making-101.pdf', 'deli-sandwich-making-101.pdf', 6),
  ('PB&J Sandwich Making 101', 'Step-by-step guide for making peanut butter & jelly sandwiches', 'document', 'PDF', '/documents/pbj-sandwich-making-101.pdf', 'pbj-sandwich-making-101.pdf', 7),
  ('Deli Sandwich Assembly', 'Deli sandwich assembly guide with portion sizes in ounces', 'image', 'JPEG', '/images/sandwich-assembly.jpeg', 'deli-sandwich-assembly-ounces.jpeg', 10),
  ('White Bread Sandwich', 'Complete sandwich with white bread - bread, cheese, meat, cheese, bread', 'image', 'PNG', '/images/sandwich-white-bread.png', 'sandwich-white-bread.png', 11),
  ('Why Cheese on the Bottom', 'Cheese acts as a moisture barrier to keep bread from getting soggy', 'image', 'PNG', '/images/why-cheese-bottom.png', 'why-cheese-bottom.png', 12),
  ('PB&J Assembly', 'Peanut butter on both slices, jelly on one - 3 easy steps', 'image', 'PNG', '/images/pbj-assembly.png', 'pbj-assembly.png', 13);
