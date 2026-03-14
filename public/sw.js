const CACHE_NAME = 'hilldaytracker-v1'
const STATIC_ASSETS = [
  '/',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Network first for API calls
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    )
    return
  }

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})

// Listen for messages to skip waiting
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})