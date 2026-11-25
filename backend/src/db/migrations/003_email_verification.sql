-- E-mail confirmation. Accounts created before this migration have no e-mail and keep
-- logging in; new accounts must confirm theirs first. E-mails are not unique: a parent
-- may register several children with the same address.
ALTER TABLE students
  ADD COLUMN email text CHECK (char_length(email) <= 254),
  ADD COLUMN email_verified_at timestamptz;

-- One-time confirmation links. Only the SHA-256 of the token is stored.
CREATE TABLE email_verifications (
  token_hash text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX email_verifications_student_id_idx ON email_verifications(student_id);
CREATE INDEX email_verifications_expires_at_idx ON email_verifications(expires_at);
