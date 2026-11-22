// Cloudflare Worker: proxy CORS untuk api.finroro.com
const CORS = (env) => ({
  'Access-Control-Allow-Origin': (env && env.ALLOW_ORIGIN) || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Accept,Authorization,X-Cookie,X-User-Agent,Origin,Referer,X-Requested-With',
  'Access-Control-Expose-Headers': 'X-Set-Cookie,X-Upstream-Status',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(request, env) {
    const cors = CORS(env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return new Response(JSON.stringify({ error: 'missing ?url=' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    let t;
    try { t = new URL(target); } catch { return new Response('bad url', { status: 400, headers: cors }); }
    if (t.protocol !== 'https:' && t.protocol !== 'http:') {
      return new Response('bad protocol', { status: 400, headers: cors });
    }

    const h = new Headers();
    h.set('Accept', request.headers.get('accept') || 'application/json, text/plain, */*');
    h.set('Accept-Language', 'ms-MY,ms;q=0.9,en;q=0.8');
    const ct = request.headers.get('content-type'); if (ct) h.set('Content-Type', ct);
    const ua = request.headers.get('x-user-agent'); if (ua) h.set('User-Agent', ua);
    const ck = request.headers.get('x-cookie'); if (ck) h.set('Cookie', ck);
    const og = request.headers.get('origin'); if (og) h.set('Origin', og);
    const rf = request.headers.get('referer'); if (rf) h.set('Referer', rf);
    const au = request.headers.get('authorization'); if (au) h.set('Authorization', au);

    const body = (request.method === 'GET' || request.method === 'HEAD')
      ? undefined : await request.arrayBuffer();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let up;
    try {
      up = await fetch(t.toString(), {
        method: request.method, headers: h, body, redirect: 'follow', signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 599, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
    clearTimeout(timer);

    const out = new Headers(cors);
    out.set('Content-Type', up.headers.get('content-type') || 'text/plain; charset=utf-8');
    const sc = up.headers.getSetCookie ? up.headers.getSetCookie() : [];
    if (sc.length) out.set('X-Set-Cookie', sc.map(c => c.split(';')[0]).join('; '));
    out.set('X-Upstream-Status', String(up.status));
    out.set('Cache-Control', 'no-store');

    return new Response(await up.arrayBuffer(), { status: up.status, headers: out });
  }
};
