import frappe
import os
from werkzeug.wrappers import Response

@frappe.whitelist(allow_guest=True)
def get_sw():
    app_path = frappe.get_app_path('pos_next')
    sw_path = os.path.join(app_path, 'public', 'pos', 'sw.js')
    
    if os.path.exists(sw_path):
        with open(sw_path, 'r') as f:
            content = f.read()
            
        custom_fallback = """
// Custom Navigate Fallback added via Frappe API
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate' && !event.request.url.includes('/api/') && !event.request.url.includes('/app/')) {
        event.respondWith(
            fetch(event.request).catch(async () => {
                let cacheMatch = await caches.match('/assets/pos_next/pos/index.html', { ignoreSearch: true });
                if (!cacheMatch) cacheMatch = await caches.match('/pos/index.html', { ignoreSearch: true });
                if (!cacheMatch) cacheMatch = await caches.match('index.html', { ignoreSearch: true });
                return cacheMatch || new Response('Offline', { status: 503 });
            })
        );
    }
});
"""
        content += custom_fallback
        
        resp = Response(content, mimetype="application/javascript")
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp
    else:
        resp = Response("console.error('Service Worker SW.js not found');", mimetype="application/javascript")
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp
