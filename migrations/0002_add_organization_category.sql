-- Add category and schoolClassification fields to organizations table
ALTER TABLE "organizations" ADD COLUMN "category" varchar;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "school_classification" varchar;