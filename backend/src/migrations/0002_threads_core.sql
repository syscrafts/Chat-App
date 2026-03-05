


CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,

    slug TEXT NOT NULL UNIQUE,

    name TEXT NOT NULL,

    description TEXT
);


CREATE TABLE IF NOT EXISTS threads (
   id BIGSERIAL PRIMARY KEY,

   category_id BIGINT NOT NULL REFERENCES categories(id),

   author_user_id BIGINT NOT NULL REFERENCES users(id),

   title TEXT NOT NULL,
   body TEXT NOT NULL,

   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_threads_category_created_at
   ON threads (category_id, created_at DESC);


INSERT INTO categories (slug, name, description)
VALUES 
  ('general',  'General',  'Anything dev-related, off-topic but friendly.'),
  ('q-and-a',  'Q&A',      'Ask and answer coding and career questions.'),
  ('help',     'Help',     'Stuck on something? Ask for help here.')
ON CONFLICT (slug) DO NOTHING;
