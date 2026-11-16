/**
 * ডিজিটাল খতিয়ান - প্রিন্ট ও এক্সপোর্ট হ্যান্ডলার
 * Generates official register page printouts & Excel downloads
 */

const PrintManager = {
  // Convert number to Bengali numeral string
  toBnNum(num) {
    if (num === null || num === undefined || num === '') return '';
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
  },

  // Format date to DD/MM/YYYY
  formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  },

  // Format currency
  formatCurrency(amount) {
    const num = Number(amount) || 0;
    return '৳ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // Trigger Print of Current Ledger Page
  printCurrentPage(pageNumber, category, items) {
    const printArea = document.getElementById('printable-area');
    if (!printArea) return;

    const catName = category ? `${category.name_bn || category.name} (${category.name})` : 'সাধারণ হিসাব';
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);

    let rowsHtml = '';
    items.forEach((item, idx) => {
      rowsHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">${this.formatDate(item.entry_date)}</td>
          <td><strong>${item.item_name}</strong>${item.specification ? `<br><small style="color:#555;">${item.specification}</small>` : ''}</td>
          <td style="text-align: center;">${item.voucher_no || '-'}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: center;">${item.unit || 'পিস'}</td>
          <td style="text-align: right;">৳ ${(Number(item.unit_price) || 0).toFixed(2)}</td>
          <td style="text-align: right;"><strong>৳ ${(Number(item.total_price) || 0).toFixed(2)}</strong></td>
          <td>${item.supplier ? `দোকান: ${item.supplier}<br>` : ''}${item.remarks || '-'}</td>
        </tr>
      `;
    });

    // Fill blank ledger lines if items < 12 to look like a real page
    const emptyRowsNeeded = Math.max(0, 12 - items.length);
    for (let i = 0; i < emptyRowsNeeded; i++) {
      rowsHtml += `
        <tr class="empty-print-row">
          <td style="text-align: center; color: #aaa;">${items.length + i + 1}</td>
          <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `;
    }

    printArea.innerHTML = `
      <div class="print-header">
        <h1>মালামাল ক্রয় ও মজুত রেজিস্টার খাতা</h1>
        <h2>মাদার আইটেম / হিসাবের নাম: ${catName}</h2>
        <div class="print-meta-grid">
          <div><strong>খাতা পৃষ্ঠা নং: ${pageNumber}</strong> / ২৫০</div>
          <div><strong>মোট মালামাল:</strong> ${items.length} টি</div>
          <div><strong>প্রিন্টের তারিখ:</strong> ${new Date().toLocaleDateString('bn-BD')}</div>
        </div>
      </div>

      <table class="table-ledger">
        <thead>
          <tr>
            <th style="width: 5%;">ক্র: নং</th>
            <th style="width: 11%;">ক্রয়ের তারিখ</th>
            <th style="width: 25%;">মালের বিবরণ ও স্পেসিফিকেশন</th>
            <th style="width: 10%;">ভাউচার নং</th>
            <th style="width: 7%;">পরিমাণ</th>
            <th style="width: 6%;">একক</th>
            <th style="width: 10%;">দর (টাকা)</th>
            <th style="width: 12%;">মোট টাকা (৳)</th>
            <th style="width: 14%;">সরবরাহকারী ও মন্তব্য</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2pt solid #000;">
            <td colspan="7" style="text-align: right; padding-right: 12px;">পৃষ্ঠার মোট সর্বমোট খরচ (Page Total):</td>
            <td style="text-align: right; font-size: 11pt; color: #000;">${this.formatCurrency(totalAmount)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div class="print-signature-area">
        <div class="signature-block">
          প্রস্তুতকারী / স্টোরকিপার
        </div>
        <div class="signature-block">
          হিসাব রক্ষণ কর্মকর্তা
        </div>
        <div class="signature-block">
          অনুমোদনকারী কর্মকর্তা
        </div>
      </div>
    `;

    window.print();
  },

  // Trigger Print of Master Index (Page 1)
  printMasterIndex(categories) {
    const printArea = document.getElementById('printable-area');
    if (!printArea) return;

    const totalCats = categories.length;
    const grandCost = categories.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);
    const grandItems = categories.reduce((sum, c) => sum + (Number(c.item_count) || 0), 0);

    let rowsHtml = '';
    categories.forEach((cat, idx) => {
      const pageRange = cat.page_end && cat.page_end !== cat.page_number 
        ? `পৃষ্ঠা ${cat.page_number} - ${cat.page_end}` 
        : `পৃষ্ঠা ${cat.page_number}`;

      rowsHtml += `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong>${cat.name_bn}</strong><br><small style="color: #555;">${cat.name}</small></td>
          <td>${cat.description || '-'}</td>
          <td style="text-align: center; font-weight: bold; font-size: 11pt;">${pageRange}</td>
          <td style="text-align: center;">${cat.item_count || 0} টি</td>
          <td style="text-align: right; font-weight: bold;">${this.formatCurrency(cat.total_amount || 0)}</td>
        </tr>
      `;
    });

    printArea.innerHTML = `
      <div class="print-header">
        <h1>রেজিস্টার খাতা সূচিপত্র (Master Index)</h1>
        <h2>১ম পৃষ্ঠা - মাদার আইটেম ও পৃষ্ঠা নম্বরের তালিকা</h2>
        <div class="print-meta-grid">
          <div><strong>মোট পৃষ্ঠা ধারণক্ষমতা:</strong> ২৫০ পৃষ্ঠা</div>
          <div><strong>মোট মাদার ক্যাটাগরি:</strong> ${totalCats} টি</div>
          <div><strong>মোট মালামাল:</strong> ${grandItems} টি</div>
          <div><strong>সর্বমোট ব্যয়:</strong> ${this.formatCurrency(grandCost)}</div>
        </div>
      </div>

      <table class="table-ledger">
        <thead>
          <tr>
            <th style="width: 6%;">ক্র: নং</th>
            <th style="width: 25%;">মাদার আইটেম / হিসাবের নাম</th>
            <th style="width: 33%;">পণ্যের বিবরণ ও ধরন</th>
            <th style="width: 14%;">বরাদ্দকৃত পৃষ্ঠা নং</th>
            <th style="width: 10%;">মোট এন্ট্রি</th>
            <th style="width: 12%;">মোট খরচ (৳)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2pt solid #000;">
            <td colspan="4" style="text-align: right; padding-right: 12px;">সর্বমোট যোগফল:</td>
            <td style="text-align: center;">${grandItems} টি</td>
            <td style="text-align: right;">${this.formatCurrency(grandCost)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="print-signature-area" style="margin-top: 50px;">
        <div class="signature-block">
          খাতাপত্র নিরীক্ষক
        </div>
        <div class="signature-block">
          হিসাব বিভাগ প্রধান
        </div>
        <div class="signature-block">
          উর্ধ্বতন কর্তৃপক্ষ
        </div>
      </div>
    `;

    window.print();
  },

  // Client-side Excel CSV Download with UTF-8 BOM
  exportCsv(items) {
    let csvContent = '\ufeff'; // UTF-8 BOM
    csvContent += 'ক্রমিক নং,পৃষ্ঠা নং,মাদার ক্যাটাগরি,তারিখ,মালের বিবরণ / নাম,স্পেসিফিকেশন,ভাউচার / মেমো নং,পরিমাণ,একক,দর (টাকা),মোট টাকা,সরবরাহকারী / দোকান,মন্তব্য\n';

    items.forEach((item, idx) => {
      const row = [
        idx + 1,
        item.page_number || '',
        `"${(item.category_name_bn || item.category_name || '').replace(/"/g, '""')}"`,
        item.entry_date || '',
        `"${(item.item_name || '').replace(/"/g, '""')}"`,
        `"${(item.specification || '').replace(/"/g, '""')}"`,
        `"${(item.voucher_no || '').replace(/"/g, '""')}"`,
        item.quantity || 0,
        `"${(item.unit || '').replace(/"/g, '""')}"`,
        item.unit_price || 0,
        item.total_price || 0,
        `"${(item.supplier || '').replace(/"/g, '""')}"`,
        `"${(item.remarks || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Register_Khatiyan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.PrintManager = PrintManager;

