Apply Supabase schema
======================

This folder contains the SQL migration `supabase_schema.sql` used to create the initial MindPoint Arena schema on Supabase.

What this README provides:
- Quick validation suggestions (local checks you can run)
- Two recommended ways to apply the SQL to your Supabase project (Supabase CLI and psql)

Basic validation (local)
- Ensure the file is valid UTF-8 and has no trailing binary chars. On Windows PowerShell:

```powershell
Get-Content -Path .\supabase_schema.sql -Encoding utf8 | Out-Null
```

- A simple grep for unmatched dollar-quote terminators: (PowerShell)

```powershell
Select-String -Path .\supabase_schema.sql -Pattern '\$\$' | Measure-Object
```

Applying the schema

1) Using Supabase CLI (recommended)

- Install the supabase CLI (https://supabase.com/docs/guides/cli).
- Authenticate and set your project ref.
- Run:

```powershell
# Windows PowerShell (from repo root)
cd .\infra
supabase db remote set <YOUR_PROJECT_REF>
supabase db push --file .\supabase_schema.sql
```

Note: `supabase db push` applies migrations. If your version of the CLI requires a migrations folder, you can split the SQL into a numbered file (e.g. `migrations/0001_init.sql`) and use the migrations flow.

2) Using psql (directly against database)

- Get your Supabase DB connection string from Project → Settings → Database → Connection string.
- Then run (PowerShell example):

```powershell
# replace the connection string with your Supabase DB connection string
$conn = 'postgresql://postgres:YOUR_DB_PASSWORD@db.your-project-ref.supabase.co:5432/postgres'
psql $conn -f .\supabase_schema.sql
```

Important notes
- Keep your `service_role` key and DB credentials secret. Do NOT commit them.
- The SQL file may include RLS (Row-Level Security) policies that depend on `auth.users` — make sure Auth is enabled in your Supabase project before applying RLS policies.
- If any statement fails, inspect the error and apply changes incrementally (split file into smaller chunks).

If you want, I can:
- split `supabase_schema.sql` into migration files compatible with `supabase db push`;
- create a Git commit message and add the file to the repo index.

---
Generated helpers: `apply_schema.ps1` (PowerShell) can be used to run a quick apply using `psql` if desired.
