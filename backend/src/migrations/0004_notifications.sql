CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    actor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    thread_id BIGINT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,

    type TEXT NOT NULL CHECK (type IN ('REPLY_ON_THREAD', 'LIKE_ON_THREAD')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
   ON notifications (user_id, read_at);