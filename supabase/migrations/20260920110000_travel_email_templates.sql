CREATE TABLE IF NOT EXISTS public.travel_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_code text NOT NULL UNIQUE,
  email_name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);
DROP TRIGGER IF EXISTS set_travel_email_templates_updated_at ON public.travel_email_templates;
CREATE TRIGGER set_travel_email_templates_updated_at BEFORE UPDATE ON public.travel_email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.travel_email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read travel email templates" ON public.travel_email_templates;
CREATE POLICY "Staff can read travel email templates" ON public.travel_email_templates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true));
DROP POLICY IF EXISTS "Admins can manage travel email templates" ON public.travel_email_templates;
CREATE POLICY "Admins can manage travel email templates" ON public.travel_email_templates FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true AND p.role IN ('admin','super_admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active=true AND p.role IN ('admin','super_admin')));
INSERT INTO public.travel_email_templates(email_code,email_name,subject,body_html) VALUES
('trip_plans_sent','TripPlans Has Been Sent','Your TripPlans Itinerary is Ready! ✈️','<p>Hi {{first_name}},</p><p>Your trip itinerary is ready to view — and everything you need for your upcoming adventure is right at your fingertips! ✈️</p><p>Inside the Trip Plans App, you''ll find:</p><p>✅ Your booking confirmations</p><p>✅ Daily details and travel tips</p><p>✅ Important links and documents</p><p>Here''s how to access your trip:</p><p>1️⃣ Click “View in App” when prompted.</p><p>2️⃣ If you already have the Trip Plans app, your itinerary will open automatically.</p><p>3️⃣ Tap “Back,” then “Add this trip to your account.”</p><p>4️⃣ If you don''t have an account yet, you''ll be asked to create one (just your email and a password!).</p><p>💡 Prefer a browser? You can also choose “View Online” to access everything from your computer.</p><p>Having trouble opening your trip?</p><p>If you''ve followed the steps and it''s still not loading, try refreshing by returning to your original email instructions and selecting “View in App” again.</p><p>Still no luck? Just email — we''re happy to help get you connected.</p><p>Happy travels,</p><p>The Inspired Vacations Team 🌍✨</p><p><a href="{{travefy_trip_plan_url}}">View Itinerary</a></p>')
ON CONFLICT(email_code) DO NOTHING;
