-- HNUSIS signed exam links
CREATE TABLE IF NOT EXISTS exams (
    exam_id UUID PRIMARY KEY,
    subject TEXT NOT NULL,
    instructor TEXT NOT NULL DEFAULT 'غير محدد',
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 480),
    questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array'),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exams_expires_at ON exams (expires_at);
CREATE INDEX IF NOT EXISTS idx_exams_active ON exams (revoked_at, expires_at);
