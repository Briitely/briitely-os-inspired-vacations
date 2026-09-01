-- Add Adult Child as a permanent customer relationship type.
-- Existing household rows are preserved for compatibility, but the UI no longer offers Household or Friend.

alter table public.client_relationships
  drop constraint if exists client_relationships_relationship_type_check;

alter table public.client_relationships
  add constraint client_relationships_relationship_type_check
  check (relationship_type in ('spouse_partner','child','adult_child','parent','other_family','household'));
