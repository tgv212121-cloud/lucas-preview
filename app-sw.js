// Service worker du SHELL de l'app : permet de LANCER Lucas sans reseau.
//
// Strategie NETWORK-FIRST sur nos fichiers : en ligne, on prend TOUJOURS la
// derniere version depuis le reseau (jamais bloque sur une vieille version, le
// probleme de cache d'avant ne peut donc pas revenir). Hors-ligne, on ressert la
// copie mise en cache lors de la derniere connexion : l'app se lance quand meme.
//
// CanvasKit (gstatic) change rarement et est gros : cache-first pour lui.

const CACHE = 'lucas-shell-v1';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const memeOrigine = url.origin === self.location.origin;
  const estCanvaskit =
    url.hostname === 'www.gstatic.com' &&
    url.pathname.indexOf('flutter-canvaskit') !== -1;

  // On ne gere que nos fichiers + CanvasKit ; le reste passe normalement.
  if (!memeOrigine && !estCanvaskit) return;
  // version.json doit rester frais (detection des mises a jour).
  if (memeOrigine && url.pathname.endsWith('version.json')) return;

  if (estCanvaskit) {
    // Cache-first : on garde CanvasKit une fois pour toutes.
    event.respondWith(
      (async function () {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      })()
    );
    return;
  }

  // Nos fichiers : network-first (toujours frais en ligne, cache en secours).
  event.respondWith(
    (async function () {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const idx =
            (await caches.match('index.html')) || (await caches.match('./'));
          if (idx) return idx;
        }
        throw e;
      }
    })()
  );
});
