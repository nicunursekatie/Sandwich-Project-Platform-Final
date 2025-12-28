-- Add onboarding status fields to drivers table
ALTER TABLE "drivers" ADD COLUMN "never_fully_onboarded" boolean DEFAULT false NOT NULL;
ALTER TABLE "drivers" ADD COLUMN "wants_to_restart" boolean DEFAULT false NOT NULL;
