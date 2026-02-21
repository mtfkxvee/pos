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
        
        resp = Response(content, mimetype="application/javascript")
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp
    else:
        resp = Response("console.error('Service Worker SW.js not found');", mimetype="application/javascript")
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp
