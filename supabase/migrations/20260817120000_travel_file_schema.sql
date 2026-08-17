/*
# Inspired Vacations — Travel File Schema Foundation

1. Purpose
   Creates the database foundation for the Inspired Vacations Client Journey
   module. Six new tables model a continuous Travel File from first inquiry
   through Travel Complete or Lost. Briitely remains the source of truth for
   the contact/customer record and continues to run communications, forms,
   documents, calendars, and automations. Briitely opportunities remain as
   automation mirrors only.

2. New Tables
   - `travel_files` — master Travel File record (phase, stage, trip details,
     planning, booking, Travefy, insurance, pre-trip, closure, Briitely sync).
   - `travel_actions` — actions/tasks within a Travel File (blocking, supporting,
     conditional) with responsibility, status, timing, escalation, completion.
   - `travel_action_requirements` — checklist items attached to actions.
   - `travel_payments` — payment schedule entries (deposit, installment, final).
   - `travel_consultations` — consultation record with outcome and trip details.
   - `travel_activity` — activity/history timeline for a Travel File.

3. New Enums
   - `travel_file_status`: open, closed
   - `travel_phase`: lead, booked, travel
   - `travel_stage`: new_inquiry, consult_booked, consultation_complete,
     tmf_sent, tmf_processing, planning_proposal, proposal_sent, negotiating,
     proposal_accepted, deposit_received, booking_confirmed, trip_plans_created,
     final_payment_pending, paid_in_full, docs_sent, travelling, travel_complete,
     lost_not_qualified
   - `travel_insurance_status`: pending, accepted, declined, not_required
   - `travel_briitely_sync_status`: synced, pending, failed
   - `travel_action_role`: blocking, supporting, conditional
   - `travel_responsible_type`: internal, client, system
   - `travel_action_status`: pending, active, completed, skipped, blocked
   - `travel_completion_source`: briitely, portal, system, manual_external
   - `travel_requirement_status`: pending, complete, waived
   - `travel_payment_type`: deposit, installment, final, other
   - `travel_payment_status`: upcoming, ready_for_review, client_notified,
     processing, paid, failed, cancelled
   - `travel_consultation_outcome`: proceed, need_information, not_qualified,
     not_fit, no_show
   - `travel_actor_type`: internal, client, system, briitely

4. Foreign Keys
   - travel_files.assigned_advisor_id -> profiles(id) ON DELETE SET NULL
   - travel_files.current_action_id -> travel_actions(id) ON DELETE SET NULL
     (added after travel_actions is created to handle circular FK)
   - travel_actions.travel_file_id -> travel_files(id) ON DELETE CASCADE
   - travel_actions.responsible_user_id -> profiles(id) ON DELETE SET NULL
   - travel_actions.completed_by -> profiles(id) ON DELETE SET NULL
   - travel_actions.superseded_by_action_id -> travel_actions(id) ON DELETE SET NULL
   - travel_action_requirements.travel_action_id -> travel_actions(id) ON DELETE CASCADE
   - travel_action_requirements.completed_by -> profiles(id) ON DELETE SET NULL
   - travel_payments.travel_file_id -> travel_files(id) ON DELETE CASCADE
   - travel_payments.reviewed_by -> profiles(id) ON DELETE SET NULL
   - travel_payments.processed_by -> profiles(id) ON DELETE SET NULL
   - travel_consultations.travel_file_id -> travel_files(id) ON DELETE CASCADE
   - travel_consultations.conducted_by -> profiles(id) ON DELETE SET NULL
   - travel_consultations.assigned_advisor_id -> profiles(id) ON DELETE SET NULL
   - travel_activity.travel_file_id -> travel_files(id) ON DELETE CASCADE
   - travel_activity.actor_user_id -> profiles(id) ON DELETE SET NULL
   - travel_activity.action_id -> travel_actions(id) ON DELETE SET NULL

5. Indexes
   - travel_files: file_status, stage, assigned_advisor_id, departure_date,
     briitely_contact_id, lead_opportunity_id, booking_opportunity_id
   - travel_actions: travel_file_id, responsible_user_id, responsible_type,
     status, due_at
   - travel_payments: travel_file_id, status, due_date
   - travel_activity: travel_file_id, created_at

6. Triggers
   - Reuses existing public.update_updated_at_column() function.
   - Adds BEFORE UPDATE triggers on travel_files, travel_actions, travel_payments.

7. Security (RLS)
   - RLS enabled on all six new tables.
   - SELECT: authenticated active users (super_admin, admin, staff) can read all
     Travel File operational data.
   - INSERT/UPDATE: authenticated active users can create/update.
   - DELETE: admin and super_admin only.
   - Uses existing is_admin() and is_super_admin() helper functions.
   - No access for anon role.
   - Does not weaken existing Core RLS.

8. Important Notes
   - No workflow automation, stage transitions, action generation, escalation
     jobs, or UI is included — schema foundation only.
   - `won_ready_to_book` is intentionally NOT a travel_stage value; it remains a
     Briitely automation milestone between Negotiating and Proposal Accepted.
   - No credit card numbers, CVV, payment credentials, or passport data are
     stored in any table.
   - Migration is idempotent (IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS).
   - This migration does NOT modify or recreate any existing Briitely OS Core
     tables (profiles, client_settings, activity_log, integration_log,
     invoice_commissions) or their functions/triggers/policies.
*/

-- =========================================================
-- 1. Enums
-- =========================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_file_status') THEN
    CREATE TYPE public.travel_file_status AS ENUM ('open', 'closed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_phase') THEN
    CREATE TYPE public.travel_phase AS ENUM ('lead', 'booked', 'travel');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_stage') THEN
    CREATE TYPE public.travel_stage AS ENUM (
      'new_inquiry', 'consult_booked', 'consultation_complete',
      'tmf_sent', 'tmf_processing', 'planning_proposal', 'proposal_sent',
      'negotiating', 'proposal_accepted', 'deposit_received',
      'booking_confirmed', 'trip_plans_created', 'final_payment_pending',
      'paid_in_full', 'docs_sent', 'travelling', 'travel_complete',
      'lost_not_qualified'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_insurance_status') THEN
    CREATE TYPE public.travel_insurance_status AS ENUM ('pending', 'accepted', 'declined', 'not_required');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_briitely_sync_status') THEN
    CREATE TYPE public.travel_briitely_sync_status AS ENUM ('synced', 'pending', 'failed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_action_role') THEN
    CREATE TYPE public.travel_action_role AS ENUM ('blocking', 'supporting', 'conditional');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_responsible_type') THEN
    CREATE TYPE public.travel_responsible_type AS ENUM ('internal', 'client', 'system');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_action_status') THEN
    CREATE TYPE public.travel_action_status AS ENUM ('pending', 'active', 'completed', 'skipped', 'blocked');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_completion_source') THEN
    CREATE TYPE public.travel_completion_source AS ENUM ('briitely', 'portal', 'system', 'manual_external');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_requirement_status') THEN
    CREATE TYPE public.travel_requirement_status AS ENUM ('pending', 'complete', 'waived');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_payment_type') THEN
    CREATE TYPE public.travel_payment_type AS ENUM ('deposit', 'installment', 'final', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_payment_status') THEN
    CREATE TYPE public.travel_payment_status AS ENUM (
      'upcoming', 'ready_for_review', 'client_notified', 'processing', 'paid', 'failed', 'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_consultation_outcome') THEN
    CREATE TYPE public.travel_consultation_outcome AS ENUM ('proceed', 'need_information', 'not_qualified', 'not_fit', 'no_show');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_actor_type') THEN
    CREATE TYPE public.travel_actor_type AS ENUM ('internal', 'client', 'system', 'briitely');
  END IF;
END $$;

-- =========================================================
-- 2. travel_files table (without current_action_id FK initially)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Briitely linkage
  briitely_contact_id text NOT NULL,
  lead_opportunity_id text,
  booking_opportunity_id text,

  -- Display/cache
  client_name text NOT NULL,

  -- Operational state
  file_status public.travel_file_status NOT NULL DEFAULT 'open',
  phase public.travel_phase NOT NULL DEFAULT 'lead',
  stage public.travel_stage NOT NULL DEFAULT 'new_inquiry',
  current_action_id uuid,
  stage_changed_at timestamptz NOT NULL DEFAULT now(),

  -- Inquiry
  inquiry_source text,
  inquiry_received_at timestamptz NOT NULL DEFAULT now(),

  -- Assignment
  assigned_advisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Trip
  destination text,
  trip_type text,
  number_of_travellers integer,
  departure_date date,
  return_date date,
  budget_range text,

  -- Planning
  tmf_amount numeric(12,2),
  ivt_custom boolean,
  proposal_due_date date,
  revisions_allowed integer,
  revisions_used integer NOT NULL DEFAULT 0,

  -- Booking
  date_booked date,
  total_booking_value numeric(12,2),
  clientbase_res_card_id text,
  primary_booking_number text,

  -- Travefy
  travefy_proposal_url text,
  travefy_trip_plan_url text,
  trip_plan_sent_at timestamptz,
  trip_plan_final_proof_at timestamptz,

  -- Insurance
  insurance_status public.travel_insurance_status NOT NULL DEFAULT 'pending',
  insurance_waiver_signed boolean,

  -- Pre-trip
  pretrip_meeting_required boolean,
  pretrip_meeting_booked_at timestamptz,
  pretrip_card_sent_at timestamptz,

  -- Booking registration
  booking_registration_eligible boolean NOT NULL DEFAULT false,
  booking_registration_done_at timestamptz,

  -- Notes
  special_requests text,
  internal_notes text,

  -- Closure
  lost_reason text,
  closed_at timestamptz,

  -- Briitely synchronization
  briitely_sync_status public.travel_briitely_sync_status NOT NULL DEFAULT 'synced',
  briitely_last_synced_at timestamptz,
  briitely_sync_error text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. travel_actions table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,

  -- Action
  action_code text NOT NULL,
  title text NOT NULL,
  description text,

  -- Role
  action_role public.travel_action_role NOT NULL DEFAULT 'blocking',

  -- Responsibility
  responsible_type public.travel_responsible_type NOT NULL,
  responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Status
  status public.travel_action_status NOT NULL DEFAULT 'pending',

  -- Timing
  due_at timestamptz,
  waiting_since timestamptz,
  activated_at timestamptz,
  completed_at timestamptz,

  -- Completion
  completion_source public.travel_completion_source,
  completion_event text,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Escalation
  escalation_at timestamptz,
  escalated_at timestamptz,
  superseded_by_action_id uuid REFERENCES public.travel_actions(id) ON DELETE SET NULL,

  -- Additional
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 4. Add circular FK: travel_files.current_action_id -> travel_actions
-- =========================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'travel_files_current_action_id_fkey'
      AND table_name = 'travel_files'
  ) THEN
    ALTER TABLE public.travel_files
      ADD CONSTRAINT travel_files_current_action_id_fkey
      FOREIGN KEY (current_action_id) REFERENCES public.travel_actions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 5. travel_action_requirements table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_action_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_action_id uuid NOT NULL REFERENCES public.travel_actions(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  label text NOT NULL,
  status public.travel_requirement_status NOT NULL DEFAULT 'pending',
  completion_source public.travel_completion_source,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 6. travel_payments table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,

  -- Payment
  payment_type public.travel_payment_type NOT NULL,
  sequence_number integer,
  description text,
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'CAD',

  -- Timing
  due_date date NOT NULL,
  internal_review_date date,
  client_notification_date date,

  -- Status
  status public.travel_payment_status NOT NULL DEFAULT 'upcoming',

  -- Processing
  details text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at timestamptz,
  external_reference text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 7. travel_consultations table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,

  -- Consult
  conducted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_id text,
  consulted_at timestamptz NOT NULL DEFAULT now(),

  -- Outcome
  outcome public.travel_consultation_outcome NOT NULL,

  -- Trip details captured
  destination text,
  trip_type text,
  number_of_travellers integer,
  departure_date date,
  return_date date,
  budget_range text,
  estimated_booking_value numeric(12,2),

  -- Planning
  tmf_amount numeric(12,2),
  ivt_custom boolean,
  assigned_advisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  proposal_due_date date,
  revisions_allowed integer,

  -- Notes
  discussion_summary text,
  recommendations text,
  next_steps text,

  -- System
  recap_email_triggered_at timestamptz,
  briitely_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 8. travel_activity table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.travel_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_file_id uuid NOT NULL REFERENCES public.travel_files(id) ON DELETE CASCADE,

  -- Event
  event_type text NOT NULL,
  summary text NOT NULL,

  -- Actor
  actor_type public.travel_actor_type NOT NULL,
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- References
  action_id uuid REFERENCES public.travel_actions(id) ON DELETE SET NULL,
  previous_stage public.travel_stage,
  new_stage public.travel_stage,

  -- Additional
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 9. Indexes
-- =========================================================

-- travel_files
CREATE INDEX IF NOT EXISTS idx_travel_files_file_status
  ON public.travel_files (file_status);
CREATE INDEX IF NOT EXISTS idx_travel_files_stage
  ON public.travel_files (stage);
CREATE INDEX IF NOT EXISTS idx_travel_files_assigned_advisor_id
  ON public.travel_files (assigned_advisor_id);
CREATE INDEX IF NOT EXISTS idx_travel_files_departure_date
  ON public.travel_files (departure_date);
CREATE INDEX IF NOT EXISTS idx_travel_files_briitely_contact_id
  ON public.travel_files (briitely_contact_id);
CREATE INDEX IF NOT EXISTS idx_travel_files_lead_opportunity_id
  ON public.travel_files (lead_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_travel_files_booking_opportunity_id
  ON public.travel_files (booking_opportunity_id);

-- travel_actions
CREATE INDEX IF NOT EXISTS idx_travel_actions_travel_file_id
  ON public.travel_actions (travel_file_id);
CREATE INDEX IF NOT EXISTS idx_travel_actions_responsible_user_id
  ON public.travel_actions (responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_travel_actions_responsible_type
  ON public.travel_actions (responsible_type);
CREATE INDEX IF NOT EXISTS idx_travel_actions_status
  ON public.travel_actions (status);
CREATE INDEX IF NOT EXISTS idx_travel_actions_due_at
  ON public.travel_actions (due_at);

-- travel_payments
CREATE INDEX IF NOT EXISTS idx_travel_payments_travel_file_id
  ON public.travel_payments (travel_file_id);
CREATE INDEX IF NOT EXISTS idx_travel_payments_status
  ON public.travel_payments (status);
CREATE INDEX IF NOT EXISTS idx_travel_payments_due_date
  ON public.travel_payments (due_date);

-- travel_activity
CREATE INDEX IF NOT EXISTS idx_travel_activity_travel_file_id
  ON public.travel_activity (travel_file_id);
CREATE INDEX IF NOT EXISTS idx_travel_activity_created_at
  ON public.travel_activity (created_at);

-- =========================================================
-- 10. Updated-at triggers (reuse existing function)
-- =========================================================

DROP TRIGGER IF EXISTS trg_travel_files_updated_at ON public.travel_files;
CREATE TRIGGER trg_travel_files_updated_at
  BEFORE UPDATE ON public.travel_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_travel_actions_updated_at ON public.travel_actions;
CREATE TRIGGER trg_travel_actions_updated_at
  BEFORE UPDATE ON public.travel_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_travel_payments_updated_at ON public.travel_payments;
CREATE TRIGGER trg_travel_payments_updated_at
  BEFORE UPDATE ON public.travel_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 11. Enable RLS on all six new tables
-- =========================================================
ALTER TABLE public.travel_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_action_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_activity ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 12. RLS Policies
--
-- All six tables share the same permission model:
--   SELECT  — any authenticated user with an active profile
--   INSERT  — any authenticated user with an active profile
--   UPDATE  — any authenticated user with an active profile
--   DELETE  — admin or super_admin only
-- =========================================================

-- ---- travel_files ----
DROP POLICY IF EXISTS "travel_files_select_authenticated" ON public.travel_files;
CREATE POLICY "travel_files_select_authenticated"
  ON public.travel_files FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_files_insert_authenticated" ON public.travel_files;
CREATE POLICY "travel_files_insert_authenticated"
  ON public.travel_files FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_files_update_authenticated" ON public.travel_files;
CREATE POLICY "travel_files_update_authenticated"
  ON public.travel_files FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_files_delete_admin" ON public.travel_files;
CREATE POLICY "travel_files_delete_admin"
  ON public.travel_files FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- travel_actions ----
DROP POLICY IF EXISTS "travel_actions_select_authenticated" ON public.travel_actions;
CREATE POLICY "travel_actions_select_authenticated"
  ON public.travel_actions FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_actions_insert_authenticated" ON public.travel_actions;
CREATE POLICY "travel_actions_insert_authenticated"
  ON public.travel_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_actions_update_authenticated" ON public.travel_actions;
CREATE POLICY "travel_actions_update_authenticated"
  ON public.travel_actions FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_actions_delete_admin" ON public.travel_actions;
CREATE POLICY "travel_actions_delete_admin"
  ON public.travel_actions FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- travel_action_requirements ----
DROP POLICY IF EXISTS "travel_action_req_select_authenticated" ON public.travel_action_requirements;
CREATE POLICY "travel_action_req_select_authenticated"
  ON public.travel_action_requirements FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_action_req_insert_authenticated" ON public.travel_action_requirements;
CREATE POLICY "travel_action_req_insert_authenticated"
  ON public.travel_action_requirements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_action_req_update_authenticated" ON public.travel_action_requirements;
CREATE POLICY "travel_action_req_update_authenticated"
  ON public.travel_action_requirements FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_action_req_delete_admin" ON public.travel_action_requirements;
CREATE POLICY "travel_action_req_delete_admin"
  ON public.travel_action_requirements FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- travel_payments ----
DROP POLICY IF EXISTS "travel_payments_select_authenticated" ON public.travel_payments;
CREATE POLICY "travel_payments_select_authenticated"
  ON public.travel_payments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_payments_insert_authenticated" ON public.travel_payments;
CREATE POLICY "travel_payments_insert_authenticated"
  ON public.travel_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_payments_update_authenticated" ON public.travel_payments;
CREATE POLICY "travel_payments_update_authenticated"
  ON public.travel_payments FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_payments_delete_admin" ON public.travel_payments;
CREATE POLICY "travel_payments_delete_admin"
  ON public.travel_payments FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- travel_consultations ----
DROP POLICY IF EXISTS "travel_consultations_select_authenticated" ON public.travel_consultations;
CREATE POLICY "travel_consultations_select_authenticated"
  ON public.travel_consultations FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_consultations_insert_authenticated" ON public.travel_consultations;
CREATE POLICY "travel_consultations_insert_authenticated"
  ON public.travel_consultations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_consultations_update_authenticated" ON public.travel_consultations;
CREATE POLICY "travel_consultations_update_authenticated"
  ON public.travel_consultations FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_consultations_delete_admin" ON public.travel_consultations;
CREATE POLICY "travel_consultations_delete_admin"
  ON public.travel_consultations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---- travel_activity ----
DROP POLICY IF EXISTS "travel_activity_select_authenticated" ON public.travel_activity;
CREATE POLICY "travel_activity_select_authenticated"
  ON public.travel_activity FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_activity_insert_authenticated" ON public.travel_activity;
CREATE POLICY "travel_activity_insert_authenticated"
  ON public.travel_activity FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_activity_update_authenticated" ON public.travel_activity;
CREATE POLICY "travel_activity_update_authenticated"
  ON public.travel_activity FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "travel_activity_delete_admin" ON public.travel_activity;
CREATE POLICY "travel_activity_delete_admin"
  ON public.travel_activity FOR DELETE
  TO authenticated
  USING (public.is_admin());
