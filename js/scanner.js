/**
 * PiptiPipti - Bill Scanner
 * Handles image upload, API detection, and drawing results
 */

// Current uploaded file
let currentFile = null;

/**
 * Handles file selection from input
 * @param {Event} e - Change event from file input
 */
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  currentFile = file;
  const preview = document.getElementById('preview');
  
  preview.onload = () => {
    const canvas = document.getElementById('boxCanvas');
    canvas.width = preview.naturalWidth;
    canvas.height = preview.naturalHeight;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };
  
  preview.src = URL.createObjectURL(file);
  document.getElementById('previewWrap').style.display = 'block';
  document.getElementById('uploadZone').style.display = 'none';
  document.getElementById('scanBtn').disabled = false;
  document.getElementById('retakeBtn').style.display = 'block';
  document.getElementById('resultBox').style.display = 'none';
}

/**
 * Resets the scanner to initial state
 */
function retake() {
  currentFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('uploadZone').style.display = 'flex';
  document.getElementById('scanBtn').disabled = true;
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('loader').style.display = 'none';
  document.getElementById('boxCanvas').getContext('2d').clearRect(0, 0, 9999, 9999);
}

/**
 * Initiates bill detection on the uploaded image
 */
async function detect() {
  if (!currentFile) return;
  
  const scanBtn = document.getElementById('scanBtn');
  const loader = document.getElementById('loader');
  const resultBox = document.getElementById('resultBox');
  
  scanBtn.disabled = true;
  loader.style.display = 'flex';
  resultBox.style.display = 'none';
  
  try {
    const base64 = await toBase64(currentFile);
    const response = await fetch(
      `https://detect.roboflow.com/${MODEL_ID}?api_key=${API_KEY}&format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64.split(',')[1]
      }
    );
    processDetections(await response.json());
  } catch (e) {
    showResult('error', 'Connection failed', 'Check your internet and try again.', []);
    showToast('Connection failed', 'error');
  } finally {
    loader.style.display = 'none';
    scanBtn.disabled = false;
  }
}

/**
 * Processes detection results from the API
 * @param {Object} data - API response data
 */
function processDetections(data) {
  const preds = data.predictions || [];
  const valid = preds.filter(p => 
    p.confidence >= CONFIDENCE && (p.class === 'old_50' || p.class === 'new_50')
  );
  const notBill = preds.some(p => p.class === 'not_bill' && p.confidence >= CONFIDENCE);
  
  drawBoxes(valid, data);
  
  if (valid.length === 0) {
    showResult('warning', notBill ? 'Not a ₱50 bill' : 'No bills found', 'Try a clearer photo with the bills visible.', []);
    return;
  }
  
  const oldBills = valid.filter(p => p.class === 'old_50');
  const newBills = valid.filter(p => p.class === 'new_50');
  const total = valid.length * 50;
  
  addToToday(oldBills.length, newBills.length, `${valid.length} bill${valid.length > 1 ? 's' : ''} detected`, 'scan');
  
  const tags = [];
  if (oldBills.length > 0) tags.push(`<span class="tag gold">${oldBills.length} Old</span>`);
  if (newBills.length > 0) tags.push(`<span class="tag green">${newBills.length} New</span>`);
  
  showResult('success', `Found ${valid.length} bill${valid.length > 1 ? 's' : ''} — ₱${total}`, `Added ₱${total} to today's total`, tags);
  showToast(`Added ₱${total}`, 'success');
}

/**
 * Draws bounding boxes on detected bills
 * @param {Array} bills - Array of detected bills
 * @param {Object} data - Original API response for image dimensions
 */
function drawBoxes(bills, data) {
  const canvas = document.getElementById('boxCanvas');
  const preview = document.getElementById('preview');
  const ctx = canvas.getContext('2d');
  
  canvas.width = data.image?.width || preview.naturalWidth;
  canvas.height = data.image?.height || preview.naturalHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  bills.forEach(bill => {
    const x = bill.x - bill.width / 2;
    const y = bill.y - bill.height / 2;
    const isOld = bill.class === 'old_50';
    const color = isOld ? '#C9A84C' : '#2D6A4F';
    
    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, bill.width, bill.height);
    
    // Draw label
    const label = `${isOld ? 'Old' : 'New'} ₱50 · ${Math.round(bill.confidence * 100)}%`;
    ctx.font = 'bold 13px DM Sans, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 24, tw + 14, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + 7, y - 7);
  });
}

/**
 * Converts a file to base64 string
 * @param {File} file - File to convert
 * @returns {Promise<string>} Base64 encoded string
 */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
