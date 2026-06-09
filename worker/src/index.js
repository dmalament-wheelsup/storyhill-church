/**
 * Community Groups contact-form mailer (Cloudflare Worker).
 *
 * The public page (index.html) POSTs a JSON contact-form submission here; this
 * Worker validates it and sends the email via Resend. Keeping the send
 * server-side means the Resend API key never ships to the browser, and we can
 * mail any recipient (the group's column-G addresses) without the per-address
 * activation step FormSubmit required.
 *
 * Secrets / vars (set via `wrangler secret put` or wrangler.toml [vars]):
 *   RESEND_API_KEY   - secret. Your Resend API key.
 *   MAIL_FROM        - var.   Verified sender, e.g. "Storyhill Groups <groups@storyhill.org>".
 *   ALLOWED_ORIGINS  - var.   Comma-separated origins allowed to call this
 *                             (e.g. "https://www.storyhill.org,https://dmalament-wheelsup.github.io").
 *   ALWAYS_TO        - var.   Address copied on EVERY message, in addition to
 *                             the group's recipients (e.g. grow@storyhill.org).
 *                             Also the sole recipient if a group lists none.
 */

const MAX_MESSAGE = 5000;
const MAX_RECIPIENTS = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, cors);
    }
    // Reject calls from origins we don't recognize.
    if (!isAllowedOrigin(origin, env)) {
      return json({ success: false, error: 'Forbidden' }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ success: false, error: 'Invalid JSON' }, 400, cors);
    }

    // Honeypot: a real user never fills this hidden field. Pretend success so
    // bots don't learn they were caught.
    if (body._honey) {
      return json({ success: true }, 200, cors);
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const message = String(body.message || '').trim();
    const groupName = String(body.group || '').trim();
    const location = String(body.location || '').trim();

    if (!name || !message) {
      return json({ success: false, error: 'Name and message are required' }, 400, cors);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ success: false, error: 'A valid email is required' }, 400, cors);
    }
    if (message.length > MAX_MESSAGE) {
      return json({ success: false, error: 'Message is too long' }, 400, cors);
    }

    // Recipients: validate column-G list; fall back to FALLBACK_TO.
    let recipients = Array.isArray(body.recipients)
      ? body.recipients.map((r) => String(r).trim()).filter((r) => EMAIL_RE.test(r))
      : [];
    // ALWAYS_TO (grow@storyhill.org) is copied on every message, in addition
    // to the group's own recipients. Enforced here so it holds no matter what
    // the page sends. Case-insensitive de-dupe keeps it from doubling up.
    const alwaysTo = (env.ALWAYS_TO || '').trim();
    if (EMAIL_RE.test(alwaysTo)) recipients.push(alwaysTo);
    recipients = dedupeEmails(recipients).slice(0, MAX_RECIPIENTS);
    if (!recipients.length) {
      return json({ success: false, error: 'No valid recipient configured' }, 500, cors);
    }

    const subject = groupName
      ? `Community Group inquiry: ${groupName}`
      : 'Community Group inquiry';

    const sent = await sendViaResend(env, {
      to: recipients,
      replyTo: email,
      subject,
      text: buildText({ name, email, message, groupName, location }),
    });

    if (!sent.ok) {
      return json({ success: false, error: 'Email delivery failed' }, 502, cors);
    }
    return json({ success: true }, 200, cors);
  },
};

async function sendViaResend(env, { to, replyTo, subject, text }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to,
        reply_to: replyTo,
        subject,
        text,
      }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false };
  }
}

function buildText({ name, email, message, groupName, location }) {
  const lines = [
    `New message about a Storyhill community group.`,
    ``,
    `Group: ${groupName || '(unspecified)'}${location ? ` — ${location}` : ''}`,
    `From: ${name} <${email}>`,
    ``,
    `Message:`,
    message,
    ``,
    `— Reply directly to this email to respond to ${name}.`,
  ];
  return lines.join('\n');
}

// De-dupe emails case-insensitively, preserving first-seen order.
function dedupeEmails(list) {
  const seen = new Set();
  const out = [];
  for (const e of list) {
    const k = e.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

function allowedOriginList(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  const list = allowedOriginList(env);
  // If no allowlist is configured, fail closed (don't accept anything).
  return list.length > 0 && list.includes(origin);
}

function corsHeaders(origin, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
  // Echo the origin back only if it's on the allowlist.
  if (isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
