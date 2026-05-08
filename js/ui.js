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
 * Generates and shows the print receipt
 */
function printReceipt() {
  const d = getTodayData();
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const lines = d.log.map(item =>
    `<tr><td style="padding:4px 0;color:#555;">${item.time}</td><td style="padding:4px 8px;">${item.desc}</td><td style="padding:4px 0;text-align:right;font-weight:600;">₱${item.amount}</td></tr>`
  ).join('');

  const html = `
    <div style="font-family:'DM Mono',monospace;font-size:12px;color:#000;max-width:320px;margin:0 auto;padding:20px;">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.5px;">PiptiPipti</div>
        <div style="font-size:10px;color:#555;margin-top:2px;">₱50 Bill Count Receipt</div>
      </div>
      <div style="margin-bottom:12px;font-size:10px;color:#555;">
        <div>${dateStr}</div>
        <div>Printed: ${timeStr}</div>
        ${d.note ? `<div style="margin-top:4px;font-style:italic;">Note: ${d.note}</div>` : ''}
      </div>
      <div style="border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:8px 0;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;">
          ${lines || '<tr><td colspan="3" style="padding:8px 0;color:#888;text-align:center;">No entries</td></tr>'}
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>Old Bills (₱50 ea)</span><span>${d.old} × ₱50 = ₱${d.old * 50}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span>New Bills (₱50 ea)</span><span>${d.new} × ₱50 = ₱${d.new * 50}</span>
      </div>
      <div style="border-top:2px solid #000;padding-top:10px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;">
        <span>TOTAL</span><span>₱${d.total}</span>
      </div>
      <div style="text-align:center;margin-top:20px;font-size:9px;color:#888;">— PiptiPipti —</div>
    </div>
  `;

  const receiptEl = document.getElementById('print-receipt');
  receiptEl.innerHTML = html;
  window.print();
}
