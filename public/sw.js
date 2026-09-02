// 目标台 PWA Service Worker —— 仅缓存应用壳，保证断网也能打开
const CACHE = 'goal-tracker-shell-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // 同源导航 / 静态资源：缓存优先，回退网络
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        return res
      }).catch(() => caches.match('/index.html'))),
    )
  }
})
