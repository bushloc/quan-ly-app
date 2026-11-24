// Mở được khi mất mạng: lấy bản mới từ mạng trước, mất mạng thì dùng bản đã lưu. Supabase (khác domain) không đi qua đây.
const C = "ql-v56";
const FILES = ["./", "index.html", "css/base.css", "css/modules.css", "css/ebay.css", "css/mobile.css", "css/polish.css", "css/extras.css", "css/more.css", "js/storage.js", "js/ebay.js", "js/kit.js", "js/nav.js", "js/home.js", "js/paycheck.js", "js/expenses.js", "js/hours.js", "js/settings.js", "js/sync.js", "js/polish.js", "js/extras.js", "js/more.js", "js/boot.js", "vendor/supabase.js", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // no-cache: luôn hỏi lại GitHub Pages (trang để cache 10 phút), nên bản mới tới ngay khi mở lại app
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
