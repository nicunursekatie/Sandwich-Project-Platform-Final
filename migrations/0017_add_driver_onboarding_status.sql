-- Add onboarding status fields to drivers table
ALTER TABLE "drivers" ADD COLUMN "never_fully_onboarded" boolean DEFAULT false NOT NULL;
ALTER TABLE "drivers" ADD COLUMN "wants_to_restart" boolean DEFAULT false NOT NULL;

-- Add follow-up preference for temporarily unavailable drivers
-- Values: 'will_reach_out' = "I'll reach out when I'm ready" or 'check_back' = "Check back in with me in a few months"
ALTER TABLE "drivers" ADD COLUMN "unavailable_follow_up" text;

-- Add van driving interest field - for drivers interested in driving our van (requires insurance setup)
ALTER TABLE "drivers" ADD COLUMN "interested_in_van_driving" boolean DEFAULT false NOT NULL;
