-- HNUSIS Proctoring audit migration
-- Run this migration after the base students table exists.
-- No camera frames or audio recordings are stored by this schema.

CREATE TABLE IF NOT EXISTS exam_sessions (
    session_id UUID PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    exam_subject TEXT NOT NULL DEFAULT 'غير محدد',
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired', 'abandoned')),
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
    event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
    client_version TEXT NOT NULL DEFAULT 'local-proctor-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proctor_events (
    event_id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'danger')),
    risk_points INTEGER NOT NULL DEFAULT 0 CHECK (risk_points BETWEEN 0 AND 100),
    occurred_at TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (session_id, sequence_no),
    UNIQUE (session_id, event_hash)
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_student_started
    ON exam_sessions (student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status_started
    ON exam_sessions (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_proctor_events_session_time
    ON proctor_events (session_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION set_exam_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exam_sessions_updated_at ON exam_sessions;
CREATE TRIGGER trg_exam_sessions_updated_at
BEFORE UPDATE ON exam_sessions
FOR EACH ROW EXECUTE FUNCTION set_exam_session_updated_at();
