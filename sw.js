var CACHE = 'timer-v2';
var ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './fonts/BebasNeue-latin.woff2'
];

function guessType(url) {
  var path = String(url).split('?')[0];
  if (path.indexOf('.png') !== -1) return 'image/png';
  if (path.indexOf('.woff2') !== -1) return 'font/woff2';
  if (path.indexOf('.webmanifest') !== -1) return 'application/manifest+json';
  if (path.indexOf('.js') !== -1) return 'text/javascript';
  return 'text/html; charset=utf-8';
}

function storedResponse(url, response) {
  var headers = new Headers();
  var type = response.headers.get('Content-Type');
  if (!type || type.indexOf('octet-stream') !== -1) type = guessType(url);
  headers.set('Content-Type', type);
  return response.blob().then(function (blob) {
    return new Response(blob, { status: 200, headers: headers });
  });
}

function put(cache, url, response) {
  return storedResponse(url, response).then(function (clean) {
    return cache.put(url, clean);
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return fetch(url).then(function (res) {
          if (!res || !res.ok) throw new Error('missing ' + url);
          return put(cache, url, res);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
        return Promise.resolve();
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isDocument(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then(function (res) {
      if (res && res.ok) {
        var key = isDocument(url) ? './index.html' : request.url;
        caches.open(CACHE).then(function (cache) {
          put(cache, key, res.clone()).catch(function () {});
        });
      }
      return res;
    }).catch(function () {
      var key = isDocument(url) ? './index.html' : request;
      return caches.match(key).then(function (cached) {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
