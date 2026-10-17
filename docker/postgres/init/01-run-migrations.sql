-- Runs the existing migrations in an explicit order on FIRST database initialization only.
--
-- PostgreSQL's official entrypoint executes files in /docker-entrypoint-initdb.d/ only
-- when the data directory is empty (a brand-new volume). On later starts, this file is
-- ignored; the non-idempotent migration (add_user_id_to_urls.sql) must never be rerun.
--
-- Order matters: alphabetical order would fail (add_user_id_to_urls.sql needs the
-- users table, and create_users_table.sql must come before it).

\i /migrations/create_urls_table.sql
\i /migrations/create_users_table.sql
\i /migrations/add_user_id_to_urls.sql
\i /migrations/create_analytics_events_table.sql
