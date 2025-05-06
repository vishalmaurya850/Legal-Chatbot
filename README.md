To delete migration in supabase
delete from supabase_migrations.schema_migrations

Create new migration
npx supabase migration new new-migration

Link with supabase project
npx supabase link --project-ref projectid

Push migration with log file
npx supabase db push --debug