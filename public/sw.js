/* CYBER CLASH: 3D HERO FPS 서비스워커
 * - 내비게이션: network-first, 실패 시 캐시된 index.html
 * - 같은 출처 정적 자산(GET): stale-while-revalidate
 * - 프리캐시는 셸(index.html·manifest·아이콘)만. 그 외 자산은 처음 쓸 때 캐시된다.
 * 배포 내용이 바뀌어 캐시를 강제로 비워야 하면 CACHE_VERSION을 올린다.
 */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `cyber-clash-fps-${CACHE_VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cyber-clash-fps-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function putIfOk(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (err) {
    const cached = (await caches.match('./index.html')) || (await caches.match('./'));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request).then((response) => putIfOk(request, response));
  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Range 요청(오디오·비디오 탐색)은 부분 응답이라 캐시하지 않고 브라우저에 맡긴다.
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
