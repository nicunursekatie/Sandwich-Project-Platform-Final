-- Migration to make firstName, lastName, and organizationName optional in event_requests table
-- This allows creating event requests with minimal required information (just organization name and date)

-- Make first_name nullable
ALTER TABLE "event_requests" ALTER COLUMN "first_name" DROP NOT NULL;

-- Make last_name nullable  
ALTER TABLE "event_requests" ALTER COLUMN "last_name" DROP NOT NULL;

-- Make organization_name nullable
ALTER TABLE "event_requests" ALTER COLUMN "organization_name" DROP NOT NULL;
