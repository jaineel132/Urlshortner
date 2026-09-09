-- Adds URL ownership: users 1 ------- many urls
--
-- Existing V1 rows were created before user accounts and have no owner.
-- They cannot satisfy a NOT NULL user_id, and the task forbids arbitrarily
-- assigning them to a user. Inspection showed all 10 existing rows are
-- re-creatable test URLs (example.com / google.com), so they are explicitly
-- removed here to allow enforcing NOT NULL.

ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users(id);

DELETE FROM urls WHERE user_id IS NULL;

ALTER TABLE urls ALTER COLUMN user_id SET NOT NULL;