# Briitely OS Core v1.0.0

Briitely OS Core is a reusable internal business dashboard foundation. It provides a secure, simple interface for staff and administrators to manage day-to-day business operations — customers, invoices, payments, and revenue reporting — through a Briitely (HighLevel) integration.

> **Status:** Frozen baseline — Briitely OS Core v1.0.0. This version is ready to clone for client-specific customization (e.g. Inspired Vacations).

## Architecture

Briitely OS Core separates platform-level code from client-specific configuration:

- **`src/config/client.config.ts`** — Typed, client-neutral configuration: identity defaults, feature flags, revenue configuration, commission configuration, tax/Briitely tax mappings, Briitely user fallback mappings, and invoice/internal defaults.
- **Database-backed `client_settings`** — The preferred source for editable business settings (business name, logo, address, phone, email, website, colours, regional settings, invoice history start date). Admin-configured values override config defaults. Application code falls back to config defaults when a database row is absent.
- **`src/components/app/`** — Application-specific components (login form, dashboard header, workflow cards, invoice flows, etc.).
- **`src/components/core/`** — Reusable UI components (buttons, cards, inputs, invoice line items, revenue widgets, etc.).
- **`src/lib/briitely/`** — Briitely API integration layer (customers, invoices, payments, contacts, users, pricing, products).
- **`src/lib/revenue/`** — Revenue calculation and reporting logic.
- **`src/lib/supabase/`** — Supabase client, auth, and server utilities.
- **`src/lib/tax/`** — Canadian tax calculation engine.

## Feature Flags

Core baseline enabled:
- Authentication
- Users / Access management
- Business Settings
- Customer search / create / update
- Invoice create / edit / send / resend / print
- Payment recording
- Invoice history
- Revenue dashboard
- Recent Work / activity

Optional (off by default):
- Commissions — OFF
- Reports — placeholder / OFF
- Diagnostics — super_admin only

## Environment Variables

See `.env.example` for all required variables:

- `NEXT_PUBLIC_APP_URL` — public deployment URL
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (publishable) key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
- `BRIITELY_PRIVATE_INTEGRATION_TOKEN` — Briitely API token
- `BRIITELY_LOCATION_ID` — Briitely location ID
- `BRIITELY_COMPANY_ID` — Briitely company ID (optional, for user search)

Legacy environment variable aliases are still supported as fallbacks: `GHL_PRIVATE_INTEGRATION_TOKEN`, `GHL_LOCATION_ID`, `GHL_COMPANY_ID`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. In development, a console warning is logged when a legacy name is used. In production, the fallback is silent.

## Feature Flag Enforcement

Feature flags are enforced at both the UI level (navigation visibility, page access) and the API level (route handlers return 403 when a feature is disabled). This prevents bypassing disabled features by calling API endpoints directly. The following modules have API-level enforcement:

- Invoice creation, editing, sending
- Payment recording
- Diagnostics (super_admin role required at the API level)
- Revenue dashboard (enabled flag checked in the revenue API route)
- Commissions (commission upserts are gated behind the commissions feature flag)

## Database

The database schema is managed via Supabase migrations in `supabase/migrations/`. The consolidated Core migration creates:

- `profiles` — user profiles linked to Supabase Auth, with roles (super_admin, admin, staff)
- `client_settings` — admin-configurable business/regional/invoice/branding settings
- `activity_log` — user activity history
- `integration_log` — service-role-only API logging
- `invoice_commissions` — per-invoice commission tracking

Row Level Security is enabled on every table. Admin helper functions (`is_admin()`, `is_super_admin()`, `admin_update_profile()`) are SECURITY DEFINER with execute granted only to authenticated users.

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```
