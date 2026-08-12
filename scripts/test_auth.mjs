import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken, createExamToken, verifyExamToken } from '../api/_auth.js';

process.env.PROCTOR_AUTH_SECRET = 'test-proctor-secret-012345678901234567890';
process.env.EXAM_LINK_SECRET = 'test-exam-secret-012345678901234567890';

const sessionToken = createSessionToken('921240008');
const session = verifySessionToken(sessionToken);
assert.equal(session.studentId, '921240008');
assert.equal(verifySessionToken(`${sessionToken}x`), null);

const expiresAt = Math.floor(Date.now() / 1000) + 300;
const examToken = createExamToken('00000000-0000-4000-8000-000000000001', expiresAt);
const exam = verifyExamToken(examToken);
assert.equal(exam.examId, '00000000-0000-4000-8000-000000000001');
assert.equal(verifyExamToken(`${examToken}x`), null);

console.log('all enterprise auth and exam token tests: OK');
