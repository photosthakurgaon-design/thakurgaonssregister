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
      const res = await fetch('/api/summary', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        this.serverOnline = true;
        console.log('✅ Connected to Python Server API');
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

  // ------------------ High Level APIs ------------------

  async getCategories() {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          // Cache to IDB
          for (const item of data) {
            await this.putToStore('categories', item);
          }
          return data;
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.serverOnline = false;
      }
    }

    // Save offline
    const id = Date.now();
    const newCat = { ...data, id, page_number: Number(data.page_number) || 1 };
    await this.putToStore('categories', newCat);
    return { success: true, id, message: 'ক্যাটাগরি লোকালি সংরক্ষিত হয়েছে' };
  }

  async updateCategory(id, data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
      } catch (e) {
        this.serverOnline = false;
      }
    }

    const updated = { ...data, id: Number(id), page_number: Number(data.page_number) || 1 };
    await this.putToStore('categories', updated);
    return { success: true };
  }

  async deleteCategory(id) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) return await res.json();
      } catch (e) {
        this.serverOnline = false;
      }
    }

    await this.deleteFromStore('categories', Number(id));
    return { success: true };
  }

  async getPageData(pageNumber) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/page/${pageNumber}`);
        if (res.ok) return await res.json();
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

        const res = await fetch(`/api/items?${params.toString()}`);
        if (res.ok) {
          const items = await res.json();
          return items;
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
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
    return { success: true, id, message: 'নতুন মালামাল লোকালি এন্ট্রি হয়েছে' };
  }

  async updateItem(id, data) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/items/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) return await res.json();
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
    return { success: true };
  }

  async deleteItem(id) {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
        if (res.ok) return await res.json();
      } catch (e) {
        this.serverOnline = false;
      }
    }

    await this.deleteFromStore('items', Number(id));
    return { success: true };
  }

  async getSummary() {
    await this.initPromise;
    if (this.serverOnline) {
      try {
        const res = await fetch('/api/summary');
        if (res.ok) return await res.json();
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

