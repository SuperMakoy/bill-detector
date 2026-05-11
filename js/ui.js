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
 * Shows a model loading banner below the topbar
 * Disappears automatically when model is ready
 */
function showModelLoadingBanner() {
  if (document.getElementById('modelLoadingBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'modelLoadingBanner';
  banner.innerHTML = `
    <div class="model-banner-spinner"></div>
    <span>Loading AI model — first scan may take up to 1 minute on mobile...</span>
  `;
  banner.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: #F5EDD5;
    border-bottom: 1px solid #E8D499;
    color: #7A5E1A;
    font-size: 0.78rem;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    position: sticky;
    top: 0;
    z-index: 9;
    grid-column: 2;
  `;

  const style = document.createElement('style');
  style.textContent = `
    .model-banner-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #E8D499;
      border-top-color: #7A5E1A;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  const topbar = document.querySelector('.topbar');
  if (topbar && topbar.nextSibling) {
    topbar.parentNode.insertBefore(banner, topbar.nextSibling);
  }
}

/**
 * Hides the model loading banner
 */
function hideModelLoadingBanner() {
  const banner = document.getElementById('modelLoadingBanner');
  if (banner) {
    banner.style.transition = 'opacity 0.4s ease';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 400);
  }
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
  const hash = Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
  return hash.toUpperCase().substring(0, 16);
}

/* ─────────────────────────────────────────────────────────────
   PRINT  — opens a clean new window so mobile browsers can
   trigger the system print / Save as PDF sheet properly.
───────────────────────────────────────────────────────────── */

/**
 * Prints today's report via a dedicated print window.
 * Works on desktop and mobile (iOS Share → Print, Android print dialog).
 */
function printReport() {
  const d   = getTodayData();
  const now = new Date();
  const dateStr    = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr    = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const receiptId  = generateReceiptId();
  const receiptHash = generateReceiptHash();

  const logRows = d.log.map(item =>
    `<tr>
      <td style="padding:5px 0;color:#777;font-size:11px;">${item.time}</td>
      <td style="padding:5px 8px;font-size:12px;">${item.desc}</td>
      <td style="padding:5px 0;text-align:right;font-weight:600;font-size:12px;">₱${item.amount}</td>
    </tr>`
  ).join('');

  const noteRow = d.note
    ? `<p style="font-style:italic;color:#555;font-size:11px;margin:4px 0 0;">Note: ${d.note}</p>`
    : '';

  const receiptHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>SingKwenta Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #fff;
      color: #000;
      padding: 24px 20px;
      max-width: 360px;
      margin: 0 auto;
    }
    .title   { font-size: 22px; font-weight: 800; color: #D42B2B; text-align: center; margin-bottom: 4px; }
    .sub     { font-size: 11px; color: #999; text-align: center; letter-spacing: 1px; margin-bottom: 14px; }
    .divider { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
    .divider.thick { border-top: 2px solid #000; }
    .meta    { font-size: 11px; color: #666; text-align: center; line-height: 1.7; margin-bottom: 12px; }
    table    { width: 100%; border-collapse: collapse; }
    .total-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
    .grand   { display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; margin-top: 12px; }
    .hash    { font-size: 9px; color: #ddd; text-align: center; margin-top: 16px; letter-spacing: 1px; }
    .empty   { font-size: 11px; color: #ccc; text-align: center; padding: 10px 0; }
    @media print {
      @page { size: 80mm auto; margin: 0; }
      body  { padding: 16px 12px; }
    }
  </style>
</head>
<body>
  <div class="title">SingKwenta</div>
  <div class="sub">₱50 BILL COUNTER</div>
  <hr class="divider"/>
  <div class="meta">
    ${dateStr}<br/>
    Generated: ${timeStr}<br/>
    <span style="font-size:10px;font-family:monospace;">ID: ${receiptId}</span>
    ${noteRow}
  </div>
  <hr class="divider"/>
  <table>
    ${logRows || '<tr><td colspan="3" class="empty">No entries</td></tr>'}
  </table>
  <hr class="divider"/>
  <div class="total-row"><span>Old Bills (₱50)</span><span>${d.old} × ₱50 = ₱${d.old * 50}</span></div>
  <div class="total-row"><span>New Bills (₱50)</span><span>${d.new} × ₱50 = ₱${d.new * 50}</span></div>
  <hr class="divider thick"/>
  <div class="grand"><span>TOTAL</span><span>₱${d.total}</span></div>
  <div class="hash">${receiptHash}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    // Popup blocked — fall back to same-window print via hidden div
    const el = document.getElementById('print-receipt');
    el.innerHTML = receiptHTML;
    window.print();
    return;
  }
  win.document.write(receiptHTML);
  win.document.close();
}

/* ─────────────────────────────────────────────────────────────
   DOWNLOAD  — draws the receipt directly onto a <canvas> so
   there is zero dependency on html2canvas, external images, or
   CORS. Works on desktop and mobile (iOS opens image in new tab
   because Safari ignores <a download>; Android downloads normally).
───────────────────────────────────────────────────────────── */

/**
 * Downloads today's report as a PNG image.
 * Uses the Canvas 2D API directly — no html2canvas required.
 */
function downloadReportImage() {
  const d   = getTodayData();
  const now = new Date();
  const dateStr    = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr    = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const receiptId  = generateReceiptId();
  const receiptHash = generateReceiptHash();
  const filename   = `bill-report-${now.toISOString().split('T')[0]}.png`;

  // Layout constants
  const W      = 360;
  const PAD    = 24;
  const DPR    = 2;           // retina quality
  const ENTRY  = 30;          // height per log row
  const noteH  = d.note ? 20 : 0;
  const logH   = Math.max(d.log.length, 1) * ENTRY;
  const H      = 340 + logH + noteH;

  const canvas = document.createElement('canvas');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── helpers ──────────────────────────────────────────────
  const hr = (y, thick = false) => {
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.strokeStyle = thick ? '#000' : '#e0e0e0';
    ctx.lineWidth   = thick ? 2 : 1;
    ctx.stroke();
  };

  const txt = (text, x, y, opts = {}) => {
    ctx.font      = `${opts.bold ? 'bold ' : ''}${opts.size || 12}px ${opts.mono ? 'monospace' : '-apple-system, sans-serif'}`;
    ctx.fillStyle = opts.color || '#000';
    ctx.textAlign = opts.align || 'left';
    ctx.fillText(String(text), x, y);
    ctx.textAlign = 'left'; // reset
  };

  // ── background ───────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let y = PAD + 8;

  // Title
  txt('SingKwenta', W / 2, y + 18, { bold: true, size: 22, color: '#D42B2B', align: 'center' });
  y += 28;
  txt('₱50 BILL COUNTER', W / 2, y, { size: 10, color: '#999', align: 'center', mono: true });
  y += 18;

  hr(y); y += 16;

  // Date / time / ID
  txt(dateStr,            W / 2, y,      { size: 11, color: '#555', align: 'center' }); y += 16;
  txt(`Generated: ${timeStr}`, W / 2, y, { size: 11, color: '#666', align: 'center' }); y += 16;
  txt(`ID: ${receiptId}`, W / 2, y,      { size: 10, color: '#888', align: 'center', mono: true }); y += 16;

  if (d.note) {
    txt(`Note: ${d.note}`, W / 2, y, { size: 10, color: '#555', align: 'center' });
    y += noteH;
  }

  y += 4;
  hr(y); y += 16;

  // Log entries
  if (d.log.length === 0) {
    txt('No entries', W / 2, y + 12, { size: 11, color: '#ccc', align: 'center' });
    y += ENTRY;
  } else {
    for (const item of d.log) {
      txt(item.time,   PAD,           y + 12, { size: 10, color: '#777' });
      txt(item.desc,   PAD + 54,      y + 12, { size: 11, color: '#222' });
      txt(`₱${item.amount}`, W - PAD, y + 12, { size: 11, color: '#000', bold: true, align: 'right', mono: true });
      y += ENTRY;
    }
  }

  hr(y); y += 16;

  // Subtotals
  txt(`Old Bills (₱50)`,         PAD,      y, { size: 12, color: '#333' });
  txt(`${d.old} × ₱50 = ₱${d.old * 50}`, W - PAD, y, { size: 12, color: '#333', align: 'right' });
  y += 22;

  txt(`New Bills (₱50)`,         PAD,      y, { size: 12, color: '#333' });
  txt(`${d.new} × ₱50 = ₱${d.new * 50}`, W - PAD, y, { size: 12, color: '#333', align: 'right' });
  y += 20;

  hr(y, true); y += 18;

  // Grand total
  txt('TOTAL',     PAD,      y + 2, { size: 17, bold: true, color: '#000' });
  txt(`₱${d.total}`, W - PAD, y + 2, { size: 20, bold: true, color: '#000', align: 'right', mono: true });
  y += 36;

  // Footer hash
  txt(receiptHash, W / 2, y, { size: 9, color: '#ddd', align: 'center', mono: true });

  // ── trigger download ──────────────────────────────────────
  try {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // iOS Safari ignores <a download> — open image in new tab as fallback
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);
    }, 'image/png');
  } catch (e) {
    // Hard fallback for any canvas security error
    try {
      window.open(canvas.toDataURL('image/png'), '_blank');
    } catch (e2) {
      showToast('Download failed — try Print instead', 'error');
    }
  }
}