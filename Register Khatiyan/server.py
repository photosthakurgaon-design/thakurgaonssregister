import os
import sys
import socket
import io
import base64
import csv

# Windows UTF-8 stdout fix
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify, send_from_directory, Response
import database as db
import qrcode

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
possible_dirs = [
    os.path.join(BASE_DIR, 'static'),
    os.path.join(BASE_DIR, 'Register Khatiyan', 'static'),
    os.path.join(os.getcwd(), 'static'),
    os.path.join(os.getcwd(), 'Register Khatiyan', 'static')
]
STATIC_DIR = next((d for d in possible_dirs if os.path.isdir(d)), os.path.join(BASE_DIR, 'static'))

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')

def get_local_ip():
    """Detect local LAN IP for mobile network access"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Doesn't actually have to be reachable
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def generate_qr_code_base64(url):
    """Generate QR code as base64 PNG for web UI"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f766e", back_color="#ffffff")
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')

# Root & PWA Files
@app.route('/')
def index():
    if not os.path.exists(os.path.join(STATIC_DIR, 'index.html')):
        return f"<h3>সতর্কতা: 'static' ফোল্ডারটি পাওয়া যায়নি। অনুগ্রহ করে GitHub-এ 'static' ফোল্ডারটি (index.html, css, js সহ) আপলোড করুন।</h3><p>Static path checked: {STATIC_DIR}</p>", 404
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/manifest.json')
def manifest():
    return send_from_directory(STATIC_DIR, 'manifest.json', mimetype='application/manifest+json')

@app.route('/sw.js')
def service_worker():
    resp = send_from_directory(STATIC_DIR, 'sw.js', mimetype='application/javascript')
    resp.headers['Service-Worker-Allowed'] = '/'
    return resp

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(STATIC_DIR, 'icons'), 'favicon.ico')

# ----------------- REST API -----------------

@app.route('/api/network-info', methods=['GET'])
def network_info():
    ip = get_local_ip()
    port = int(os.environ.get('PORT', 5000))
    
    # Check if request came through an online proxy / cloud URL
    forwarded_host = request.headers.get('X-Forwarded-Host') or request.headers.get('Host')
    forwarded_proto = request.headers.get('X-Forwarded-Proto', request.scheme)
    
    if forwarded_host and not forwarded_host.startswith('localhost') and not forwarded_host.startswith('127.0.0.1'):
        # Cloud or Tunnel public URL (e.g. on Render, Cloudflare, etc.)
        mobile_url = f"{forwarded_proto}://{forwarded_host}"
    else:
        mobile_url = f"http://{ip}:{port}"
        
    qr_b64 = generate_qr_code_base64(mobile_url)
    return jsonify({
        'local_ip': ip,
        'port': port,
        'local_url': f"http://localhost:{port}",
        'mobile_url': mobile_url,
        'qr_code_base64': f"data:image/png;base64,{qr_b64}"
    })

@app.after_request
def add_cache_control_headers(response):
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/api/db-status', methods=['GET'])
def db_status():
    return jsonify(db.get_db_status())

@app.route('/api/summary', methods=['GET'])
def get_summary():
    return jsonify(db.get_summary())

def check_admin_auth():
    """Verify admin PIN from X-Admin-PIN header or request json/args/form"""
    pin = request.headers.get('X-Admin-PIN') or request.headers.get('Authorization')
    if pin and pin.startswith('Bearer '):
        pin = pin[7:]
    if not pin and request.is_json:
        pin = (request.json or {}).get('admin_pin')
    if not pin and request.form:
        pin = request.form.get('admin_pin')
    if not pin:
        pin = request.args.get('admin_pin')
    return db.verify_admin_pin(pin)

# Auth Endpoints
@app.route('/api/auth/verify', methods=['POST'])
def verify_auth():
    data = request.json or {}
    pin = data.get('pin')
    if db.verify_admin_pin(pin):
        return jsonify({'success': True, 'message': 'পিন সঠিক হয়েছে'})
    return jsonify({'success': False, 'error': 'ভুল পিন! পুনরায় সঠিক পিন দিয়ে চেষ্টা করুন'}), 401

@app.route('/api/auth/change-pin', methods=['POST'])
def change_pin():
    data = request.json or {}
    old_pin = data.get('old_pin')
    new_pin = data.get('new_pin')
    if not new_pin or len(str(new_pin).strip()) < 4:
        return jsonify({'error': 'নতুন পিন কমপক্ষে ৪ সংখ্যার হতে হবে'}), 400
    if not db.verify_admin_pin(old_pin):
        return jsonify({'error': 'বর্তমান পিনটি সঠিক নয়'}), 401
    db.set_admin_pin(new_pin)
    return jsonify({'success': True, 'message': 'অ্যাডমিন পিন সফলভাবে পরিবর্তন করা হয়েছে'})

@app.route('/api/categories', methods=['GET'])
def list_categories():
    return jsonify(db.get_categories())

@app.route('/api/categories', methods=['POST'])
def create_category():
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! নতুন ক্যাটাগরি তৈরি করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    data = request.json or {}
    if not data.get('name') and not data.get('name_bn'):
        return jsonify({'error': 'ক্যাটাগরির নাম আবশ্যক'}), 400
    cat_id = db.add_category(data)
    return jsonify({'success': True, 'id': cat_id, 'message': 'নতুন মাদার ক্যাটাগরি তৈরি হয়েছে'})

@app.route('/api/categories/<int:cat_id>', methods=['PUT'])
def update_category(cat_id):
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! ক্যাটাগরি পরিবর্তন করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    data = request.json or {}
    db.update_category(cat_id, data)
    return jsonify({'success': True, 'message': 'ক্যাটাগরি সফলভাবে আপডেট হয়েছে'})

@app.route('/api/categories/<int:cat_id>', methods=['DELETE'])
def delete_category(cat_id):
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! ক্যাটাগরি মুছতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    db.delete_category(cat_id)
    return jsonify({'success': True, 'message': 'ক্যাটাগরি ও সংশ্লিষ্ট এন্ট্রি মুছে ফেলা হয়েছে'})

@app.route('/api/items', methods=['GET'])
def list_items():
    category_id = request.args.get('category_id', type=int)
    page_number = request.args.get('page_number', type=int)
    search = request.args.get('search')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    items = db.get_items(
        category_id=category_id, 
        page_number=page_number, 
        search=search,
        start_date=start_date,
        end_date=end_date
    )
    return jsonify(items)

@app.route('/api/page/<int:page_number>', methods=['GET'])
def get_page(page_number):
    category = db.get_category_by_page(page_number)
    items = db.get_page_items(page_number)
    total_amount = sum(item.get('total_price', 0) for item in items)
    
    return jsonify({
        'page_number': page_number,
        'category': category,
        'items': items,
        'total_items': len(items),
        'total_amount': total_amount
    })

@app.route('/api/items', methods=['POST'])
def create_item():
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! নতুন এন্ট্রি করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    data = request.json or {}
    if not data.get('item_name'):
        return jsonify({'error': 'মালের বা পণ্যের বিবরণ আবশ্যক'}), 400
    
    item_id = db.add_item(data)
    return jsonify({'success': True, 'id': item_id, 'message': 'নতুন মালামাল ক্রয় এন্ট্রি সফল হয়েছে'})

@app.route('/api/items/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! এন্ট্রি এডিট করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    data = request.json or {}
    db.update_item(item_id, data)
    return jsonify({'success': True, 'message': 'এন্ট্রি সফলভাবে আপডেট হয়েছে'})

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! এন্ট্রি ডিলিট করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    db.delete_item(item_id)
    return jsonify({'success': True, 'message': 'এন্ট্রি মুছে ফেলা হয়েছে'})

# Backup & Restore
@app.route('/api/backup', methods=['GET'])
def download_backup():
    data = db.get_full_backup()
    return Response(
        response=jsonify(data).get_data(),
        mimetype="application/json",
        headers={"Content-disposition": "attachment; filename=khatiyan_backup.json"}
    )

@app.route('/api/restore', methods=['POST'])
def restore_backup():
    if not check_admin_auth():
        return jsonify({'error': 'অননুমোদিত অনুরোধ! ব্যাকআপ রিস্টোর করতে অ্যাডমিন পিন দিয়ে আনলক করুন।'}), 401
    if 'file' in request.files:
        import json
        file = request.files['file']
        content = file.read().decode('utf-8')
        data = json.loads(content)
    else:
        data = request.json
        
    if not data:
        return jsonify({'error': 'কোন ডেটা পাওয়া যায়নি'}), 400
        
    success, msg = db.restore_full_backup(data)
    if success:
        return jsonify({'success': True, 'message': msg})
    return jsonify({'error': msg}), 500

# Excel / CSV Export
@app.route('/api/export-csv', methods=['GET'])
def export_csv():
    items = db.get_items()
    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens Bengali characters properly
    output.write('\ufeff')
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'ক্রমিক নং', 
        'পৃষ্ঠা নং', 
        'মাদার ক্যাটাগরি', 
        'তারিখ', 
        'মালের বিবরণ / নাম', 
        'স্পেসিফিকেশন', 
        'ভাউচার / মেমো নং', 
        'পরিমাণ', 
        'একক', 
        'দর (টাকা)', 
        'মোট টাকা', 
        'সরবরাহকারী / দোকান', 
        'মন্তব্য'
    ])
    
    for idx, item in enumerate(items, 1):
        writer.writerow([
            idx,
            item.get('page_number', ''),
            item.get('category_name_bn') or item.get('category_name', ''),
            item.get('entry_date', ''),
            item.get('item_name', ''),
            item.get('specification', ''),
            item.get('voucher_no', ''),
            item.get('quantity', 0),
            item.get('unit', ''),
            item.get('unit_price', 0),
            item.get('total_price', 0),
            item.get('supplier', ''),
            item.get('remarks', '')
        ])
        
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=Register_Khatiyan_Report.csv"}
    )

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = int(os.environ.get('PORT', 5000))
    local_url = f"http://localhost:{port}"
    mobile_url = f"http://{local_ip}:{port}"
    
    print("=" * 65)
    print("📖 ডিজিটাল খতিয়ান - মালামাল ক্রয় রেজিস্টার খাতা (২৫০ পৃষ্ঠা)")
    print("=" * 65)
    print(f"💻 আপনার পিসিতে ব্রাউজার লিংক:    {local_url}")
    print(f"📱 মোবাইল / অন্য ডিভাইসের লিংক:  {mobile_url}")
    print("=" * 65)
    print("মোবাইল থেকে একই ওয়াইফাই নেটওয়ার্কে যুক্ত হয়ে ব্রাউজারে লিংকটি খুলুন")
    print("অথবা অ্যাপের '📱 মোবাইলে কানেক্ট' বাটনে ক্লিক করে QR কোড স্ক্যান করুন।")
    print("=" * 65)
    
    try:
        # Print terminal QR code
        qr = qrcode.QRCode()
        qr.add_data(mobile_url)
        qr.print_ascii(invert=True)
    except Exception:
        pass
        
    app.run(host='0.0.0.0', port=port, debug=False)

