CREATE TABLE "journal_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"food" text,
	"symptom" text,
	"severity" text,
	"context" text[] DEFAULT '{}' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	CONSTRAINT "journal_entry_food_or_symptom" CHECK ("journal_entry"."food" is not null or "journal_entry"."symptom" is not null),
	CONSTRAINT "journal_entry_food_length" CHECK ("journal_entry"."food" ~ '[^\t\n\v\f\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]' and char_length("journal_entry"."food") <= 1000),
	CONSTRAINT "journal_entry_symptom_length" CHECK ("journal_entry"."symptom" ~ '[^\t\n\v\f\r \u0085\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]' and char_length("journal_entry"."symptom") <= 1000),
	CONSTRAINT "journal_entry_time_zone_length" CHECK (char_length("journal_entry"."time_zone") between 1 and 64),
	CONSTRAINT "journal_entry_severity_value" CHECK ("journal_entry"."severity" in ('low', 'medium', 'high')),
	CONSTRAINT "journal_entry_severity_needs_symptom" CHECK ("journal_entry"."severity" is null or "journal_entry"."symptom" is not null),
	CONSTRAINT "journal_entry_context_values" CHECK ("journal_entry"."context" <@ array['stress', 'travel', 'sleep', 'cycle']::text[])
);
--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entry_user_occurred_idx" ON "journal_entry" USING btree ("user_id","occurred_at");