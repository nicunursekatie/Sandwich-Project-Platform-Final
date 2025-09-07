// src/db/schema.ts (or shared/schema.ts)

import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Clean users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("volunteer"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clean projects table - NO NAME FIELDS
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("pending"),

  // User references - just IDs, no names
  assigneeId: varchar("assignee_id"),
  assigneeIds: jsonb("assignee_ids").$type<string[]>().default([]),
  createdBy: varchar("created_by"),

  // Dates as proper timestamps
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  completionDate: timestamp("completion_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // Other fields
  priority: text("priority").default("medium"),
  category: text("category").default("general"),
  progressPercentage: integer("progress_percentage").default(0),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  notes: text("notes"),
  requirements: text("requirements"),
  deliverables: text("deliverables"),
  resources: text("resources"),
  blockers: text("blockers"),
  tags: text("tags"),
});

// Define relations for automatic joining
export const usersRelations = relations(users, ({ many }) => ({
  assignedProjects: many(projects),
  createdProjects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  assignee: one(users, {
    fields: [projects.assigneeId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
}));

// Do the same for other tables...
export const archivedProjects = pgTable("archived_projects", {
  // ... similar structure, no name fields
});

export const projectTasks = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  status: varchar("status").default("pending"),
  assigneeId: varchar("assignee_id"),
  assigneeIds: jsonb("assignee_ids").$type<string[]>(),
  // NO assigneeName or assigneeNames fields
  dueDate: timestamp("due_date"),
  projectId: integer("project_id"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  assignee: one(users, {
    fields: [projectTasks.assigneeId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [projectTasks.projectId],
    references: [projects.id],
  }),
  completedByUser: one(users, {
    fields: [projectTasks.completedBy],
    references: [users.id],
  }),
}));
