CREATE SCHEMA "screening";
--> statement-breakpoint
CREATE TABLE "diet_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"elimination_ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "diet_plan_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "diet_plan_status" CHECK ("diet_plan"."status" in ('active', 'paused', 'ended'))
);
--> statement-breakpoint
CREATE TABLE "screening"."instrument" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"scoring" jsonb NOT NULL,
	"threshold" integer NOT NULL,
	"is_placeholder" boolean NOT NULL,
	CONSTRAINT "instrument_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "referral_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening"."result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"instrument_id" text NOT NULL,
	"instrument_version" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"tier" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_tier" CHECK ("screening"."result"."tier" in ('below', 'at_or_above'))
);
--> statement-breakpoint
ALTER TABLE "diet_plan" ADD CONSTRAINT "diet_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_log" ADD CONSTRAINT "referral_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening"."result" ADD CONSTRAINT "result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening"."result" ADD CONSTRAINT "result_instrument_id_instrument_version_instrument_id_version_fk" FOREIGN KEY ("instrument_id","instrument_version") REFERENCES "screening"."instrument"("id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_log_user_idx" ON "referral_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "result_user_completed_idx" ON "screening"."result" USING btree ("user_id","completed_at");
--> statement-breakpoint
-- The placeholder instrument (PRD 5.5): data, not code. A real instrument is a new row with a new id or version.
INSERT INTO "screening"."instrument" ("id", "version", "questions", "scoring", "threshold", "is_placeholder") VALUES ('placeholder', 1, '[{"id": "q1", "text": "In the past month, how often did worry about food keep you from a meal you wanted to have?", "options": [{"label": "Never", "value": 0}, {"label": "Sometimes", "value": 1}, {"label": "Often", "value": 2}]}, {"id": "q2", "text": "How often did you skip a meal because you were afraid of how you would feel afterwards?", "options": [{"label": "Never", "value": 0}, {"label": "Sometimes", "value": 1}, {"label": "Often", "value": 2}]}, {"id": "q3", "text": "How often did thoughts about food take up more of your day than you wanted?", "options": [{"label": "Never", "value": 0}, {"label": "Sometimes", "value": 1}, {"label": "Often", "value": 2}]}, {"id": "q4", "text": "How often did you feel guilty after eating?", "options": [{"label": "Never", "value": 0}, {"label": "Sometimes", "value": 1}, {"label": "Often", "value": 2}]}, {"id": "q5", "text": "How often did you avoid eating with other people?", "options": [{"label": "Never", "value": 0}, {"label": "Sometimes", "value": 1}, {"label": "Often", "value": 2}]}]'::jsonb, '{"type":"sum"}'::jsonb, 4, true);
