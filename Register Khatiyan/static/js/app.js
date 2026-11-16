/**
 * ডিজিটাল খতিয়ান - মূল অ্যাপ্লিকেশন স্ক্রিপ্ট (app.js)
 * Master controller for navigation, entries, categories, modals, PWA & offline sync.
 */

const App = {
  state: {
    currentPage: 1, // Page 1 = সূচিপত্র (Master Index)
    totalPages: 250,
    categories: [],
    pageData: { page_number: 1, category: null, items: [], total_amount: 0 },
    summary: {},
    searchQuery: '',
    deferredPrompt: null,
    editingItemId: null,
    editingCategoryId: null,
    viewMode: 'ledger', // 'ledger' | 'all-table' | 'date-filter'
    dateFilter: {
      startDate: '',
      endDate: '',
      categoryId: '',
      items: []
    }
  },

  // Initialize App
  async init() {
    this.initSidebarState();
    this.bindEvents();
    this.registerPWA();
    await this.loadInitialData();
    this.render();

    // Check URL Hash for deep linking (#page-15 or #new-entry)
    this.handleUrlHash();
    window.addEventListener('hashchange', () => this.handleUrlHash());
  },

  handleUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#page-')) {
      const pageNum = parseInt(hash.replace('#page-', ''), 10);
      if (pageNum >= 1 && pageNum <= this.state.totalPages) {
        this.goToPage(pageNum, false);
      }
    } else if (hash === '#new-entry') {
      this.openNewEntryModal();
    }
  },

  // Register Service Worker for Offline PWA
  registerPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('✅ ServiceWorker Registered successfully:', reg.scope))
          .catch((err) => console.log('❌ ServiceWorker Registration failed:', err));
      });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.state.deferredPrompt = e;
      const installBtn = document.getElementById('btn-install-pwa');
      const mobileInstallBtn = document.getElementById('mobile-btn-install-pwa');
      if (installBtn) installBtn.classList.remove('hidden');
      if (mobileInstallBtn) mobileInstallBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
      this.state.deferredPrompt = null;
      this.showToast('✅ রেজিস্টার খাতা সফলভাবে অ্যাপ হিসেবে ইনস্টল হয়েছে!');
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) installBtn.classList.add('hidden');
    });
  },

  async promptInstallPWA() {
    if (this.state.deferredPrompt) {
      this.state.deferredPrompt.prompt();
      const { outcome } = await this.state.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the PWA install');
      }
      this.state.deferredPrompt = null;
    } else {
      this.openMobileConnectModal();
    }
  },

  // Load Categories & Summary
  async loadInitialData() {
    try {
      this.state.categories = await window.khatiyanDB.getCategories();
      this.state.summary = await window.khatiyanDB.getSummary();
      this.populatePageSelector();
      await this.loadPage(this.state.currentPage);
    } catch (e) {
      console.error('Error loading initial data:', e);
    }
  },

  // Load specific page data
  async loadPage(pageNumber) {
    this.state.currentPage = pageNumber;
    if (pageNumber === 1) {
      // Index Page
      this.state.categories = await window.khatiyanDB.getCategories();
      this.state.summary = await window.khatiyanDB.getSummary();
    } else {
      // Ledger Ruled Page
      this.state.pageData = await window.khatiyanDB.getPageData(pageNumber);
    }
    this.render();
  },

  // Navigate to Page
  goToPage(pageNum, updateHash = true) {
    if (pageNum < 1) pageNum = 1;
    if (pageNum > this.state.totalPages) pageNum = this.state.totalPages;
    
    this.state.viewMode = 'ledger';
    if (updateHash) {
      window.location.hash = `#page-${pageNum}`;
    }
    this.loadPage(pageNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  nextPage() {
    if (this.state.currentPage < this.state.totalPages) {
      this.goToPage(this.state.currentPage + 1);
    }
  },

  prevPage() {
    if (this.state.currentPage > 1) {
      this.goToPage(this.state.currentPage - 1);
    }
  },

  // Render UI depending on current page
  render() {
    // Update Top Navigation Bar page input
    const pageSelect = document.getElementById('top-page-selector');
    if (pageSelect) {
      pageSelect.value = this.state.currentPage;
    }

    const topBadge = document.getElementById('top-current-page-badge');
    const sidebarBadge = document.getElementById('sidebar-current-page-badge');
    const pageLabel = `পৃষ্ঠা ${this.state.currentPage} / ${this.state.totalPages}`;
    if (topBadge) topBadge.textContent = pageLabel;
    if (sidebarBadge) sidebarBadge.textContent = pageLabel;

    const indexView = document.getElementById('view-index-page');
    const ledgerView = document.getElementById('view-ledger-page');
    const allRecordsView = document.getElementById('view-all-records');
    const dateFilterView = document.getElementById('view-date-filter');

    if (this.state.viewMode === 'date-filter') {
      if (indexView) indexView.classList.add('hidden');
      if (ledgerView) ledgerView.classList.add('hidden');
      if (allRecordsView) allRecordsView.classList.add('hidden');
      if (dateFilterView) dateFilterView.classList.remove('hidden');

      const startInput = document.getElementById('filter-start-date');
      const endInput = document.getElementById('filter-end-date');
      if (startInput && this.state.dateFilter.startDate) startInput.value = this.state.dateFilter.startDate;
      if (endInput && this.state.dateFilter.endDate) endInput.value = this.state.dateFilter.endDate;

      this.loadDateFilteredItems();
      return;
    }

    if (dateFilterView) dateFilterView.classList.add('hidden');

    if (this.state.viewMode === 'all-table') {
      if (indexView) indexView.classList.add('hidden');
      if (ledgerView) ledgerView.classList.add('hidden');
      if (allRecordsView) allRecordsView.classList.remove('hidden');
      this.renderAllRecordsTable();
      return;
    }

    if (allRecordsView) allRecordsView.classList.add('hidden');

    if (this.state.currentPage === 1) {
      // Show Index Page (সূচিপত্র)
      if (indexView) indexView.classList.remove('hidden');
      if (ledgerView) ledgerView.classList.add('hidden');
      this.renderIndexPage();
    } else {
      // Show Ledger Page (খাতার পৃষ্ঠা)
      if (indexView) indexView.classList.add('hidden');
      if (ledgerView) ledgerView.classList.remove('hidden');
      this.renderLedgerPage();
    }

    this.updateSummaryBadges();
  },

  updateSummaryBadges() {
    const s = this.state.summary;
    const totalCostEl = document.getElementById('stat-total-cost');
    const totalItemsEl = document.getElementById('stat-total-items');
    const activePagesEl = document.getElementById('stat-active-pages');

    if (totalCostEl) totalCostEl.textContent = '৳ ' + (Number(s.total_cost) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (totalItemsEl) totalItemsEl.textContent = (s.total_items || 0) + ' টি';
    if (activePagesEl) activePagesEl.textContent = (s.active_pages || 0) + ' / ২৫০';
  },

  // Render Page 1: Index (সূচিপত্র)
  renderIndexPage() {
    const tableBody = document.getElementById('index-table-body');
    const cardsContainer = document.getElementById('index-cards-mobile');
    if (!tableBody) return;

    let rowsHtml = '';
    let cardsHtml = '';

    if (this.state.categories.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="7" class="text-center py-8 text-gray-500">
            কোনো মাদার ক্যাটাগরি তৈরি করা হয়নি। নতুন ক্যাটাগরি যোগ করুন।
          </td>
        </tr>
      `;
    } else {
      this.state.categories.forEach((cat, idx) => {
        const pageRangeText = (cat.page_end && cat.page_end !== cat.page_number) 
          ? `পৃষ্ঠা ${cat.page_number} - ${cat.page_end}` 
          : `পৃষ্ঠা ${cat.page_number}`;

        rowsHtml += `
          <tr class="hover:bg-teal-50/50 transition">
            <td class="text-center font-bold text-gray-600">${idx + 1}</td>
            <td>
              <div class="flex items-center space-x-3">
                <span class="text-2xl">${cat.icon || '📦'}</span>
                <div>
                  <div class="font-bold text-teal-900 text-base cursor-pointer hover:underline" onclick="App.goToPage(${cat.page_number})">
                    ${cat.name_bn || cat.name}
                  </div>
                  <div class="text-xs text-gray-500">${cat.name}</div>
                </div>
              </div>
            </td>
            <td class="text-gray-700 text-sm max-w-xs truncate" title="${cat.description || ''}">
              ${cat.description || '<span class="text-gray-400">বিবরণ যুক্ত করা হয়নি</span>'}
            </td>
            <td class="text-center">
              <button onclick="App.goToPage(${cat.page_number})" class="page-badge cursor-pointer" title="এই পৃষ্ঠায় যান">
                📖 ${pageRangeText}
              </button>
            </td>
            <td class="text-center font-semibold text-gray-700">
              ${cat.item_count || 0} টি
            </td>
            <td class="text-right font-bold text-emerald-800">
              ৳ ${(Number(cat.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
            <td class="text-center space-x-1">
              <button onclick="App.goToPage(${cat.page_number})" class="px-2.5 py-1 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded shadow-sm inline-flex items-center gap-1">
                <span>পৃষ্ঠা খুলুন</span> ➔
              </button>
              <button onclick="App.openNewEntryModal(${cat.id}, ${cat.page_number})" class="px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 rounded border border-emerald-300" title="এই ক্যাটাগরিতে নতুন এন্ট্রি">
                ➕ এন্ট্রি
              </button>
              <button onclick="App.openCategoryModal(${cat.id})" class="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300" title="সম্পাদনা">
                ✏️
              </button>
            </td>
          </tr>
        `;

        // Mobile Card View
        cardsHtml += `
          <div class="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${cat.icon || '📦'}</span>
                <div>
                  <h4 class="font-bold text-gray-900">${cat.name_bn || cat.name}</h4>
                  <p class="text-xs text-gray-500">${cat.name}</p>
                </div>
              </div>
              <button onclick="App.goToPage(${cat.page_number})" class="page-badge text-xs">
                ${pageRangeText}
              </button>
            </div>
            <p class="text-xs text-gray-600 mb-3">${cat.description || ''}</p>
            <div class="flex justify-between items-center text-xs border-t pt-2 border-gray-100">
              <span class="text-gray-500">এন্ট্রি: <strong>${cat.item_count || 0} টি</strong></span>
              <span class="text-emerald-700 font-bold text-sm">৳ ${(Number(cat.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="mt-3 flex gap-2">
              <button onclick="App.goToPage(${cat.page_number})" class="flex-1 py-1.5 text-xs font-semibold text-white bg-teal-700 rounded-lg text-center">
                📖 পৃষ্ঠা খুলুন
              </button>
              <button onclick="App.openNewEntryModal(${cat.id}, ${cat.page_number})" class="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg">
                ➕ এন্ট্রি
              </button>
            </div>
          </div>
        `;
      });
    }

    tableBody.innerHTML = rowsHtml;
    if (cardsContainer) cardsContainer.innerHTML = cardsHtml;
  },

  // Render Ledger Page (Pages 2 to 250)
  renderLedgerPage() {
    const data = this.state.pageData;
    const pageNum = this.state.currentPage;

    // Update Header Info
    const pageNumTitle = document.getElementById('ledger-page-num-title');
    const catTitle = document.getElementById('ledger-category-title');
    const catSubtitle = document.getElementById('ledger-category-subtitle');
    const pageItemCount = document.getElementById('ledger-page-item-count');
    const pageTotalAmount = document.getElementById('ledger-page-total-amount');

    if (pageNumTitle) pageNumTitle.textContent = `পৃষ্ঠা নং: ${pageNum}`;

    if (data.category) {
      if (catTitle) catTitle.innerHTML = `<span class="mr-2">${data.category.icon || '📦'}</span> ${data.category.name_bn || data.category.name}`;
      if (catSubtitle) catSubtitle.textContent = `মাদার ইনডেক্স: ${data.category.name} | ${data.category.description || ''}`;
    } else {
      if (catTitle) catTitle.innerHTML = `📖 সাধারণ হিসাব ও মালামাল তালিকা`;
      if (catSubtitle) catSubtitle.textContent = `এই পৃষ্ঠার জন্য কোনো নির্দিষ্ট মাদার ক্যাটাগরি বরাদ্দ করা নেই`;
    }

    if (pageItemCount) pageItemCount.textContent = `${data.total_items || 0} টি`;
    if (pageTotalAmount) pageTotalAmount.textContent = '৳ ' + (Number(data.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    // Table Rows
    const tableBody = document.getElementById('ledger-table-body');
    const grandTotalFooter = document.getElementById('ledger-footer-total');

    if (!tableBody) return;

    let rowsHtml = '';
    const items = data.items || [];

    if (items.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="10" class="text-center py-12 text-gray-500 bg-amber-50/30">
            <div class="text-4xl mb-2">📝</div>
            <p class="font-semibold text-gray-700 text-base">এই পৃষ্ঠায় এখনও কোনো মালামাল এন্ট্রি করা হয়নি</p>
            <p class="text-xs text-gray-500 mt-1">খাতায় নতুন হিসাব লিখতে নিচের বাটনে ক্লিক করুন</p>
            <button onclick="App.openNewEntryModal(null, ${pageNum})" class="mt-3 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium text-sm shadow">
              ➕ এই পৃষ্ঠায় নতুন এন্ট্রি দিন
            </button>
          </td>
        </tr>
      `;
      // Fill blank ruled rows to simulate authentic empty register lines
      for (let i = 0; i < 8; i++) {
        rowsHtml += `
          <tr class="empty-row">
            <td class="text-center text-gray-300 font-bold">${i + 1}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        `;
      }
    } else {
      items.forEach((item, idx) => {
        const itemTotal = Number(item.total_price) || 0;
        const itemRate = Number(item.unit_price) || 0;

        rowsHtml += `
          <tr class="hover:bg-teal-50/50 transition">
            <td class="text-center font-bold text-gray-600">${idx + 1}</td>
            <td class="text-center whitespace-nowrap text-sm font-medium text-gray-700">
              ${PrintManager.formatDate(item.entry_date)}
            </td>
            <td>
              <div class="font-bold text-gray-900">${item.item_name}</div>
              ${item.specification ? `<div class="text-xs text-gray-500">${item.specification}</div>` : ''}
            </td>
            <td class="text-center text-xs font-mono text-gray-600">
              ${item.voucher_no || '<span class="text-gray-400">-</span>'}
            </td>
            <td class="text-center font-bold text-gray-800">
              ${item.quantity}
            </td>
            <td class="text-center text-xs text-gray-600">
              ${item.unit || 'পিস'}
            </td>
            <td class="text-right text-sm text-gray-700">
              ৳ ${itemRate.toFixed(2)}
            </td>
            <td class="text-right font-bold text-emerald-800 text-sm">
              ৳ ${itemTotal.toFixed(2)}
            </td>
            <td class="text-xs text-gray-600">
              ${item.supplier ? `<div class="font-semibold text-gray-700">দোকান: ${item.supplier}</div>` : ''}
              ${item.remarks ? `<div>${item.remarks}</div>` : ''}
              ${!item.supplier && !item.remarks ? '<span class="text-gray-400">-</span>' : ''}
            </td>
            <td class="text-center action-column whitespace-nowrap">
              <button onclick="App.openEditItemModal(${item.id})" class="p-1 text-teal-700 hover:text-teal-900 hover:bg-teal-100 rounded" title="এডিট">
                ✏️
              </button>
              <button onclick="App.deleteItem(${item.id})" class="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded ml-1" title="মুছে ফেলুন">
                🗑️
              </button>
            </td>
          </tr>
        `;
      });

      // Fill remaining blank lines to keep ruled book appearance
      const remainingLines = Math.max(0, 10 - items.length);
      for (let i = 0; i < remainingLines; i++) {
        rowsHtml += `
          <tr class="empty-row">
            <td class="text-center text-gray-300 font-bold">${items.length + i + 1}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        `;
      }
    }

    tableBody.innerHTML = rowsHtml;
    if (grandTotalFooter) {
      grandTotalFooter.textContent = '৳ ' + (Number(data.total_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    }
  },

  // Render All Records Table View
  async renderAllRecordsTable() {
    const tableBody = document.getElementById('all-records-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-gray-500">ডাটা লোড হচ্ছে...</td></tr>`;

    const items = await window.khatiyanDB.getItems({ search: this.state.searchQuery });
    let rows = '';

    if (items.length === 0) {
      rows = `<tr><td colspan="10" class="text-center py-8 text-gray-500">কোনো মালামালের রেকর্ড পাওয়া যায়নি।</td></tr>`;
    } else {
      items.forEach((item, idx) => {
        rows += `
          <tr class="hover:bg-teal-50/40">
            <td class="text-center font-bold text-gray-500">${idx + 1}</td>
            <td class="text-center">
              <button onclick="App.goToPage(${item.page_number})" class="page-badge text-xs">
                পৃষ্ঠা ${item.page_number}
              </button>
            </td>
            <td class="text-sm font-semibold text-teal-800">${item.category_name_bn || item.category_name || '-'}</td>
            <td class="text-center text-xs whitespace-nowrap">${PrintManager.formatDate(item.entry_date)}</td>
            <td>
              <span class="font-bold text-gray-900">${item.item_name}</span>
              ${item.specification ? `<span class="text-xs text-gray-500 block">${item.specification}</span>` : ''}
            </td>
            <td class="text-center text-xs font-mono">${item.voucher_no || '-'}</td>
            <td class="text-center font-bold">${item.quantity} ${item.unit || ''}</td>
            <td class="text-right text-sm">৳ ${(Number(item.unit_price) || 0).toFixed(2)}</td>
            <td class="text-right font-bold text-emerald-800">৳ ${(Number(item.total_price) || 0).toFixed(2)}</td>
            <td class="text-center">
              <button onclick="App.openEditItemModal(${item.id})" class="p-1 text-teal-700 hover:bg-teal-100 rounded">✏️</button>
              <button onclick="App.deleteItem(${item.id})" class="p-1 text-red-600 hover:bg-red-100 rounded">🗑️</button>
            </td>
          </tr>
        `;
      });
    }

    tableBody.innerHTML = rows;
  },

  // Toggle View between Ledger and All Records Table
  toggleAllRecordsView() {
    if (this.state.viewMode === 'all-table') {
      this.state.viewMode = 'ledger';
    } else {
      this.state.viewMode = 'all-table';
    }
    this.render();
  },

  // Open Date Filter View
  openDateFilterView() {
    this.state.viewMode = 'date-filter';

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    // Default: 1st of current month to today
    if (!this.state.dateFilter.startDate) {
      this.state.dateFilter.startDate = `${yyyy}-${mm}-01`;
    }
    if (!this.state.dateFilter.endDate) {
      this.state.dateFilter.endDate = `${yyyy}-${mm}-${dd}`;
    }

    this.render();
    this.closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Apply quick date preset
  setDatePreset(preset) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    let start = '';
    let end = todayStr;

    if (preset === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (preset === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      start = past7.toISOString().slice(0, 10);
    } else if (preset === 'this_month') {
      start = `${yyyy}-${mm}-01`;
      end = todayStr;
    } else if (preset === 'last_month') {
      const prevMonth = new Date(yyyy, today.getMonth() - 1, 1);
      const prevMonthLast = new Date(yyyy, today.getMonth(), 0);
      start = prevMonth.toISOString().slice(0, 10);
      end = prevMonthLast.toISOString().slice(0, 10);
    } else if (preset === 'this_year') {
      start = `${yyyy}-01-01`;
      end = todayStr;
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    this.state.dateFilter.startDate = start;
    this.state.dateFilter.endDate = end;

    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;

    this.loadDateFilteredItems();
  },

  // Handle Date Filter Form Submit
  applyDateFilter(e) {
    if (e) e.preventDefault();
    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');
    const catSelect = document.getElementById('filter-category-select');

    this.state.dateFilter.startDate = startInput ? startInput.value : '';
    this.state.dateFilter.endDate = endInput ? endInput.value : '';
    this.state.dateFilter.categoryId = catSelect ? catSelect.value : '';

    this.loadDateFilteredItems();
  },

  resetDateFilter() {
    this.setDatePreset('this_month');
    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) catSelect.value = '';
    this.state.dateFilter.categoryId = '';
    this.loadDateFilteredItems();
  },

  // Fetch and render date-filtered items
  async loadDateFilteredItems() {
    const tableBody = document.getElementById('date-filter-table-body');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500 font-semibold">তথ্য লোড হচ্ছে...</td></tr>`;
    }

    const filters = {};
    if (this.state.dateFilter.startDate) filters.start_date = this.state.dateFilter.startDate;
    if (this.state.dateFilter.endDate) filters.end_date = this.state.dateFilter.endDate;
    if (this.state.dateFilter.categoryId) filters.category_id = this.state.dateFilter.categoryId;

    const items = await window.khatiyanDB.getItems(filters);
    this.state.dateFilter.items = items;

    this.populateDateFilterCategorySelect();
    this.renderDateFilterTable(items);
  },

  populateDateFilterCategorySelect() {
    const select = document.getElementById('filter-category-select');
    if (!select || select.children.length > 1) return;

    this.state.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon || '📦'} ${cat.name_bn || cat.name} (পৃষ্ঠা ${cat.page_number})`;
      select.appendChild(opt);
    });

    if (this.state.dateFilter.categoryId) {
      select.value = this.state.dateFilter.categoryId;
    }
  },

  // Render Date Filter Table & Stats
  renderDateFilterTable(items) {
    const tableBody = document.getElementById('date-filter-table-body');
    const countEl = document.getElementById('date-filter-count');
    const totalEl = document.getElementById('date-filter-total');
    const vouchersEl = document.getElementById('date-filter-vouchers');
    const footerTotalEl = document.getElementById('date-filter-footer-total');
    const badgeLabel = document.getElementById('date-filter-active-range-label');

    const totalCost = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const uniqueVouchers = new Set(items.map(i => i.voucher_no).filter(Boolean)).size;

    if (countEl) countEl.textContent = `${items.length} টি`;
    if (totalEl) totalEl.textContent = '৳ ' + totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (vouchersEl) vouchersEl.textContent = `${uniqueVouchers} টি`;
    if (footerTotalEl) footerTotalEl.textContent = '৳ ' + totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const s = this.state.dateFilter.startDate;
    const e = this.state.dateFilter.endDate;
    if (badgeLabel) {
      if (s && e) {
        badgeLabel.textContent = `${PrintManager.formatDate(s)} হতে ${PrintManager.formatDate(e)}`;
      } else if (s) {
        badgeLabel.textContent = `${PrintManager.formatDate(s)} হতে পরবর্তী`;
      } else if (e) {
        badgeLabel.textContent = `${PrintManager.formatDate(e)} পর্যন্ত`;
      } else {
        badgeLabel.textContent = 'সকল তারিখ';
      }
    }

    if (!tableBody) return;

    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-12 text-slate-500">
            <span class="text-3xl block mb-2">📭</span>
            উক্ত তারিখের মধ্যে কোনো মালামাল ক্রয়ের এন্ট্রি পাওয়া যায়নি।
          </td>
        </tr>
      `;
      return;
    }

    let rows = '';
    items.forEach((item, idx) => {
      const specText = item.specification ? ` <span class="text-xs text-slate-500 font-normal">(${item.specification})</span>` : '';
      const supplierPart = item.supplier ? `<strong class="text-slate-800">${item.supplier}</strong>` : '';
      const remarksPart = item.remarks ? `<span class="text-slate-500">${item.supplier ? ' - ' : ''}${item.remarks}</span>` : '';
      const supplierRemarks = (supplierPart || remarksPart) ? `<div class="text-2xs text-slate-500 mt-0.5">${supplierPart}${remarksPart}</div>` : '';

      rows += `
        <tr class="hover:bg-teal-50/50 transition">
          <td class="nowrap-cell text-center font-bold text-slate-600">${idx + 1}</td>
          <td class="nowrap-cell text-center">
            <button onclick="App.goToPage(${item.page_number})" class="page-badge cursor-pointer" title="পৃষ্ঠা ${item.page_number} এ যান">
              পৃষ্ঠা ${item.page_number}
            </button>
          </td>
          <td class="nowrap-cell text-center font-semibold text-slate-700">
            ${PrintManager.formatDate(item.entry_date)}
          </td>
          <td class="text-xs sm:text-sm font-bold text-teal-900">
            ${item.category_name_bn || item.category_name || '-'}
          </td>
          <td class="text-xs sm:text-sm leading-tight">
            <span class="font-bold text-slate-900">${item.item_name}</span>${specText}
            ${supplierRemarks}
          </td>
          <td class="nowrap-cell text-center font-semibold text-slate-700 text-xs">
            ${item.voucher_no || '-'}
          </td>
          <td class="nowrap-cell text-center font-bold text-slate-800 text-xs">
            ${item.quantity} ${item.unit || ''}
          </td>
          <td class="nowrap-cell text-right font-medium text-slate-700 text-xs">
            ৳ ${(Number(item.unit_price) || 0).toFixed(2)}
          </td>
          <td class="nowrap-cell text-right font-extrabold text-teal-900 text-xs sm:text-sm">
            ৳ ${(Number(item.total_price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
          <td class="nowrap-cell text-center space-x-1">
            <button onclick="App.openEditItemModal(${item.id})" class="px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded border border-amber-300 transition cursor-pointer" title="সম্পাদনা">
              ✏️
            </button>
            <button onclick="App.deleteItem(${item.id})" class="px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded border border-red-300 transition cursor-pointer" title="মুছে ফেলুন">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = rows;
  },

  // Print Date Filter Report
  printDateFilterReport() {
    const items = this.state.dateFilter.items || [];
    const s = this.state.dateFilter.startDate;
    const e = this.state.dateFilter.endDate;
    const catSelect = document.getElementById('filter-category-select');
    const catName = (catSelect && catSelect.selectedIndex > 0) ? catSelect.options[catSelect.selectedIndex].text : '';
    PrintManager.printDateRangeReport(items, s, e, catName);
  },

  // Export Date Filter CSV
  exportDateFilterExcel() {
    const items = this.state.dateFilter.items || [];
    if (items.length === 0) {
      this.showToast('⚠️ এক্সপোর্ট করার মতো কোনো মালামাল নেই');
      return;
    }
    PrintManager.exportCsv(items);
  },

  // Clear Search Input and return to ledger view
  clearSearch() {
    this.state.searchQuery = '';
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    this.state.viewMode = 'ledger';
    this.render();
  },

  // Restore saved desktop sidebar state
  initSidebarState() {
    if (window.innerWidth >= 1024) {
      const isHidden = localStorage.getItem('sidebar_hidden_desktop') === 'true';
      const sidebar = document.getElementById('app-sidebar');
      if (sidebar && isHidden) {
        sidebar.classList.add('sidebar-hidden-desktop');
      }
    }
  },

  // Home Button Action - Return to Page 1 (সূচিপত্র) & Reset all views
  goHome() {
    this.clearSearch();
    this.goToPage(1);
    this.closeSidebar();
  },

  // Sidebar Controls (Mobile Drawer & Desktop Hide/Unhide)
  toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    if (window.innerWidth >= 1024) {
      // Desktop: Hide/Unhide sidebar
      const isHidden = sidebar.classList.toggle('sidebar-hidden-desktop');
      localStorage.setItem('sidebar_hidden_desktop', isHidden ? 'true' : 'false');
    } else {
      // Mobile: Drawer open/close
      const isOpen = sidebar.classList.contains('sidebar-open-mobile');
      if (isOpen) {
        this.closeSidebar();
      } else {
        this.openSidebar();
      }
    }
  },

  openSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (window.innerWidth >= 1024) {
      if (sidebar) {
        sidebar.classList.remove('sidebar-hidden-desktop');
        localStorage.setItem('sidebar_hidden_desktop', 'false');
      }
    } else {
      if (sidebar) sidebar.classList.add('sidebar-open-mobile');
      if (backdrop) backdrop.classList.remove('hidden');
    }
  },

  closeSidebar(forceDesktop = false) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (window.innerWidth >= 1024) {
      if (forceDesktop && sidebar) {
        sidebar.classList.add('sidebar-hidden-desktop');
        localStorage.setItem('sidebar_hidden_desktop', 'true');
      }
    } else {
      if (sidebar) sidebar.classList.remove('sidebar-open-mobile');
      if (backdrop) backdrop.classList.add('hidden');
    }
  },

  // Modal Handlers
  openNewEntryModal(categoryId = null, pageNumber = null) {
    this.state.editingItemId = null;
    document.getElementById('modal-entry-title').textContent = '➕ নতুন মালামাল ক্রয় এন্ট্রি';
    document.getElementById('form-entry').reset();

    // Set Date to Today
    document.getElementById('entry-date').value = new Date().toISOString().slice(0, 10);

    // Populate Category Dropdown
    this.populateCategorySelect(categoryId);

    // Set Page Number
    const pageInput = document.getElementById('entry-page-num');
    if (pageNumber) {
      pageInput.value = pageNumber;
    } else if (this.state.currentPage > 1) {
      pageInput.value = this.state.currentPage;
    } else if (categoryId) {
      const cat = this.state.categories.find(c => c.id == categoryId);
      if (cat) pageInput.value = cat.page_number;
    } else {
      pageInput.value = 5;
    }

    this.calculateModalTotal();
    document.getElementById('modal-entry').classList.remove('hidden');
  },

  populateCategorySelect(selectedId = null) {
    const select = document.getElementById('entry-category-select');
    if (!select) return;

    let options = '<option value="">-- মাদার ক্যাটাগরি নির্বাচন করুন --</option>';
    this.state.categories.forEach(cat => {
      const sel = (selectedId && cat.id == selectedId) ? 'selected' : '';
      options += `<option value="${cat.id}" data-page="${cat.page_number}" ${sel}>${cat.icon || '📦'} ${cat.name_bn || cat.name} (পৃষ্ঠা ${cat.page_number})</option>`;
    });
    select.innerHTML = options;

    // Listen for category selection change to auto-update page number
    select.onchange = (e) => {
      const chosen = select.options[select.selectedIndex];
      const assignedPage = chosen.getAttribute('data-page');
      if (assignedPage) {
        document.getElementById('entry-page-num').value = assignedPage;
      }
    };
  },

  quickSetItem(name, spec, unit, rate) {
    document.getElementById('entry-item-name').value = name;
    if (spec) document.getElementById('entry-spec').value = spec;
    if (unit) document.getElementById('entry-unit').value = unit;
    if (rate) document.getElementById('entry-unit-price').value = rate;
    this.calculateModalTotal();
  },

  calculateModalTotal() {
    const qty = parseFloat(document.getElementById('entry-qty').value) || 0;
    const rate = parseFloat(document.getElementById('entry-unit-price').value) || 0;
    const total = qty * rate;
    document.getElementById('entry-total-price').value = total.toFixed(2);
    document.getElementById('display-total-price').textContent = '৳ ' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  },

  async handleSaveEntry(e) {
    e.preventDefault();

    const categoryId = document.getElementById('entry-category-select').value;
    const pageNum = parseInt(document.getElementById('entry-page-num').value, 10);
    const itemName = document.getElementById('entry-item-name').value.trim();
    const entryDate = document.getElementById('entry-date').value;
    const spec = document.getElementById('entry-spec').value.trim();
    const voucher = document.getElementById('entry-voucher').value.trim();
    const qty = parseFloat(document.getElementById('entry-qty').value) || 1;
    const unit = document.getElementById('entry-unit').value.trim() || 'পিস';
    const rate = parseFloat(document.getElementById('entry-unit-price').value) || 0;
    const total = parseFloat(document.getElementById('entry-total-price').value) || (qty * rate);
    const supplier = document.getElementById('entry-supplier').value.trim();
    const remarks = document.getElementById('entry-remarks').value.trim();

    if (!itemName) {
      alert('অনুগ্রহ করে পণ্যের নাম বা বিবরণ প্রদান করুন');
      return;
    }

    const payload = {
      category_id: categoryId ? parseInt(categoryId, 10) : 1,
      page_number: pageNum || 5,
      entry_date: entryDate,
      item_name: itemName,
      specification: spec,
      voucher_no: voucher,
      quantity: qty,
      unit: unit,
      unit_price: rate,
      total_price: total,
      supplier: supplier,
      remarks: remarks
    };

    if (this.state.editingItemId) {
      await window.khatiyanDB.updateItem(this.state.editingItemId, payload);
      this.showToast('✅ মালামাল এন্ট্রি সফলভাবে আপডেট হয়েছে!');
    } else {
      await window.khatiyanDB.addItem(payload);
      this.showToast('✅ নতুন মালামাল সফলভাবে রেজিস্টার খাতায় যুক্ত হয়েছে!');
    }

    this.closeModal('modal-entry');
    await this.loadInitialData();
    if (this.state.viewMode === 'date-filter') {
      this.loadDateFilteredItems();
    } else {
      // Navigate straight to the saved page
      this.goToPage(payload.page_number);
    }
  },

  async openEditItemModal(itemId) {
    const items = await window.khatiyanDB.getItems();
    const item = items.find(i => i.id == itemId);
    if (!item) return;

    this.state.editingItemId = itemId;
    document.getElementById('modal-entry-title').textContent = '✏️ মালামাল এন্ট্রি সম্পাদনা';

    this.populateCategorySelect(item.category_id);
    document.getElementById('entry-page-num').value = item.page_number;
    document.getElementById('entry-date').value = item.entry_date;
    document.getElementById('entry-item-name').value = item.item_name;
    document.getElementById('entry-spec').value = item.specification || '';
    document.getElementById('entry-voucher').value = item.voucher_no || '';
    document.getElementById('entry-qty').value = item.quantity;
    document.getElementById('entry-unit').value = item.unit || 'পিস';
    document.getElementById('entry-unit-price').value = item.unit_price;
    document.getElementById('entry-supplier').value = item.supplier || '';
    document.getElementById('entry-remarks').value = item.remarks || '';

    this.calculateModalTotal();
    document.getElementById('modal-entry').classList.remove('hidden');
  },

  async deleteItem(itemId) {
    if (confirm('আপনি কি নিশ্চিত যে এই এন্ট্রিটি খাতা থেকে মুছে ফেলতে চান?')) {
      await window.khatiyanDB.deleteItem(itemId);
      this.showToast('🗑️ এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে');
      await this.loadInitialData();
      if (this.state.viewMode === 'date-filter') {
        this.loadDateFilteredItems();
      } else if (this.state.viewMode === 'all-table') {
        this.renderAllRecordsTable();
      } else {
        this.goToPage(this.state.currentPage);
      }
    }
  },

  // Category Modal Handlers
  openCategoryModal(catId = null) {
    this.state.editingCategoryId = catId;
    const modalTitle = document.getElementById('modal-cat-title');
    const form = document.getElementById('form-category');
    form.reset();

    if (catId) {
      const cat = this.state.categories.find(c => c.id == catId);
      if (cat) {
        modalTitle.textContent = '✏️ মাদার ক্যাটাগরি সম্পাদনা';
        document.getElementById('cat-name-bn').value = cat.name_bn || '';
        document.getElementById('cat-name-en').value = cat.name || '';
        document.getElementById('cat-page-num').value = cat.page_number || 1;
        document.getElementById('cat-page-end').value = cat.page_end || cat.page_number || 1;
        document.getElementById('cat-desc').value = cat.description || '';
        document.getElementById('cat-icon').value = cat.icon || '📦';
        document.getElementById('cat-delete-btn').classList.remove('hidden');
      }
    } else {
      modalTitle.textContent = '➕ নতুন মাদার ক্যাটাগরি তৈরি';
      document.getElementById('cat-page-num').value = Math.min(250, (this.state.categories.length * 20) + 5);
      document.getElementById('cat-page-end').value = Math.min(250, (this.state.categories.length * 20) + 24);
      document.getElementById('cat-delete-btn').classList.add('hidden');
    }

    document.getElementById('modal-category').classList.remove('hidden');
  },

  async handleSaveCategory(e) {
    e.preventDefault();

    const nameBn = document.getElementById('cat-name-bn').value.trim();
    const nameEn = document.getElementById('cat-name-en').value.trim();
    const pageNum = parseInt(document.getElementById('cat-page-num').value, 10) || 1;
    const pageEnd = parseInt(document.getElementById('cat-page-end').value, 10) || pageNum;
    const desc = document.getElementById('cat-desc').value.trim();
    const icon = document.getElementById('cat-icon').value.trim() || '📦';

    if (!nameBn && !nameEn) {
      alert('অনুগ্রহ করে ক্যাটাগরির নাম দিন');
      return;
    }

    const payload = {
      name: nameEn || nameBn,
      name_bn: nameBn || nameEn,
      page_number: pageNum,
      page_end: pageEnd,
      description: desc,
      icon: icon
    };

    if (this.state.editingCategoryId) {
      await window.khatiyanDB.updateCategory(this.state.editingCategoryId, payload);
      this.showToast('✅ ক্যাটাগরি সফলভাবে আপডেট হয়েছে!');
    } else {
      await window.khatiyanDB.addCategory(payload);
      this.showToast('✅ নতুন মাদার ক্যাটাগরি তৈরি হয়েছে!');
    }

    this.closeModal('modal-category');
    await this.loadInitialData();
    this.goToPage(1); // Return to index page
  },

  async handleDeleteCategory() {
    if (!this.state.editingCategoryId) return;
    if (confirm('সতর্কতা: এই মাদার ক্যাটাগরি মুছে ফেললে এর আওতাধীন সকল এন্ট্রিও মুছে যাবে! আপনি কি মুছে ফেলতে চান?')) {
      await window.khatiyanDB.deleteCategory(this.state.editingCategoryId);
      this.showToast('🗑️ ক্যাটাগরি মুছে ফেলা হয়েছে');
      this.closeModal('modal-category');
      await this.loadInitialData();
      this.goToPage(1);
    }
  },

  // Mobile Connect & QR Code Modal
  async openMobileConnectModal() {
    const netInfo = await window.khatiyanDB.getNetworkInfo();
    const modal = document.getElementById('modal-mobile-connect');
    const qrContainer = document.getElementById('qr-code-image');
    const urlText = document.getElementById('mobile-url-text');
    const localUrlText = document.getElementById('local-url-text');

    if (netInfo && netInfo.qr_code_base64) {
      qrContainer.src = netInfo.qr_code_base64;
      urlText.textContent = netInfo.mobile_url;
      urlText.href = netInfo.mobile_url;
      if (localUrlText) localUrlText.textContent = netInfo.local_url;
    } else {
      urlText.textContent = window.location.origin;
      urlText.href = window.location.origin;
    }

    modal.classList.remove('hidden');
  },

  copyMobileUrl() {
    const urlText = document.getElementById('mobile-url-text').textContent;
    navigator.clipboard.writeText(urlText).then(() => {
      this.showToast('📋 মোবাইল লিংক কপি করা হয়েছে!');
    });
  },

  // Backup & Restore
  openBackupModal() {
    document.getElementById('modal-backup').classList.remove('hidden');
  },

  async downloadJsonBackup() {
    const cats = await window.khatiyanDB.getAllFromStore('categories');
    const items = await window.khatiyanDB.getAllFromStore('items');

    const backupData = {
      app: 'ডিজিটাল খতিয়ান - মালামাল ক্রয় রেজিস্টার খাতা',
      version: '1.0',
      export_time: new Date().toISOString(),
      categories: cats,
      items: items
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `khatiyan_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    this.showToast('💾 ব্যাকআপ ফাইল ডাউনলোড সম্পন্ন হয়েছে');
  },

  handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.categories || !data.items) {
          alert('ভুল ফরম্যাটের ব্যাকআপ ফাইল');
          return;
        }

        // Restore to DB
        if (window.khatiyanDB.serverOnline) {
          await fetch('/api/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        // Restore to IndexedDB
        for (const cat of data.categories) {
          await window.khatiyanDB.putToStore('categories', cat);
        }
        for (const item of data.items) {
          await window.khatiyanDB.putToStore('items', item);
        }

        this.showToast('✅ ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!');
        this.closeModal('modal-backup');
        await this.loadInitialData();
        this.goToPage(1);
      } catch (err) {
        alert('ফাইল পড়তে ত্রুটি হয়েছে: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  async exportExcel() {
    const items = await window.khatiyanDB.getItems();
    PrintManager.exportCsv(items);
    this.showToast('📊 এক্সেল ফাইল ডাউনলোড হয়েছে');
  },

  // Print Handlers
  async printCurrentView() {
    if (this.state.viewMode === 'date-filter') {
      this.printDateFilterReport();
    } else if (this.state.viewMode === 'all-table') {
      const items = await window.khatiyanDB.getItems({ search: this.state.searchQuery });
      PrintManager.printAllRecords(items, this.state.searchQuery);
    } else if (this.state.currentPage === 1) {
      PrintManager.printMasterIndex(this.state.categories);
    } else {
      PrintManager.printCurrentPage(
        this.state.currentPage,
        this.state.pageData.category,
        this.state.pageData.items
      );
    }
  },

  printMasterIndex() {
    PrintManager.printMasterIndex(this.state.categories);
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'bg-teal-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-semibold transform transition-all duration-300 translate-y-4 opacity-0 border border-teal-700';
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Populate Dropdown for 250 Pages with Mother Categories clearly labeled
  populatePageSelector() {
    const pageSelect = document.getElementById('top-page-selector');
    if (!pageSelect) return;

    const catPageMap = {};
    (this.state.categories || []).forEach(cat => {
      catPageMap[cat.page_number] = cat;
    });

    let optHtml = '';
    
    // Group 1: Master Index
    optHtml += `<option value="1" style="background:#f0fdfa; color:#0f766e; font-weight:bold;">📖 ১ম পৃষ্ঠা: সূচিপত্র (Master Index)</option>`;

    // Group 2: Key Mother Categories
    if (this.state.categories && this.state.categories.length > 0) {
      optHtml += `<optgroup label="─── মাদার ক্যাটাগরি খাতা পৃষ্ঠা ───" style="background:#e6fffa; color:#0d9488; font-weight:800;">`;
      this.state.categories.forEach(cat => {
        const pageRange = (cat.page_end && cat.page_end !== cat.page_number)
          ? `পৃষ্ঠা ${cat.page_number}-${cat.page_end}`
          : `পৃষ্ঠা ${cat.page_number}`;
        optHtml += `<option value="${cat.page_number}" style="color:#0f172a; font-weight:700;">★ ${pageRange} — ${cat.icon || '📦'} ${cat.name_bn || cat.name}</option>`;
      });
      optHtml += `</optgroup>`;
    }

    // Group 3: All 250 Pages
    optHtml += `<optgroup label="─── সকল পৃষ্ঠা (১ থেকে ২৫০) ───" style="background:#f8fafc; color:#475569; font-weight:700;">`;
    for (let p = 2; p <= this.state.totalPages; p++) {
      const cat = catPageMap[p];
      if (cat) {
        optHtml += `<option value="${p}" style="color:#0f172a; font-weight:700;">পৃষ্ঠা নং ${p} (${cat.name_bn || cat.name})</option>`;
      } else {
        optHtml += `<option value="${p}" style="color:#334155;">পৃষ্ঠা নং ${p}</option>`;
      }
    }
    optHtml += `</optgroup>`;

    pageSelect.innerHTML = optHtml;
    pageSelect.value = this.state.currentPage;
  },

  // Bind Event Listeners
  bindEvents() {
    this.populatePageSelector();

    const pageSelect = document.getElementById('top-page-selector');
    if (pageSelect) {
      pageSelect.addEventListener('change', (e) => {
        this.goToPage(parseInt(e.target.value, 10));
      });
    }

    // Live Search
    const searchInput = document.getElementById('global-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value.trim();
        if (clearBtn) {
          if (this.state.searchQuery.length > 0) {
            clearBtn.classList.remove('hidden');
          } else {
            clearBtn.classList.add('hidden');
          }
        }
        if (this.state.searchQuery.length > 0) {
          this.state.viewMode = 'all-table';
        } else {
          this.state.viewMode = 'ledger';
        }
        this.render();
      });
    }

    // Modal forms
    document.getElementById('form-entry')?.addEventListener('submit', (e) => this.handleSaveEntry(e));
    document.getElementById('form-category')?.addEventListener('submit', (e) => this.handleSaveCategory(e));
    document.getElementById('cat-delete-btn')?.addEventListener('click', () => this.handleDeleteCategory());
    document.getElementById('restore-file-input')?.addEventListener('change', (e) => this.handleRestoreFile(e));

    // Keyboard Shortcuts: Left / Right arrows to flip pages
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') this.nextPage();
      if (e.key === 'ArrowLeft') this.prevPage();
    });
  }
};

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

