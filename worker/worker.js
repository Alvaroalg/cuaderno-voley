/**
 * Worker de Cloudflare para publicar los datos de la app de voleibol en GitHub.
 *
 * Que hace:
 *   GET  /datos    -> devuelve data/datos.json tal cual esta en GitHub (sin cache)
 *   POST /publish  -> sube el paquete que le manda la app (con la clave correcta)
 *
 * Configuracion (Settings -> Variables and Secrets):
 *   GITHUB_TOKEN  (secreto)  token fine-grained con permiso Contents: read+write
 *                             SOLO sobre el repo Alvaroalg/cuaderno-voley
 *   CLAVE         (secreto)  clave compartida que valida la app
 *   REPO          (texto)    opcional: Alvaroalg/cuaderno-voley
 *   BRANCH        (texto)    opcional: main
 *   RUTA          (texto)    opcional: data/datos.json
 *   ORIGEN        (texto)    opcional: origen de la web que puede publicar
 *
 * Desplegar: pegar este codigo en el editor de Cloudflare -> Deploy.
 */

const DEF = {
  REPO: 'Alvaroalg/cuaderno-voley',
  BRANCH: 'main',
  RUTA: 'data/datos.json',
  ORIGEN: 'https://alvaroalg.github.io',
};

function cfg(env) {
  return {
    repo: env.REPO || DEF.REPO,
    branch: env.BRANCH || DEF.BRANCH,
    ruta: env.RUTA || DEF.RUTA,
    origin: env.ORIGEN || DEF.ORIGIN,
  };
}

function headers(extra) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-clave',
    'Access-Control-Max-Age': '86400',
    ...extra,
  };
}

/** Base64 de texto UTF-8 (btoa solo admite binario). */
function a64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function api(repo, ruta, ref) {
  return `https://api.github.com/repos/${repo}/contents/${ruta}?ref=${ref}`;
}

async function leerGithub(env) {
  const c = cfg(env);
  const r = await fetch(api(c.repo, c.ruta, c.branch), {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cuaderno-voley-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!r.ok) throw new Error('GitHub devolvio ' + r.status);
  const j = await r.json();
  return { sha: j.sha, texto: atob(String(j.content || '').replace(/\s/g, '')) };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() });

    const url = new URL(request.url);
    const c = cfg(env);

    // --- lectura de los datos actuales ---
    if (request.method === 'GET' && url.pathname.endsWith('/datos')) {
      try {
        const { texto } = await leerGithub(env);
        return new Response(texto, { headers: headers({ 'Content-Type': 'application/json; charset=utf-8' }) });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e && e.message ? e.message : e) }), {
          status: 502, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
    }

    // --- publicacion ---
    if (request.method === 'POST' && url.pathname.endsWith('/publish')) {
      const clave = request.headers.get('x-clave') || '';
      if (!env.CLAVE || clave !== env.CLAVE) {
        return new Response(JSON.stringify({ error: 'clave incorrecta' }), {
          status: 401, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      const origen = request.headers.get('Origin') || '';
      if (origen && c.origin && origen !== c.origin) {
        return new Response(JSON.stringify({ error: 'origen no permitido' }), {
          status: 403, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      let cuerpo;
      try { cuerpo = await request.text(); } catch { cuerpo = ''; }
      let pkg;
      try { pkg = JSON.parse(cuerpo); } catch {
        return new Response(JSON.stringify({ error: 'json no valido' }), {
          status: 400, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      if (!pkg || typeof pkg !== 'object' || !Array.isArray(pkg.plantilla)) {
        return new Response(JSON.stringify({ error: 'el paquete no tiene plantilla' }), {
          status: 400, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      let sha;
      try { sha = (await leerGithub(env)).sha; } catch (e) {
        return new Response(JSON.stringify({ error: String(e && e.message ? e.message : e) }), {
          status: 502, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      const r = await fetch(api(c.repo, c.ruta, c.branch), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'cuaderno-voley-worker',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: 'Datos actualizados desde la app (' + new Date().toISOString() + ')',
          content: a64(cuerpo),
          sha,
          branch: c.branch,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        return new Response(JSON.stringify({ error: j.message || ('GitHub devolvio ' + r.status) }), {
          status: r.status, headers: headers({ 'Content-Type': 'application/json' }),
        });
      }
      return new Response(JSON.stringify({
        ok: true,
        commit: j.commit && j.commit.sha ? j.commit.sha : null,
        url: j.content && j.content.html_url ? j.content.html_url : null,
        jugadores: pkg.plantilla.length,
        sesiones: Array.isArray(pkg.sesiones) ? pkg.sesiones.length : 0,
      }), { headers: headers({ 'Content-Type': 'application/json' }) });
    }

    return new Response(JSON.stringify({ error: 'ruta no encontrada' }), {
      status: 404, headers: headers({ 'Content-Type': 'application/json' }),
    });
  },
};
