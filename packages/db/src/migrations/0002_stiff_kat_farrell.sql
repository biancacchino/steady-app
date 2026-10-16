CREATE TABLE "summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"provider_name" text,
	"appointment_date" date,
	"excluded_entry_ids" uuid[] DEFAULT '{}' NOT NULL,
	"questions" text[] DEFAULT '{}' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"snapshot" jsonb,
	"exported_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "summary_range" CHECK ("summary"."range_end" >= "summary"."range_start" and "summary"."range_end" - "summary"."range_start" < 366),
	CONSTRAINT "summary_questions_count" CHECK (cardinality("summary"."questions") <= 4),
	CONSTRAINT "summary_questions_length" CHECK (char_length(array_to_string("summary"."questions", '')) <= 1200),
	CONSTRAINT "summary_provider_length" CHECK (char_length("summary"."provider_name") between 1 and 100),
	CONSTRAINT "summary_excluded_count" CHECK (cardinality("summary"."excluded_entry_ids") <= 1000),
	CONSTRAINT "summary_reviewed_has_snapshot" CHECK (("summary"."reviewed_at" is null) = ("summary"."snapshot" is null)),
	CONSTRAINT "summary_exported_needs_review" CHECK ("summary"."exported_at" is null or "summary"."reviewed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "summary" ADD CONSTRAINT "summary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "summary_user_idx" ON "summary" USING btree ("user_id");