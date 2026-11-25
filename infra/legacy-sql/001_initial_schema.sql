CREATE TABLE students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  nickname_key text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE student_sessions (
  session_hash text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX student_sessions_student_id_idx ON student_sessions(student_id);
CREATE INDEX student_sessions_expires_at_idx ON student_sessions(expires_at);

CREATE TABLE course_levels (
  id integer PRIMARY KEY,
  chapter integer NOT NULL CHECK (chapter BETWEEN 1 AND 5),
  unit integer NOT NULL CHECK (unit BETWEEN 1 AND 3),
  lesson integer NOT NULL CHECK (lesson BETWEEN 1 AND 9),
  content_version integer NOT NULL DEFAULT 1 CHECK (content_version > 0),
  public_data jsonb NOT NULL,
  answer_key jsonb NOT NULL,
  is_bonus boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE level_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level_id integer NOT NULL REFERENCES course_levels(id),
  idempotency_key text NOT NULL,
  submitted_answers jsonb NOT NULL,
  is_correct boolean NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, idempotency_key)
);
CREATE INDEX level_attempts_student_created_idx ON level_attempts(student_id, created_at DESC);

CREATE TABLE level_completions (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level_id integer NOT NULL REFERENCES course_levels(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, level_id)
);

CREATE TABLE xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('level', 'daily_challenge')),
  source_id text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, source, source_id)
);
CREATE INDEX xp_events_student_created_idx ON xp_events(student_id, created_at DESC);

CREATE TABLE student_progress (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  total_solved integer NOT NULL DEFAULT 0 CHECK (total_solved >= 0),
  streak_days integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  last_active_on date,
  completed_daily_challenges integer NOT NULL DEFAULT 0 CHECK (completed_daily_challenges >= 0),
  current_daily_streak integer NOT NULL DEFAULT 0 CHECK (current_daily_streak >= 0),
  best_daily_streak integer NOT NULL DEFAULT 0 CHECK (best_daily_streak >= 0),
  last_daily_challenge_on date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE daily_challenge_runs (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  level_id integer NOT NULL REFERENCES course_levels(id),
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  hearts integer NOT NULL DEFAULT 3 CHECK (hearts BETWEEN 0 AND 3),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  submitted_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  PRIMARY KEY (student_id, challenge_date)
);

CREATE TABLE daily_challenge_attempts (
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  idempotency_key text NOT NULL,
  submitted_answers jsonb NOT NULL,
  is_correct boolean NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, challenge_date, idempotency_key)
);
