const jwt = require("jsonwebtoken");
const ADMIN_COOKIE = "dodola_admin";

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || "");
  const prefix = `${name}=`;
  const part = raw.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : "";
}

function adminToken(req) {
  const authHeader = req.headers["authorization"] || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : cookieValue(req, ADMIN_COOKIE);
}

function setAdminCookie(res, token, secure = process.env.NODE_ENV === "production") {
  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api",
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function clearAdminCookie(res, secure = process.env.NODE_ENV === "production") {
  res.clearCookie(ADMIN_COOKIE, { httpOnly: true, secure, sameSite: "strict", path: "/api" });
}

/**
 * Express middleware that extracts and verifies a Bearer JWT.
 * Attaches the decoded payload to req.user on success.
 *
 * Responses:
 *   401 { error: 'Token topilmadi' }                       - missing / non-Bearer header
 *   401 { error: 'Token yaroqsiz yoki muddati tugagan' }   - invalid / expired JWT
 *   403 { error: "Ruxsat yo'q" }                           - valid JWT but role !== 'admin'
 */
function verifyAdminToken(req, res, next) {
  const token = adminToken(req);
  if (!token) {
    return res.status(401).json({ error: "Token topilmadi" });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token yaroqsiz yoki muddati tugagan" });
  }

  if (!decoded || decoded.role !== "admin") {
    return res.status(403).json({ error: "Ruxsat yo'q" });
  }

  req.user = decoded;
  next();
}

// Cookie-authenticated state changes must originate from this site.  Requests
// without an Origin header are kept compatible with non-browser admin tools;
// browsers always send Origin for cross-site form/fetch requests.
function requireAdminOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();
  const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  const forwardedProto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  let parsed;
  try { parsed = new URL(origin); } catch { return res.status(403).json({ error: "Xavfsizlik manbasi yaroqsiz" }); }
  if (parsed.host !== forwardedHost || parsed.protocol !== `${forwardedProto}:`) {
    return res.status(403).json({ error: "Xavfsizlik manbasi ruxsat etilmagan" });
  }
  next();
}

module.exports = verifyAdminToken;
module.exports.adminToken = adminToken;
module.exports.setAdminCookie = setAdminCookie;
module.exports.clearAdminCookie = clearAdminCookie;
module.exports.requireAdminOrigin = requireAdminOrigin;
