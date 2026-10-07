DROP TABLE IF EXISTS "github_credentials";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "github_permission";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "github_threads";
