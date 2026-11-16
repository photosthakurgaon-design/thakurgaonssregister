import sqlite3
import os
import json
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), 'khatiyan.db')

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Categories Table (মাদার ইনডেক্স)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_bn TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        page_end INTEGER,
        description TEXT,
        icon TEXT DEFAULT '📦',
        color TEXT DEFAULT '#0f766e',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # 2. Items Table (মালামাল ক্রয় রেজিস্টার এন্ট্রি)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        page_number INTEGER NOT NULL,
        serial_no INTEGER,
        entry_date TEXT NOT NULL,
        item_name TEXT NOT NULL,
        specification TEXT,
        voucher_no TEXT,
        quantity REAL NOT NULL DEFAULT 1,
        unit TEXT DEFAULT 'পিস',
        unit_price REAL NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0,
        supplier TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
    )
    ''')
    
    # 3. Settings Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    
    # Check if categories table is empty, if so seed initial categories and sample entries
    cursor.execute('SELECT COUNT(*) as count FROM categories')
    cat_count = cursor.fetchone()['count']
    
    if cat_count == 0:
        seed_categories = [
            (
                "Stationery Items", 
                "স্টেশনারি দ্রব্যাদি", 
                5, 
                24, 
                "কলম, খাতা, পেন্সিল, পেপার রিম, স্ট্যাপলার, মার্কার, ফাইল ফোল্ডার ইত্যাদি", 
                "✏️", 
                "#2563eb"
            ),
            (
                "Safety Tools & Equipment", 
                "সেফটি সরঞ্জাম ও পোশাক", 
                25, 
                44, 
                "সেফটি হেলমেট, হ্যান্ড গ্লাভস, গামবুট, রিফ্লেক্টিভ ভেস্ট, চশমা, মাস্ক ইত্যাদি", 
                "🛡️", 
                "#059669"
            ),
            (
                "Electrical Items", 
                "বৈদ্যুতিক মালামাল", 
                45, 
                64, 
                "এলইডি বাল্ব, টিউবলাইট, তার, সুইচ, সকেট, মাল্টিপ্লাগ, সার্কিট ব্রেকার ইত্যাদি", 
                "⚡", 
                "#d97706"
            ),
            (
                "IT & Electronics", 
                "কম্পিউটার ও আইটি পণ্য", 
                65, 
                84, 
                "প্রিন্টার, পেন ড্রাইভ, টোনার কার্ট্রিজ, মাউস, কীবোর্ড, ইউপিএস ব্যাটারি ইত্যাদি", 
                "💻", 
                "#7c3aed"
            ),
            (
                "Photocopy & Printing", 
                "ফটোকপি ও প্রিন্টিং খরচ", 
                85, 
                104, 
                "অফিসিয়াল ডকুমেন্ট ফটোকপি, কালার প্রিন্টিং, বই বাঁধাই, লেমিনেশন ইত্যাদি", 
                "🖨️", 
                "#0891b2"
            ),
            (
                "Cleaning & Hygiene", 
                "পরিচ্ছন্নতা সামগ্রী", 
                105, 
                124, 
                "ফ্লোর ক্লিনার, হারপিক, টিস্যু পেপার, ঝাড়ু, ডিটারজেন্ট, হ্যান্ডওয়াশ ইত্যাদি", 
                "🧹", 
                "#0d9488"
            ),
            (
                "Hardware & Maintenance", 
                "হার্ডওয়্যার ও মেরামত সামগ্রী", 
                125, 
                149, 
                "স্ক্রু, নাট-বোল্ট, হাতুড়ি, প্লাস, টেপ, রং, ব্রাশ, লক ইত্যাদি", 
                "🔧", 
                "#ea580c"
            ),
            (
                "Miscellaneous", 
                "বিবিধ দ্রব্যাদি ও আপ্যায়ন", 
                150, 
                250, 
                "চা-নাস্তা, অতিথি আপ্যায়ন, কুরিয়ার খরচ, পরিবহন ইত্যাদি", 
                "☕", 
                "#4b5563"
            )
        ]
        
        cursor.executemany('''
        INSERT INTO categories (name, name_bn, page_number, page_end, description, icon, color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', seed_categories)
        
        # Sample items matching user's exact mention
        sample_items = [
            # Stationery (Category 1, Page 5)
            (1, 5, 1, '2026-11-10', 'ম্যাটাডোর হাই-স্কুল বলপেন', 'নীল ও কালো কালি', 'VOUCH-101', 50, 'পিস', 6.0, 300.0, 'বৈশাখী স্টেশনারি', 'অফিসের ব্যবহারের জন্য'),
            (1, 5, 2, '2026-11-11', 'রেজিস্টার খাতা ২০০ পৃষ্ঠা', 'হার্ডকভার লেজার', 'VOUCH-102', 4, 'পিস', 180.0, 720.0, 'বৈশাখী স্টেশনারি', 'স্টোর রেজিস্টারের জন্য'),
            (1, 5, 3, '2026-11-12', 'এইচবি পেন্সিল বক্স', '১২ টি পেন্সিল', 'VOUCH-105', 2, 'বক্স', 90.0, 180.0, 'বৈশাখী স্টেশনারি', 'ড্রাফটিং ও ড্রয়িং'),
            # Safety Tools (Category 2, Page 25)
            (2, 25, 1, '2026-11-08', 'সেফটি হেলমেট (হলুদ)', 'আইএসও সার্টিফাইড সাইট হেলমেট', 'SAF-501', 5, 'পিস', 450.0, 2250.0, 'সেইফগার্ড কর্পোরেশন', 'সাইট ভিজিটর ও ইঞ্জিনিয়ারদের জন্য'),
            (2, 25, 2, '2026-11-09', 'লেদার ওয়ার্কিং গ্লাভস', 'হেভি ডিউটি', 'SAF-504', 10, 'জোড়া', 120.0, 1200.0, 'সেইফগার্ড কর্পোরেশন', 'মালামাল লোড-আনলোড'),
            # Electrical (Category 3, Page 45)
            (3, 45, 1, '2026-11-14', 'ফিলিপস ২০ ওয়াট এলইডি বাল্ব', 'হোয়াইট ডে-লাইট', 'ELEC-220', 6, 'পিস', 280.0, 1680.0, 'আল-মদিনা ইলেকট্রিক', 'মেইন অফিস রুমের জন্য'),
            # IT & Electronics (Category 4, Page 65)
            (4, 65, 1, '2026-11-05', 'এইচপি লেজারজেট প্রিন্টার (107a)', 'মনোক্রোম লেজার প্রিন্টার', 'IT-9921', 1, 'পিস', 14500.0, 14500.0, 'স্টার টেক কম্পিউটার', 'অফিস ডকুমেন্ট প্রিন্টিং'),
            (4, 65, 2, '2026-11-07', 'সানডিস্ক ৩২ জিবি পেন ড্রাইভ', 'ইউএসবি ৩.০ মেটাল বডি', 'IT-9945', 2, 'পিস', 650.0, 1300.0, 'স্টার টেক কম্পিউটার', 'ডাটা ব্যাকআপ ও ট্রান্সফার'),
            # Photocopy (Category 5, Page 85)
            (5, 85, 1, '2026-11-15', 'অফিসিয়াল ডকুমেন্ট ফটোকপি', 'এ৪ সাইজ দ্বিমুখী কপি', 'CP-304', 150, 'কপি', 3.0, 450.0, 'ডিজিটাল প্রেস', 'মিটিং মিনিটস ও রিপোর্ট কপি')
        ]
        
        cursor.executemany('''
        INSERT INTO items (category_id, page_number, serial_no, entry_date, item_name, specification, voucher_no, quantity, unit, unit_price, total_price, supplier, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', sample_items)
        
        # Default settings
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('book_title', 'মালামাল ক্রয় রেজিস্টার খাতা')")
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('org_name', 'আমার প্রতিষ্ঠান / ব্যক্তিগত খতিয়ান')")
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('total_pages', '250')")
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('currency', '৳')")
        
    conn.commit()
    conn.close()

def get_categories():
    conn = get_db_connection()
    categories = conn.execute('''
    SELECT c.*, 
           COUNT(i.id) as item_count, 
           COALESCE(SUM(i.total_price), 0) as total_amount
    FROM categories c
    LEFT JOIN items i ON c.id = i.category_id
    GROUP BY c.id
    ORDER BY c.page_number ASC
    ''').fetchall()
    conn.close()
    return [dict(cat) for cat in categories]

def get_category_by_id(cat_id):
    conn = get_db_connection()
    cat = conn.execute('SELECT * FROM categories WHERE id = ?', (cat_id,)).fetchone()
    conn.close()
    return dict(cat) if cat else None

def get_category_by_page(page_number):
    conn = get_db_connection()
    # Match exact page or falling in range page_number <= page <= page_end
    cat = conn.execute('''
    SELECT * FROM categories 
    WHERE page_number = ? 
       OR (page_number <= ? AND page_end >= ?)
    ORDER BY page_number DESC LIMIT 1
    ''', (page_number, page_number, page_number)).fetchone()
    conn.close()
    return dict(cat) if cat else None

def add_category(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    INSERT INTO categories (name, name_bn, page_number, page_end, description, icon, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('name', ''),
        data.get('name_bn', data.get('name', '')),
        int(data.get('page_number', 1)),
        int(data.get('page_end', data.get('page_number', 1))),
        data.get('description', ''),
        data.get('icon', '📦'),
        data.get('color', '#0f766e')
    ))
    cat_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return cat_id

def update_category(cat_id, data):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    UPDATE categories
    SET name = ?, name_bn = ?, page_number = ?, page_end = ?, description = ?, icon = ?, color = ?
    WHERE id = ?
    ''', (
        data.get('name', ''),
        data.get('name_bn', data.get('name', '')),
        int(data.get('page_number', 1)),
        int(data.get('page_end', data.get('page_number', 1))),
        data.get('description', ''),
        data.get('icon', '📦'),
        data.get('color', '#0f766e'),
        cat_id
    ))
    conn.commit()
    conn.close()
    return True

def delete_category(cat_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # delete items first or rely on cascade
    cursor.execute('DELETE FROM items WHERE category_id = ?', (cat_id,))
    cursor.execute('DELETE FROM categories WHERE id = ?', (cat_id,))
    conn.commit()
    conn.close()
    return True

def get_items(category_id=None, page_number=None, search=None, start_date=None, end_date=None):
    conn = get_db_connection()
    query = '''
    SELECT i.*, c.name as category_name, c.name_bn as category_name_bn, c.icon as category_icon, c.color as category_color
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE 1=1
    '''
    params = []
    
    if category_id:
        query += ' AND i.category_id = ?'
        params.append(category_id)
        
    if page_number:
        query += ' AND i.page_number = ?'
        params.append(page_number)
        
    if start_date:
        query += ' AND i.entry_date >= ?'
        params.append(start_date)
        
    if end_date:
        query += ' AND i.entry_date <= ?'
        params.append(end_date)
        
    if search:
        query += ''' AND (
            i.item_name LIKE ? OR 
            i.specification LIKE ? OR 
            i.voucher_no LIKE ? OR 
            i.supplier LIKE ? OR 
            i.remarks LIKE ? OR 
            c.name LIKE ? OR 
            c.name_bn LIKE ?
        )'''
        search_pattern = f'%{search}%'
        params.extend([search_pattern] * 7)
        
    query += ' ORDER BY i.entry_date DESC, i.id DESC'
    
    items = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(item) for item in items]

def get_page_items(page_number):
    conn = get_db_connection()
    items = conn.execute('''
    SELECT i.*, c.name as category_name, c.name_bn as category_name_bn, c.icon as category_icon
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE i.page_number = ?
    ORDER BY i.entry_date ASC, i.id ASC
    ''', (page_number,)).fetchall()
    conn.close()
    return [dict(item) for item in items]

def add_item(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    category_id = data.get('category_id')
    page_number = data.get('page_number')
    
    # Auto-resolve page number from category if not explicitly given
    if not page_number and category_id:
        cat = conn.execute('SELECT page_number FROM categories WHERE id = ?', (category_id,)).fetchone()
        if cat:
            page_number = cat['page_number']
        else:
            page_number = 1
            
    # Calculate next serial number for this page
    cur_serial = conn.execute('SELECT COALESCE(MAX(serial_no), 0) + 1 as next_sl FROM items WHERE page_number = ?', (page_number,)).fetchone()['next_sl']
    
    qty = float(data.get('quantity', 1))
    rate = float(data.get('unit_price', 0))
    total = float(data.get('total_price', qty * rate))
    
    cursor.execute('''
    INSERT INTO items (
        category_id, page_number, serial_no, entry_date, item_name, 
        specification, voucher_no, quantity, unit, unit_price, 
        total_price, supplier, remarks, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ''', (
        category_id,
        page_number,
        cur_serial,
        data.get('entry_date', datetime.now().strftime('%Y-%m-%d')),
        data.get('item_name', '').strip(),
        data.get('specification', '').strip(),
        data.get('voucher_no', '').strip(),
        qty,
        data.get('unit', 'পিস').strip(),
        rate,
        total,
        data.get('supplier', '').strip(),
        data.get('remarks', '').strip()
    ))
    
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return item_id

def update_item(item_id, data):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    qty = float(data.get('quantity', 1))
    rate = float(data.get('unit_price', 0))
    total = float(data.get('total_price', qty * rate))
    
    cursor.execute('''
    UPDATE items
    SET category_id = ?, 
        page_number = ?, 
        entry_date = ?, 
        item_name = ?, 
        specification = ?, 
        voucher_no = ?, 
        quantity = ?, 
        unit = ?, 
        unit_price = ?, 
        total_price = ?, 
        supplier = ?, 
        remarks = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    ''', (
        data.get('category_id'),
        data.get('page_number'),
        data.get('entry_date'),
        data.get('item_name', '').strip(),
        data.get('specification', '').strip(),
        data.get('voucher_no', '').strip(),
        qty,
        data.get('unit', 'পিস').strip(),
        rate,
        total,
        data.get('supplier', '').strip(),
        data.get('remarks', '').strip(),
        item_id
    ))
    
    conn.commit()
    conn.close()
    return True

def delete_item(item_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM items WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()
    return True

def get_summary():
    conn = get_db_connection()
    total_categories = conn.execute('SELECT COUNT(*) as count FROM categories').fetchone()['count']
    total_items = conn.execute('SELECT COUNT(*) as count FROM items').fetchone()['count']
    total_cost = conn.execute('SELECT COALESCE(SUM(total_price), 0) as total FROM items').fetchone()['total']
    
    # Active pages with items
    active_pages = conn.execute('SELECT COUNT(DISTINCT page_number) as count FROM items').fetchone()['count']
    
    conn.close()
    return {
        'total_pages_capacity': 250,
        'active_pages': active_pages,
        'total_categories': total_categories,
        'total_items': total_items,
        'total_cost': total_cost
    }

def get_full_backup():
    conn = get_db_connection()
    categories = [dict(c) for c in conn.execute('SELECT * FROM categories').fetchall()]
    items = [dict(i) for i in conn.execute('SELECT * FROM items').fetchall()]
    settings = {row['key']: row['value'] for row in conn.execute('SELECT * FROM settings').fetchall()}
    conn.close()
    
    return {
        'version': '1.0',
        'export_time': datetime.now().isoformat(),
        'settings': settings,
        'categories': categories,
        'items': items
    }

def restore_full_backup(backup_data):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Clear existing tables
        cursor.execute('DELETE FROM items')
        cursor.execute('DELETE FROM categories')
        
        # Restore categories
        for cat in backup_data.get('categories', []):
            cursor.execute('''
            INSERT INTO categories (id, name, name_bn, page_number, page_end, description, icon, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                cat.get('id'),
                cat.get('name'),
                cat.get('name_bn'),
                cat.get('page_number'),
                cat.get('page_end'),
                cat.get('description'),
                cat.get('icon', '📦'),
                cat.get('color', '#0f766e')
            ))
            
        # Restore items
        for item in backup_data.get('items', []):
            cursor.execute('''
            INSERT INTO items (
                id, category_id, page_number, serial_no, entry_date, 
                item_name, specification, voucher_no, quantity, unit, 
                unit_price, total_price, supplier, remarks
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                item.get('id'),
                item.get('category_id'),
                item.get('page_number'),
                item.get('serial_no'),
                item.get('entry_date'),
                item.get('item_name'),
                item.get('specification'),
                item.get('voucher_no'),
                item.get('quantity'),
                item.get('unit'),
                item.get('unit_price'),
                item.get('total_price'),
                item.get('supplier'),
                item.get('remarks')
            ))
            
        conn.commit()
        return True, "ব্যাকআপ সফলভাবে পুনরুদ্ধার করা হয়েছে।"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()

# Auto-initialize DB on import
init_db()

