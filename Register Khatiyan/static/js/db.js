/**
 * ডিজিটাল খতিয়ান - ক্লায়েন্ট সাইড ডাটাবেজ ও সিঙ্ক হ্যান্ডলার (IndexedDB & LocalStorage)
 * Handles both online server sync and standalone offline local storage.
 */

const DB_NAME = 'RegisterKhatiyanDB';
const DB_VERSION = 1;

class KhatiyanDB {
  constructor() {
    this.db = null;
    this.serverOnline = false;
    this.initPromise = this.init();
  }

  async init() {
    // 1. Check if server API is reachable
    try {
      const res = await fetch('/api/summary?_t=' + Date.now(), { 
        cache: 'no-store',
        signal: AbortSignal.timeout(3500) 
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.offline) {
          this.serverOnline = true;
          console.log('✅ Connected to Python Server API');
        }
      }
    } catch (e) {
      this.serverOnline = false;
      console.log('⚠️ Running in Standalone / Offline Mode using IndexedDB');
    }

    // 2. Open IndexedDB for offline cache & persistence
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('categories')) {
          const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
          catStore.createIndex('page_number', 'page_number', { unique: false });
        }

        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
          itemStore.createIndex('category_id', 'category_id', { unique: false });
          itemStore.createIndex('page_number', 'page_number', { unique: false });
          itemStore.createIndex('entry_date', 'entry_date', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        // If empty offline database and not connected, seed defaults
        this.seedOfflineDefaults();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        resolve(null);
      };
    });
  }

  async seedOfflineDefaults() {
    const cats = await this.getAllFromStore('categories');
    if (cats.length === 0 && !this.serverOnline) {
      const defaultCats = [
        { id: 1, name: "Stationery Items", name_bn: "স্টেশনারি দ্রব্যাদি", page_number: 5, page_end: 24, description: "কলম, খাতা, পেন্সিল, পেপার রিম, স্ট্যাপলার ইত্যাদি", icon: "✏️", color: "#2563eb" },
        { id: 2, name: "Safety Tools & Equipment", name_bn: "সেফটি সরঞ্জাম ও পোশাক", page_number: 25, page_end: 44, description: "সেফটি হেলমেট, গ্লাভস, বুট জুতা, রিফ্লেক্টিভ ভেস্ট ইত্যাদি", icon: "🛡️", color: "#059669" },
        { id: 3, name: "Electrical Items", name_bn: "বৈদ্যুতিক মালামাল", page_number: 45, page_end: 64, description: "এলইডি বাল্ব, টিউবলাইট, তার, সুইচ, সকেট ইত্যাদি", icon: "⚡", color: "#d97706" },
        { id: 4, name: "IT & Electronics", name_bn: "কম্পিউটার ও আইটি পণ্য", page_number: 65, page_end: 84, description: "প্রিন্টার, পেন ড্রাইভ, টোনার, মাউস, কীবোর্ড ইত্যাদি", icon: "💻", color: "#7c3aed" },
        { id: 5, name: "Photocopy & Printing", name_bn: "ফটোকপি ও প্রিন্টিং খরচ", page_number: 85, page_end: 104, description: "অফিসিয়াল ফটোকপি, কালার প্রিন্টিং, বাইন্ডিং ইত্যাদি", icon: "🖨️", color: "#0891b2" },
        { id: 6, name: "Cleaning & Hygiene", name_bn: "পরিচ্ছন্নতা সামগ্রী", page_number: 105, page_end: 124, description: "ফ্লোর ক্লিনার, হারপিক, টিস্যু পেপার, ঝাড়ু ইত্যাদি", icon: "🧹", color: "#0d9488" },
        { id: 7, name: "Hardware & Maintenance", name_bn: "হার্ডওয়্যার ও মেরামত সামগ্রী", page_number: 125, page_end: 149, description: "স্ক্রু, নাট-বোল্ট, হাতুড়ি, প্লাস, টেপ, রং ইত্যাদি", icon: "🔧", color: "#ea580c" },
        { id: 8, name: "Miscellaneous", name_bn: "বিবিধ দ্রব্যাদি ও আপ্যায়ন", page_number: 150, page_end: 250, description: "চা-নাস্তা, অতিথি আপ্যায়ন, কুরিয়ার খরচ ইত্যাদি", icon: "☕", color: "#4b5563" }
      ];

      for (const cat of defaultCats) {
        await this.putToStore('categories', cat);
      }
    }
  }

  // Generic IDB Helpers
  getAllFromStore(storeName) {
    return new Promise((resolve) => {
      if (!this.db) return resolve([]);
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  putToStore(storeName, item) {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve(null);
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  deleteFromStore(storeName, key) {
    return new Promise((resolve) => {
      if (!this.db) return resolve(false);
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  clearStore(storeName) {
    return new Promise((resolve) => {
      if (!this.db) return resolve(false);
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  }

  getAuthPin() {
    return localStorage.getItem('khatiyan_admin_pin') || sessionStorage.getItem('khatiyan_admin_pin') || '';
  }

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const pin = this.getAuthPin();
    if (pin) {
      headers['X-Admin-PIN'] = pin;
    }
    return headers;
  }

  async verifyPin(pin) {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      return { ok: res.ok, ...data };
    } catch (e) {
      const savedPin = localStorage.getItem('khatiyan_offline_admin_pin') || '1234';
      if (String(pin).trim() === savedPin) {
        return { ok: true, success: true, message: 'অফলাইন পিন সঠিক হয়েছে' };
      }
      return { ok: false, success: false, error: 'ভুল পিন! পুনরায় চেষ্টা করুন।' };
    }
  }

  async changePin(oldPin, newPin) {
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('khatiyan_offline_admin_pin', String(newPin).trim());
      }
      return { ok: res.ok, ...data };
    } catch (e) {
      const savedPin = localStorage.getItem('khatiyan_offline_admin_pin') || '1234';
      if (String(oldPin).trim() === savedPin) {
        localStorage.setItem('khatiyan_offline_admin_pin', String(newPin).trim());
        return { ok: true, success: true, message: 'অফলাইন পিন সফলভাবে পরিবর্তন করা হয়েছে' };
      }
      return { ok: false, error: 'বর্তমান পিনটি সঠিক নয়' };
    }
  }

  async saveLocalSnapshot() {
    try {
      const cats = await this.getAllFromStore('categories');
      const items = await this.getAllFromStore('items');
      if (items.length > 0 || cats.length > 0) {
        const snapshot = {
          app: 'ডিজিটাল খতিয়ান - মালামাল ক্রয় রেজিস্টার খাতা',
          version: '1.0',
          export_time: new Date().toISOString(),
          timestamp: Date.now(),
          categories: cats,
          items: items
        };
        localStorage.setItem('khatiyan_auto_snapshot', JSON.stringify(snapshot));
        localStorage.setItem('khatiyan_snapshot_count', String(items.length));
        localStorage.setItem('khatiyan_snapshot_time', String(Date.now()));
      }
    } catch (e) {
      console.warn('Could not save snapshot:', e);
    }
  }

  async checkAndSyncServer() {
    await this.initPromise;
    if (!this.serverOnline) return false;

    try {
      const res = await fetch('/api/db-status?_t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return false;
      const status = await res.json();

      const raw = localStorage.getItem('khatiyan_auto_snapshot');
      if (!raw) return false;
      const snapshot = JSON.parse(raw);
      const clientItems = snapshot.items || [];
      const clientCount = clientItems.length;
      const serverCount = status.total_items || 0;

      // If client has items, but server was restarted / wiped or has fewer items
      if (clientCount > 0 && (serverCount < clientCount || status.max_item_id === 0)) {
        console.warn(`[Auto-Sync] Server database has ${serverCount} items, but client local snapshot has ${clientCount} items. Re-hydrating server...`);
        const restoreRes = await fetch('/api/restore', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(snapshot)
        });
        if (restoreRes.ok) {
          console.log('[Auto-Sync] ✅ Server restored from local client snapshot successfully!');
          return true;
        }
      }
    } catch (e) {
      console.warn('Sync check failed:', e);
    }
    return false;
  }

  // ------------------ High Level APIs ------------------

  async getCategories() {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/categories?_t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Full sync to IDB: clear and replace so deleted categories don't persist
            await this.clearStore('categories');
            for (const item of data) {
              await this.putToStore('categories', item);
            }
            await this.saveLocalSnapshot();
            return data;
          }
        }
      } catch (e) {
        this.serverOnline = false;
      }
    }

    // Offline IDB Fallback
    const cats = await this.getAllFromStore('categories');
    const items = await this.getAllFromStore('items');

    return cats.map(cat => {
      const catItems = items.filter(i => i.category_id == cat.id);
      const totalAmount = catItems.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0);
      return {
        ...cat,
        item_count: catItems.length,
        total_amount: totalAmount
      };
    }).sort((a, b) => a.page_number - b.page_number);
  }

  async addCategory(data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'ক্যাটাগরি তৈরি ব্যর্থ হয়েছে', status: res.status };
        }
        if (result.id) {
          await this.putToStore('categories', { ...data, id: result.id });
          await this.saveLocalSnapshot();
        }
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    // Save offline
    const id = Date.now();
    const newCat = { ...data, id, page_number: Number(data.page_number) || 1 };
    await this.putToStore('categories', newCat);
    await this.saveLocalSnapshot();
    return { success: true, id, message: 'ক্যাটাগরি লোকালি সংরক্ষিত হয়েছে' };
  }

  async updateCategory(id, data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'ক্যাটাগরি আপডেট ব্যর্থ হয়েছে', status: res.status };
        }
        await this.putToStore('categories', { ...data, id: Number(id) });
        await this.saveLocalSnapshot();
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const updated = { ...data, id: Number(id), page_number: Number(data.page_number) || 1 };
    await this.putToStore('categories', updated);
    await this.saveLocalSnapshot();
    return { success: true };
  }

  async deleteCategory(id) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'ক্যাটাগরি মুছে ফেলা ব্যর্থ হয়েছে', status: res.status };
        }
        await this.deleteFromStore('categories', Number(id));
        await this.saveLocalSnapshot();
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    await this.deleteFromStore('categories', Number(id));
    await this.saveLocalSnapshot();
    return { success: true };
  }

  async getPageData(pageNumber) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/page/${pageNumber}?_t=` + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const pageData = await res.json();
          if (pageData && !pageData.offline) {
            if (Array.isArray(pageData.items)) {
              for (const it of pageData.items) {
                await this.putToStore('items', it);
              }
            }
            return pageData;
          }
        }
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const cats = await this.getAllFromStore('categories');
    const items = await this.getAllFromStore('items');
    
    // Find category for this page
    const pageNum = Number(pageNumber);
    const category = cats.find(c => c.page_number === pageNum || (c.page_number <= pageNum && c.page_end >= pageNum)) || null;
    
    const pageItems = items.filter(i => Number(i.page_number) === pageNum);
    const totalAmount = pageItems.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0);

    return {
      page_number: pageNum,
      category,
      items: pageItems,
      total_items: pageItems.length,
      total_amount: totalAmount
    };
  }

  async getItems(filters = {}) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const params = new URLSearchParams();
        if (filters.category_id) params.append('category_id', filters.category_id);
        if (filters.page_number) params.append('page_number', filters.page_number);
        if (filters.search) params.append('search', filters.search);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);
        params.append('_t', Date.now());

        const res = await fetch(`/api/items?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items)) {
            // Caching to IDB if full list is fetched: clear and replace so deleted items are removed
            if (!filters.category_id && !filters.page_number && !filters.search && !filters.start_date && !filters.end_date) {
              await this.clearStore('items');
              for (const item of items) {
                await this.putToStore('items', item);
              }
              await this.saveLocalSnapshot();
            }
            return items;
          }
        }
      } catch (e) {
        this.serverOnline = false;
      }
    }

    // Offline Filter
    let items = await this.getAllFromStore('items');
    const cats = await this.getAllFromStore('categories');
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

    items = items.map(item => ({
      ...item,
      category_name: catMap[item.category_id]?.name || '',
      category_name_bn: catMap[item.category_id]?.name_bn || '',
      category_icon: catMap[item.category_id]?.icon || '📦'
    }));

    if (filters.category_id) {
      items = items.filter(i => i.category_id == filters.category_id);
    }
    if (filters.page_number) {
      items = items.filter(i => i.page_number == filters.page_number);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i => 
        (i.item_name && i.item_name.toLowerCase().includes(q)) ||
        (i.voucher_no && i.voucher_no.toLowerCase().includes(q)) ||
        (i.supplier && i.supplier.toLowerCase().includes(q)) ||
        (i.remarks && i.remarks.toLowerCase().includes(q)) ||
        (i.category_name_bn && i.category_name_bn.toLowerCase().includes(q))
      );
    }
    if (filters.start_date) {
      items = items.filter(i => i.entry_date && i.entry_date >= filters.start_date);
    }
    if (filters.end_date) {
      items = items.filter(i => i.entry_date && i.entry_date <= filters.end_date);
    }

    return items.sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
  }

  async addItem(data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/items', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'এন্ট্রি সংরক্ষণ ব্যর্থ হয়েছে', status: res.status };
        }
        const createdId = result.id || Date.now();
        const savedItem = {
          ...data,
          id: createdId,
          quantity: Number(data.quantity) || 1,
          unit_price: Number(data.unit_price) || 0,
          total_price: Number(data.total_price) || 0,
          page_number: Number(data.page_number) || 1,
          category_id: Number(data.category_id) || 1,
          created_at: new Date().toISOString()
        };
        await this.putToStore('items', savedItem);
        await this.saveLocalSnapshot();
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const id = Date.now();
    const qty = Number(data.quantity) || 1;
    const rate = Number(data.unit_price) || 0;
    const total = Number(data.total_price) || (qty * rate);

    const newItem = {
      ...data,
      id,
      quantity: qty,
      unit_price: rate,
      total_price: total,
      page_number: Number(data.page_number) || 1,
      category_id: Number(data.category_id) || 1,
      created_at: new Date().toISOString()
    };

    await this.putToStore('items', newItem);
    await this.saveLocalSnapshot();
    return { success: true, id, message: 'নতুন মালামাল লোকালি এন্ট্রি হয়েছে' };
  }

  async updateItem(id, data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/items/${id}`, {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'এন্ট্রি আপডেট ব্যর্থ হয়েছে', status: res.status };
        }
        const updated = {
          ...data,
          id: Number(id),
          quantity: Number(data.quantity) || 1,
          unit_price: Number(data.unit_price) || 0,
          total_price: Number(data.total_price) || 0,
          page_number: Number(data.page_number) || 1,
          category_id: Number(data.category_id) || 1
        };
        await this.putToStore('items', updated);
        await this.saveLocalSnapshot();
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const qty = Number(data.quantity) || 1;
    const rate = Number(data.unit_price) || 0;
    const total = Number(data.total_price) || (qty * rate);

    const updated = {
      ...data,
      id: Number(id),
      quantity: qty,
      unit_price: rate,
      total_price: total,
      page_number: Number(data.page_number) || 1,
      category_id: Number(data.category_id) || 1
    };

    await this.putToStore('items', updated);
    await this.saveLocalSnapshot();
    return { success: true };
  }

  async deleteItem(id) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/items/${id}`, { 
          method: 'DELETE',
          headers: this.getAuthHeaders()
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, error: result.error || 'এন্ট্রি ডিলিট ব্যর্থ হয়েছে', status: res.status };
        }
        await this.deleteFromStore('items', Number(id));
        await this.saveLocalSnapshot();
        return result;
      } catch (e) {
        this.serverOnline = false;
      }
    }

    await this.deleteFromStore('items', Number(id));
    await this.saveLocalSnapshot();
    return { success: true };
  }

  async getSummary() {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/summary?_t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && !data.offline) return data;
        }
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const cats = await this.getAllFromStore('categories');
    const items = await this.getAllFromStore('items');
    const totalCost = items.reduce((sum, i) => sum + (Number(i.total_price) || 0), 0);
    const uniquePages = new Set(items.map(i => i.page_number)).size;

    return {
      total_pages_capacity: 250,
      active_pages: uniquePages,
      total_categories: cats.length,
      total_items: items.length,
      total_cost: totalCost
    };
  }

  async getNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) return await res.json();
    } catch (e) {
      // offline
    }
    return null;
  }
}

// Global DB instance
window.khatiyanDB = new KhatiyanDB();

