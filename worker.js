// The ASI Society: serves the static site and delivers membership requests by email.
// Mail goes out through Cloudflare Email Service to verified destination addresses only.

const ROLES = new Set(['Learner', 'Engineer', 'Researcher', 'Founder', 'Professional']);
const GOALS = new Set(['learn', 'build', 'contribute']);

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra }
  });

// Strip control characters, normalise newlines, cap the length.
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, ' ');

// A chat link for REI: only when the number is clearly international, or a Pakistani mobile in local form.
const chatLink = number => {
  const digits = number.replace(/\D/g, '');
  if (number.trim().startsWith('+') || number.trim().startsWith('00')) return 'https://wa.me/' + digits.replace(/^00/, '');
  if (/^03\d{9}$/.test(digits)) return 'https://wa.me/92' + digits.slice(1);
  return '';
};

async function handleJoin(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });

  // Same-origin browsers only.
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === url.host; } catch (e) {}
  if (!sameOrigin) return json({ ok: false, error: 'forbidden' }, 403);
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json({ ok: false, error: 'unsupported_media_type' }, 415);

  const raw = await request.text();
  if (raw.length > 8000) return json({ ok: false, error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_json' }, 400);

  // Honeypot: people never see this field. Answer as if it worked and send nothing.
  if (clean(body.website, 200)) return json({ ok: true });

  if (env.JOIN_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.JOIN_LIMITER.limit({ key: ip });
    if (!success) return json({ ok: false, error: 'rate_limited' }, 429);
  }

  const v = {
    name: oneLine(body.name, 80),
    whatsapp: oneLine(body.whatsapp, 24),
    email: oneLine(body.email, 120),
    role: oneLine(body.role, 20),
    intro: clean(body.intro, 1500),
    goals: Array.isArray(body.goals) ? body.goals.map(g => oneLine(g, 20)).filter(g => GOALS.has(g)) : [],
    detail: clean(body.detail, 800)
  };
  const digits = v.whatsapp.replace(/\D/g, '');
  const invalid = [];
  if (v.name.length < 2) invalid.push('name');
  if (digits.length < 7 || digits.length > 15) invalid.push('whatsapp');
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) invalid.push('email');
  if (!ROLES.has(v.role)) invalid.push('role');
  if (v.intro.length < 20) invalid.push('intro');
  if (!v.goals.length) invalid.push('goal');
  if (invalid.length) return json({ ok: false, error: 'invalid', fields: invalid }, 422);

  if (!env.EMAIL) return json({ ok: false, error: 'mail_not_configured' }, 503);
  const from = env.MAIL_FROM || 'join@asisociety.org';
  const recipients = String(env.NOTIFY_TO || '').split(',').map(a => a.trim()).filter(Boolean);
  if (!recipients.length) return json({ ok: false, error: 'mail_not_configured' }, 503);

  const link = chatLink(v.whatsapp);
  const lines = [
    'New membership request for The ASI Society', '',
    'Name: ' + v.name,
    'WhatsApp: ' + v.whatsapp + (link ? '  (' + link + ')' : ''),
    ...(v.email ? ['Email: ' + v.email] : []),
    'Role: ' + v.role,
    'Wants to: ' + v.goals.join(', '), '',
    'About them:', v.intro,
    ...(v.detail ? ['', 'Specifically:', v.detail] : []), '',
    'Sent from the form on ' + url.host + '.'
  ];
  const message = {
    from: { email: from, name: 'The ASI Society' },
    subject: 'Membership request: ' + v.name + ' (' + v.role + ')',
    text: lines.join('\n'),
    ...(v.email ? { replyTo: v.email } : {})
  };

  // One send per inbox, so an unverified address cannot block the other one.
  const results = await Promise.allSettled(recipients.map(to => env.EMAIL.send({ ...message, to })));
  const delivered = results.filter(r => r.status === 'fulfilled').length;
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('mail failed for inbox ' + (i + 1) + ':', r.reason && r.reason.code, r.reason && r.reason.message); });
  if (!delivered) return json({ ok: false, error: 'mail_failed' }, 502);
  return json({ ok: true, delivered });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/health') return json({ ok: true, email: Boolean(env.EMAIL) });
    if (pathname === '/api/join') return handleJoin(request, env);
    if (pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
