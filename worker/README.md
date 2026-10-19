# Worker de Cloudflare (publicación con un solo toque)

Este worker permite que la app **suba los cambios a GitHub sola**, sin copiar y pegar.
El token de GitHub vive **en Cloudflare**, nunca en el móvil.

Todo es gratis: el plan Free de Cloudflare da 100.000 peticiones al día (aquí se usan
unas pocas al día) y el token de GitHub es un *fine-grained token* gratuito.

## 1. Crear el token de GitHub (5 min)

1. GitHub → tu perfil → **Settings** → **Developer settings** → **Personal access tokens**
   → **Fine-grained tokens** → **Generate new token**.
2. **Name**: `cuaderno-voley`. **Expiration**: 90 días (puedes renovarlo).
3. **Resource owner**: tu cuenta. **Repository access**: *Only select repositories* →
   elige `cuaderno-voley`.
4. **Repository permissions** → **Contents: Read and write**. Nada más.
5. **Generate token** y **cópialo** (solo se muestra una vez).

## 2. Crear el worker en Cloudflare (10 min)

1. Entra en <https://dash.cloudflare.com> y crea una cuenta (gratis).
2. Panel izquierdo → **Workers & Pages** → **Create** → **Create Worker** → ponle de nombre
   `cuaderno-voley` → **Deploy**.
3. Ábrelo → pestaña **Edit** → borra el código de ejemplo → pega el contenido de
   [`worker.js`](./worker.js) (lo tienes también en
   <https://alvaroalg.github.io/cuaderno-voley/worker/worker.js>) → **Deploy**.
4. **Settings** → **Variables and Secrets** → **Add**:
   - `GITHUB_TOKEN` → tipo **Secret**, valor = el token del paso 1.
   - `CLAVE` → tipo **Secret**, valor = una contraseña inventada por ti (ej. `voley-2026-alvaro`).
     Esta misma clave la pondrás en la app.
   - (opcional) `ORIGEN` → tipo **Text**, valor `https://alvaroalg.github.io`.
     Es el único origen que puede publicar.
5. **Settings** → **Triggers** → **Add** → *Custom routes* (opcional, no hace falta).

Anota la URL del worker: `https://cuaderno-voley.<tu-subdominio>.workers.dev`

## 3. Configurar la app (1 min)

En la app, pestaña **Plantilla** → *Publicación automática (worker de Cloudflare)*:

- **URL del worker**: la del paso 2.
- **Clave compartida**: la misma que pusiste en `CLAVE`.
- **Guardar y probar** → debe decir *"Worker correcto"*.

A partir de ahí, el botón **Publicar en GitHub** sube los cambios solo.

## Notas

- Si el worker no está configurado, la app sigue con la vía manual (copiar y pegar).
- La clave va en el código de la app (es pública): por eso el worker además comprueba el
  origen de la petición. Evita que cualquiera publique en tu repo por casualidad.
- La app también **lee** los datos a través del worker, así que después de publicar, los
  demás dispositivos los tienen al instante (sin esperar al redespliegue de Pages).
- Para revocar el acceso: GitHub → Developer settings → Personal access tokens → borrar
  `cuaderno-voley`. El worker deja de poder publicar.

## Pruebas

`node --test worker/worker.test.mjs` — 8 pruebas con la API de GitHub simulada.
