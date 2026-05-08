/**
 * PiptiPipti - UI Updates
 * Functions for updating the user interface
 */

/**
 * Refreshes all Today view UI elements
 */
function refreshTodayUI() {
  const d = getTodayData();
  
  // Update totals display
  document.getElementById('today-total').textContent = `₱${d.total}`;
  document.getElementById('today-old').textContent = d.old;
  document.getElementById('today-new').textContent = d.new;
  document.getElementById('today-scans').textContent = d.scans;
  
  // Update scan log
  refreshScanLog(d.log);
  
  // Update sidebar week summary
  refreshSidebarWeek();
  
  // Update undo button state (only enabled if last scan exists)
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.disabled = !lastScanBackup;
  }
}

/**
 * Refreshes the scan log list
 * @param {Array} log - Array of scan log entries
 */
function refreshScanLog(log) {
  const el = document.getElementById('scanList');
  
  if (!log || log.length === 0) {
    el.innerHTML = '<div class="empty-state">No scans yet today</div>';
    return;
  }
  
  el.innerHTML = [...log].reverse().map(item => {
    const dotClass = item.old > 0 && item.new === 0 ? 'old' : 
                     item.new > 0 && item.old === 0 ? 'new' : '';
    return `
      <div class="scan-item">
        <div class="scan-item-left">
          <div class="scan-dot ${dotClass}"></div>
          <div>
            <div class="scan-item-desc">${item.desc}</div>
            <div class="scan-item-time">${item.time} · ${item.type === 'manual' ? 'Manual' : 'Scanned'}</div>
          </div>
        </div>
        <div class="scan-item-amount">₱${item.amount}</div>
      </div>
    `;
  }).join('');
}

/**
 * Refreshes the sidebar week summary
 */
function refreshSidebarWeek() {
  const data = loadData();
  const s = getWeekStats(data.currentWeek);
  
  document.getElementById('sb-week-total').textContent = `₱${s.total}`;
  document.getElementById('sb-week-sub').textContent = `${s.old + s.new} bills counted`;
  document.getElementById('sb-old-tag').textContent = `${s.old} Old`;
  document.getElementById('sb-new-tag').textContent = `${s.new} New`;
}

/**
 * Shows a result message in the result box
 * @param {string} type - Result type ('success', 'warning', 'error')
 * @param {string} main - Main message text
 * @param {string} sub - Secondary message text
 * @param {Array} tags - HTML strings for tags
 */
function showResult(type, main, sub, tags) {
  const box = document.getElementById('resultBox');
  box.className = `result-box ${type}`;
  box.style.display = 'block';
  document.getElementById('resultMain').textContent = main;
  document.getElementById('resultSub').textContent = sub;
  document.getElementById('resultTags').innerHTML = tags.join('');
}

/**
 * Generates a unique receipt ID based on date and time
 */
function generateReceiptId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-5);
  return `${dateStr}-${timeStr}`;
}

/**
 * Generates a hash string for the receipt (low opacity identifier)
 */
function generateReceiptHash() {
  const now = new Date();
  const hash = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  return hash.toUpperCase().substring(0, 16);
}

/**
 * Generates the report HTML
 */
function generateReportHTML() {
  const d = getTodayData();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const receiptId = generateReceiptId();
  const receiptHash = generateReceiptHash();

  const lines = d.log.map(item =>
    `<tr><td style="padding:6px 0;color:#555;">${item.time}</td><td style="padding:6px 8px;">${item.desc}</td><td style="padding:6px 0;text-align:right;font-weight:600;">₱${item.amount}</td></tr>`
  ).join('');

  const html = `
    <div style="position:relative;font-family:'DM Sans','DM Mono',sans-serif;font-size:14px;color:#000;max-width:360px;margin:0 auto;padding:24px 20px;">
      <div style="text-align:center;margin-bottom:20px;">
        <img src="assets/logo-piptipipti.png" alt="PiptiPipti" style="height:100px;width:auto;margin-bottom:12px;"/>
        <div style="font-size:12px;color:#999;letter-spacing:1px;">₱50 BILL COUNTER</div>
      </div>
      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;margin-bottom:14px;text-align:center;font-size:12px;color:#666;">
        <div>${dateStr}</div>
        <div>Generated: ${timeStr}</div>
        <div style="margin-top:6px;font-family:'DM Mono',monospace;font-size:10px;">ID: ${receiptId}</div>
        ${d.note ? `<div style="margin-top:8px;font-style:italic;color:#555;font-size:11px;">Note: ${d.note}</div>` : ''}
      </div>
      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:10px 0;margin-bottom:14px;">
        <table style="width:100%;border-collapse:collapse;">
          ${lines || '<tr><td colspan="3" style="padding:10px 0;color:#ccc;text-align:center;font-size:12px;">No entries</td></tr>'}
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;">
        <span>Old Bills (₱50)</span><span>${d.old} × ₱50 = ₱${d.old * 50}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:12px;">
        <span>New Bills (₱50)</span><span>${d.new} × ₱50 = ₱${d.new * 50}</span>
      </div>
      <div style="border-top:2px solid #000;padding-top:12px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;">
        <span>TOTAL</span><span>₱${d.total}</span>
      </div>
      <div style="text-align:center;margin-top:18px;font-size:9px;color:#ddd;font-family:'DM Mono',monospace;position:relative;padding-bottom:4px;">
        ${receiptHash}
      </div>
    </div>
  `;
  
  return html;
}

/**
 * Prints today's report
 */
function printReport() {
  const html = generateReportHTML();
  const reportEl = document.getElementById('print-receipt');
  reportEl.innerHTML = html;
  window.print();
}

/**
 * Downloads today's report as an image
 */
function downloadReportImage() {
  const html = generateReportHTML();
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.backgroundColor = '#fff';
  container.style.width = '360px';
  container.style.padding = '0';
  container.style.margin = '0';
  document.body.appendChild(container);

  // Wait for image to load before converting to canvas
  const imgs = container.querySelectorAll('img');
  let loadedCount = 0;
  
  const finishDownload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = container.offsetHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Use html2canvas if available
    if (typeof html2canvas !== 'undefined') {
      html2canvas(container, { scale: 2, useCORS: true, logging: false }).then(canvas => {
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        link.href = canvas.toDataURL('image/png');
        link.download = `bill-report-${dateStr}.png`;
        link.click();
        document.body.removeChild(container);
      }).catch(() => {
        // Fallback to printing if html2canvas fails
        const reportEl = document.getElementById('print-receipt');
        reportEl.innerHTML = html;
        window.print();
        document.body.removeChild(container);
      });
    } else {
      // If no html2canvas, use print dialog as fallback
      const reportEl = document.getElementById('print-receipt');
      reportEl.innerHTML = html;
      window.print();
      document.body.removeChild(container);
    }
  };

  if (imgs.length === 0) {
    finishDownload();
  } else {
    imgs.forEach(img => {
      img.onload = () => {
        loadedCount++;
        if (loadedCount === imgs.length) {
          finishDownload();
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === imgs.length) {
          finishDownload();
        }
      };
      img.style.maxWidth = '100%';
      img.style.display = 'block';
    });
  }
}
