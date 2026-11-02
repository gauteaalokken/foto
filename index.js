// Markeringer-API. Alle kan LESE; bare den som kjenner passordet (EDIT_TOKEN) kan ENDRE.
// Passordet settes som hemmelig verdi i Cloudflare og står aldri i koden.

const MAX_TEXT = 8000;
const MAX_ITEMS = 3000;

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

// Sender CORS-overskrifter bare tilbake til nettsteder som står i ALLOWED_ORIGINS.
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin');
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !ok.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

// Sammenligner passord uten å lekke hvor mange tegn som stemte (via SHA-256 av begge sider).
async function sameSecret(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

async function authorized(req, env) {
  if (!env.EDIT_TOKEN) return false; // ikke satt = ingen kan skrive
  const m = (req.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  return !!m && (await sameSecret(m[1], env.EDIT_TOKEN));
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function toItem(x) {
  const title = clean(x && x.title, 300);
  const text = clean(x && x.text, MAX_TEXT);
  if (!title || !text) return null;
  return { title, author: clean(x.author, 300), text, page: clean(String(x.page ?? ''), 20) };
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      // Alle sitater
      if (path === '/api/quotes' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT id, title, author, text, page FROM quotes ORDER BY id').all();
        return json(results, 200, cors);
      }

      // Alt under her krever passord
      if (path === '/api/check' || path === '/api/quotes' || path === '/api/import' || /^\/api\/quotes\/\d+$/.test(path)) {
        if (req.method !== 'GET' && path !== '/api/check' && !(await authorized(req, env))) {
          return json({ error: 'Ikke tillatt' }, 401, cors);
        }
        if (path === '/api/check') {
          return (await authorized(req, env)) ? json({ ok: true }, 200, cors) : json({ error: 'Feil passord' }, 401, cors);
        }
      }

      // Nytt sitat
      if (path === '/api/quotes' && req.method === 'POST') {
        const it = toItem(await req.json());
        if (!it) return json({ error: 'Mangler tittel eller sitat' }, 400, cors);
        const r = await env.DB.prepare('INSERT INTO quotes (title, author, text, page) VALUES (?, ?, ?, ?)')
          .bind(it.title, it.author, it.text, it.page).run();
        return json({ id: r.meta.last_row_id }, 201, cors);
      }

      // Flere sitater på én gang (opplasting av notatfil). Klienten har allerede fjernet duplikater.
      if (path === '/api/import' && req.method === 'POST') {
        const body = await req.json();
        const items = (Array.isArray(body && body.items) ? body.items : []).slice(0, MAX_ITEMS).map(toItem).filter(Boolean);
        const stmt = env.DB.prepare('INSERT INTO quotes (title, author, text, page) VALUES (?, ?, ?, ?)');
        for (let i = 0; i < items.length; i += 50) {
          await env.DB.batch(items.slice(i, i + 50).map((it) => stmt.bind(it.title, it.author, it.text, it.page)));
        }
        return json({ added: items.length }, 201, cors);
      }

      // Slett ett sitat
      const del = path.match(/^\/api\/quotes\/(\d+)$/);
      if (del && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM quotes WHERE id = ?').bind(Number(del[1])).run();
        return json({ ok: true }, 200, cors);
      }

      return json({ error: 'Finnes ikke' }, 404, cors);
    } catch (e) {
      return json({ error: 'Feil på serveren' }, 500, cors);
    }
  },
};
