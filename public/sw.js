/* CYBER CLASH: 3D HERO FPS 서비스워커
 * - 내비게이션: network-first, 실패 시 캐시된 index.html
 * - 같은 출처 정적 자산(GET): stale-while-revalidate
 * - 프리캐시는 셸(index.html·manifest·아이콘)과 index.html이 직접 불러오는 같은 출처 스크립트·스타일시트뿐.
 *   (첫 방문에서는 SW가 load 이후 등록되어 번들 요청을 보지 못하므로, 설치 직후 오프라인 실행이 되도록 함께 받는다.)
 *   그 밖의 자산(오디오·모델 등)은 처음 쓸 때 캐시된다.
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

// index.html의 <script src>·<link rel="stylesheet|modulepreload" href> 중 같은 출처 주소
function entryAssetUrls(html) {
  const urls = new Set();
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (/^<link/i.test(tag) && !/\brel=["']?(?:stylesheet|modulepreload)\b/i.test(tag)) continue;
    const m = tag.match(/\s(?:src|href)=["']([^"']+)["']/i);
    if (!m) continue;
    const url = new URL(m[1], self.registration.scope);
    if (url.origin === self.location.origin) urls.add(url.href);
  }
  return [...urls];
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PRECACHE);
  const index = await cache.match('./index.html');
  if (index) await cache.addAll(entryAssetUrls(await index.text()));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
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

// 캐시 저장은 부가 작업이다. 용량 초과 등으로 실패해도 받은 응답은 그대로 페이지에 전달한다.
function cacheInBackground(event, key, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const copy = response.clone();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.put(key, copy))
      .catch((err) => console.warn('[sw] 캐시 저장 실패:', err))
  );
}

async function networkFirstNavigation(event) {
  let response;
  try {
    response = await fetch(event.request);
  } catch (err) {
    const cached = (await caches.match('./index.html')) || (await caches.match('./'));
    if (cached) return cached;
    throw err;
  }
  cacheInBackground(event, './index.html', response);
  return response;
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);
  const network = fetch(event.request).then((response) => {
    cacheInBackground(event, event.request, response);
    return response;
  });
  if (cached) {
    // 캐시로 이미 응답했으므로 백그라운드 갱신 실패(오프라인 등)는 무시한다.
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
    event.respondWith(networkFirstNavigation(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
