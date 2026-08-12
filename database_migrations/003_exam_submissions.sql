-- HNUSIS secure exam submissions migration
CREATE TABLE IF NOT EXISTS exam_submissions (
    submission_id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES exam_sessions(session_id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id),
    exam_id UUID,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachment_info JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'flagged')),
    UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_submissions_student ON exam_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam ON exam_submissions (exam_id);
