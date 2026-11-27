// Vidas das lições (5, uma volta a cada 15 minutos) e Modo Desafio com 5
// vidas e cruzadinhas sorteadas por rodada.

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS lives smallint NOT NULL DEFAULT 5
        CHECK (lives BETWEEN 0 AND 5),
      ADD COLUMN IF NOT EXISTS lives_updated_at timestamptz NOT NULL DEFAULT now();

    ALTER TABLE daily_challenge_runs
      DROP CONSTRAINT IF EXISTS daily_challenge_runs_hearts_check,
      ADD CONSTRAINT daily_challenge_runs_hearts_check
        CHECK (hearts BETWEEN 0 AND 5),
      ALTER COLUMN hearts SET DEFAULT 5,
      ADD COLUMN IF NOT EXISTS seed text;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE daily_challenge_runs
      DROP COLUMN IF EXISTS seed,
      ALTER COLUMN hearts SET DEFAULT 3;
    ALTER TABLE students
      DROP COLUMN IF EXISTS lives_updated_at,
      DROP COLUMN IF EXISTS lives;
  `);
};
