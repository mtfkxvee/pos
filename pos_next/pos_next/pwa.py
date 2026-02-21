import frappe
import os
from werkzeug.wrappers import Response

def get_sw():
    app_path = frappe.get_app_path('pos_next')
    sw_path = os.path.join(app_path, 'public', 'pos', 'sw.js')
    
    if os.path.exists(sw_path):
        with open(sw_path, 'r') as f:
            content = f.read()
        return Response(
            content, 
            mimetype='application/javascript', 
            headers={'Service-Worker-Allowed': '/'}
        )
    return Response("console.error('Service Worker not found');", mimetype='application/javascript')
