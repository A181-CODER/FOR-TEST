import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 2 * 60 * 60;

function getSecret() {
  const secret = process.env.PROCTOR_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PROCTOR_AUTH_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(unsignedToken) {
  return crypto.createHmac('sha256', getSecret()).update(unsignedToken).digest('base64url');
}

export function createSessionToken(studentId) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'HNUSIS' }));
  const payload = base64Url(JSON.stringify({ sub: String(studentId), iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = sign(unsigned);
  const provided = parts[2];
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { studentId: String(payload.sub), issuedAt: payload.iat, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

export function readBearerToken(req) {
  const value = req.headers?.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : null;
}

function getExamSecret() {
  const secret = process.env.EXAM_LINK_SECRET || process.env.PROCTOR_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('EXAM_LINK_SECRET must be configured with at least 32 characters');
  return secret;
}

export function createExamToken(examId, expiresAtSeconds) {
  const payload = base64Url(JSON.stringify({ examId: String(examId), exp: Number(expiresAtSeconds) }));
  const signature = crypto.createHmac('sha256', getExamSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyExamToken(token) {
  if (typeof token !== 'string') return null;
  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) return null;
  const expected = crypto.createHmac('sha256', getExamSecret()).update(payloadPart).digest('base64url');
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (!payload.examId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { examId: String(payload.examId), expiresAt: Number(payload.exp) };
  } catch {
    return null;
  }
}
