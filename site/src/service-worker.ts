/// <reference lib="webworker" />
// Fully offline: the app is cached on first visit and always answered from the cache. The data lives in the cache the app itself fills
// (both-<version>, see install in lib/data.ts); this worker only keeps the app shell and never sends a check to the network.
import { self } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const SHELL = `shell-${version}`;
// the public API and downloads are not part of the app; Cloudflare 404s _headers if fetched
// Kit 3 lists paths without the leading slash ("api/v1/…", "about", "" for the home page)
const shell = [...immutable, ...assets, ...prerendered].map(f => `/${f.path.replace(/^\//, '')}`).filter(p => !/^\/(api|download|app)\//.test(p) && !/\/_(headers|redirects)$/.test(p));

self.addEventListener('install', (e: ExtendableEvent) => e.waitUntil(caches.open(SHELL).then(c => c.addAll(shell)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e: ExtendableEvent) =>
	e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()))
);

self.addEventListener('fetch', (e: FetchEvent) => {
	const req = e.request, url = new URL(req.url);
	if (req.method !== 'GET' || url.origin !== location.origin || /^\/(api|download)\//.test(url.pathname)) return;
	e.respondWith((async () => {
		const hit = (await caches.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? (req.mode === 'navigate' ? await caches.match('/') : undefined);
		return hit ?? fetch(req);
	})());
});
