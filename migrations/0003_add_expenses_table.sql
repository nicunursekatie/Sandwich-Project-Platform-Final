-- Migration: Add Expenses and Receipts Tracking
-- Adds expense tracking system with receipt upload support
-- Generated: 2025-10-29
-- Safe to run: Yes (additive only, no destructive changes)
-- Depends on: 0002_add_unified_activities_schema.sql

-- ============================================================================
-- EXPENSES TABLE - Track expenses and receipts for events, projects, or general use
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  context_type VARCHAR(50),  -- 'event', 'project', 'general'
  context_id INTEGER,  -- FK to event_requests.id or projects.id
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100),  -- 'food', 'supplies', 'transport', 'reimbursement', 'other'
  vendor VARCHAR(255),  -- Where the purchase was made
  purchase_date TIMESTAMP,  -- When the purchase was made
  receipt_url TEXT,  -- URL to receipt file in storage
  receipt_file_name TEXT,  -- Original filename
  receipt_file_size INTEGER,  -- Size in bytes
  uploaded_by VARCHAR NOT NULL,  -- FK to users.id
  uploaded_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR,  -- FK to users.id (for approval workflow)
  approved_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'reimbursed'
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,  -- Additional context
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE expenses IS 'Track expenses and receipt uploads for events, projects, or general organizational use';
COMMENT ON COLUMN expenses.context_type IS 'Type of entity this expense is related to: event, project, or general';
COMMENT ON COLUMN expenses.context_id IS 'Foreign key to the related entity (event_requests.id or projects.id)';
COMMENT ON COLUMN expenses.amount IS 'Expense amount with 2 decimal precision';
COMMENT ON COLUMN expenses.receipt_url IS 'URL to uploaded receipt file in storage service';
COMMENT ON COLUMN expenses.status IS 'Approval status: pending, approved, rejected, or reimbursed';

-- Performance indexes for expenses
CREATE INDEX IF NOT EXISTS idx_expenses_context ON expenses(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_expenses_uploaded_by ON expenses(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_purchase_date ON expenses(purchase_date);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- ============================================================================
-- COMPLETE
-- ============================================================================
