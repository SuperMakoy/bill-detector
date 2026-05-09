/**
 * PiptiPipti - Bill Scanner with ONNX Runtime
 * YOLOv8s model: CHW tensor input, pixel-space cx/cy/w/h output, NMS required
 */

let currentFile = null;
let session = null;
let modelReady = false;

async function loadModel() {
  try {
    if (session) return;
    console.log('[ONNX] Fetching model from:', ONNX_MODEL_PATH);

    // Update scan button to show loading state
    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
      scanBtn.textContent = 'Loading AI model...';
      scanBtn.disabled = true;
    }

    const response = await fetch(ONNX_MODEL_PATH);
    if (!response.ok) throw new Error(`HTTP ${response.status} — could not fetch model file. Check that model/best.onnx exists.`);

    const arrayBuffer = await response.arrayBuffer();
    console.log('[ONNX] Model fetched, size:', arrayBuffer.byteLength, 'bytes');

    if (arrayBuffer.byteLength < 1000) {
      throw new Error('Model file is too small — it may not have been copied correctly.');
    }

    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    const sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      executionMode: 'sequential',
    };

    const timeoutMs = 120000;
    const sessionPromise = ort.InferenceSession.create(arrayBuffer, sessionOptions);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(
        'Model load timed out (120s). Make sure index.html uses onnxruntime-web 1.21.0.'
      )), timeoutMs)
    );

    session = await Promise.race([sessionPromise, timeoutPromise]);
    modelReady = true;

    console.log('[ONNX] Model loaded. Inputs:', session.inputNames, 'Outputs:', session.outputNames);

    // Update button state now that model is ready
    if (scanBtn && currentFile) {
      scanBtn.textContent = 'Detect Bills';
      scanBtn.disabled = false;
    } else if (scanBtn) {
      scanBtn.textContent = 'Detect Bills';
      // Keep disabled until image is loaded
    }

    showToast('AI model ready!', 'success');

  } catch (err) {
    console.error('[ONNX] Failed to load model:', err);
    modelReady = false;

    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
      scanBtn.textContent = 'Model failed — Tap to retry';
      scanBtn.disabled = false;
      scanBtn.onclick = () => {
        session = null;
        loadModel();
      };
    }

    showToast('Model failed to load', 'error');
    throw err;
  }
}

function openCamera() {
  document.getElementById('cameraInput').click();
}

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playBeep(frequency, duration, volume) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = frequency;
  osc.type = 'sine';
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

function playFeedback(type) {
  if ('vibrate' in navigator) {
    if (type === 'success') navigator.vibrate([50, 30, 50]);
    else if (type === 'warning') navigator.vibrate(100);
    else if (type === 'error') navigator.vibrate([100, 50, 100, 50, 100]);
  }
  if (type === 'success') {
    playBeep(523, 0.15, 0.3);
    setTimeout(() => playBeep(659, 0.15, 0.3), 100);
    setTimeout(() => playBeep(784, 0.2, 0.3), 200);
  } else if (type === 'warning') {
    playBeep(440, 0.25, 0.25);
  }
}

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  currentFile = file;
  const preview = document.getElementById('preview');
  preview.onload = () => {
    const canvas = document.getElementById('boxCanvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };
  preview.src = URL.createObjectURL(file);
  document.getElementById('previewWrap').style.display = 'block';
  document.getElementById('captureOptions').style.display = 'none';

  // Only enable detect button if model is ready
  const scanBtn = document.getElementById('scanBtn');
  if (modelReady) {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Detect Bills';
  } else {
    scanBtn.disabled = true;
    scanBtn.textContent = 'Loading AI model...';
  }

  document.getElementById('retakeBtn').style.display = 'block';
  document.getElementById('resultBox').style.display = 'none';
}

function retake() {
  currentFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('cameraInput').value = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('captureOptions').style.display = 'flex';
  document.getElementById('scanBtn').disabled = true;
  document.getElementById('scanBtn').textContent = 'Detect Bills';
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('loader').style.display = 'none';
  const canvas = document.getElementById('boxCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Preprocesses image for YOLOv8 ONNX input.
 * Shape: [1, 3, H, W] (CHW), float32 in [0,1], letterboxed with gray (114,114,114)
 */
function preprocessImage(img) {
  const INPUT_SIZE = 704;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;

  const scale = Math.min(INPUT_SIZE / img.naturalWidth, INPUT_SIZE / img.naturalHeight);
  const scaledW = Math.round(img.naturalWidth  * scale);
  const scaledH = Math.round(img.naturalHeight * scale);
  const padX = Math.floor((INPUT_SIZE - scaledW) / 2);
  const padY = Math.floor((INPUT_SIZE - scaledH) / 2);

  ctx.fillStyle = 'rgb(114,114,114)';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(img, padX, padY, scaledW, scaledH);

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const stride = INPUT_SIZE * INPUT_SIZE;

  const tensor = new Float32Array(3 * stride);
  for (let i = 0; i < stride; i++) {
    tensor[i]            = data[i * 4]     / 255;
    tensor[stride + i]   = data[i * 4 + 1] / 255;
    tensor[stride*2 + i] = data[i * 4 + 2] / 255;
  }

  return { tensor, scale, padX, padY, INPUT_SIZE };
}

/**
 * IoU between two [x1,y1,x2,y2] boxes
 */
function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

/**
 * Non-Maximum Suppression
 */
function applyNMS(detections, iouThreshold = 0.45) {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept = [];
  for (const det of sorted) {
    const box = [det.x1, det.y1, det.x2, det.y2];
    if (!kept.some(k => iou(box, [k.x1, k.y1, k.x2, k.y2]) > iouThreshold)) {
      kept.push(det);
    }
  }
  return kept;
}

/**
 * Postprocesses YOLOv8 ONNX output into detections on the original image.
 */
function postprocessOutputs(outputs, imgWidth, imgHeight, scale, padX, padY, INPUT_SIZE) {
  const outputKey = Object.keys(outputs)[0];
  const output = outputs[outputKey];
  const data = output.data;

  console.log('[ONNX] Output key:', outputKey, 'Shape:', output.dims);

  if (!data || data.length === 0) return [];

  let numPreds, numValues;
  if (output.dims.length === 3) {
    const [, d1, d2] = output.dims;
    if (d1 < d2) {
      numValues = d1;
      numPreds  = d2;
    } else {
      numValues = d2;
      numPreds  = d1;
    }
  } else if (output.dims.length === 2) {
    [numPreds, numValues] = output.dims;
  } else {
    console.error('[ONNX] Unexpected output dims:', output.dims);
    return [];
  }

  const classes = ['new_50', 'not_bill', 'old_50'];
  const detections = [];
  const isTransposed = output.dims.length === 3 && output.dims[1] < output.dims[2];

  for (let i = 0; i < numPreds; i++) {
    let cx, cy, w, h, conf_new50, conf_notbill, conf_old50;

    if (isTransposed) {
      cx           = data[0 * numPreds + i];
      cy           = data[1 * numPreds + i];
      w            = data[2 * numPreds + i];
      h            = data[3 * numPreds + i];
      conf_new50   = data[4 * numPreds + i];
      conf_notbill = data[5 * numPreds + i];
      conf_old50   = data[6 * numPreds + i];
    } else {
      const b = i * numValues;
      cx           = data[b];
      cy           = data[b + 1];
      w            = data[b + 2];
      h            = data[b + 3];
      conf_new50   = data[b + 4];
      conf_notbill = data[b + 5];
      conf_old50   = data[b + 6];
    }

    const maxConf = Math.max(conf_new50, conf_notbill, conf_old50);
    if (maxConf < CONFIDENCE) continue;

    let classIdx = 0;
    if (conf_notbill >= conf_new50 && conf_notbill >= conf_old50) classIdx = 1;
    else if (conf_old50 >= conf_new50 && conf_old50 >= conf_notbill) classIdx = 2;

    const cx_orig = (cx - padX) / scale;
    const cy_orig = (cy - padY) / scale;
    const w_orig  = w / scale;
    const h_orig  = h / scale;

    const x1 = Math.max(0,         cx_orig - w_orig / 2);
    const y1 = Math.max(0,         cy_orig - h_orig / 2);
    const x2 = Math.min(imgWidth,  cx_orig + w_orig / 2);
    const y2 = Math.min(imgHeight, cy_orig + h_orig / 2);

    if (x2 - x1 < 2 || y2 - y1 < 2) continue;

    detections.push({ x1, y1, x2, y2, class: classes[classIdx], confidence: maxConf });
  }

  const afterNMS = applyNMS(detections, 0.45);
  console.log('[ONNX]', afterNMS.length, 'detections after NMS');

  return afterNMS;
}

/**
 * Main detection entry point
 */
async function detect() {
  if (!currentFile) return;
  initAudio();

  const scanBtn   = document.getElementById('scanBtn');
  const loader    = document.getElementById('loader');
  const resultBox = document.getElementById('resultBox');

  scanBtn.disabled = true;
  loader.style.display = 'flex';
  resultBox.style.display = 'none';

  try {
    // If model isn't ready yet, load it now (fallback)
    if (!modelReady) {
      await loadModel();
    }

    const preview   = document.getElementById('preview');
    const imgWidth  = preview.naturalWidth;
    const imgHeight = preview.naturalHeight;

    const { tensor, scale, padX, padY, INPUT_SIZE } = preprocessImage(preview);

    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const inputName   = session.inputNames[0];

    const outputs = await session.run({ [inputName]: inputTensor });

    const detections = postprocessOutputs(
      outputs, imgWidth, imgHeight, scale, padX, padY, INPUT_SIZE
    );
    processDetections(detections, imgWidth, imgHeight);

  } catch (e) {
    console.error('[ONNX] Detection error:', e.message, e.stack);
    showResult('error', 'Detection failed', `Error: ${e.message}`, []);
    showToast('Detection failed', 'error');
  } finally {
    loader.style.display = 'none';
    scanBtn.disabled = false;
    scanBtn.textContent = 'Detect Bills';
  }
}

function processDetections(preds, imgWidth, imgHeight) {
  const valid = preds.filter(p =>
    p.confidence >= CONFIDENCE && (p.class === 'old_50' || p.class === 'new_50')
  );
  const notBill = preds.some(p => p.class === 'not_bill' && p.confidence >= CONFIDENCE);

  drawBoxes(valid, imgWidth, imgHeight);

  if (valid.length === 0) {
    playFeedback('warning');
    showResult('warning',
      notBill ? 'Not a ₱50 bill' : 'No bills found',
      'Try a clearer photo with the bills visible.',
      []
    );
    return;
  }

  const oldBills = valid.filter(p => p.class === 'old_50');
  const newBills = valid.filter(p => p.class === 'new_50');
  const total    = valid.length * 50;

  addToToday(oldBills.length, newBills.length,
    `${valid.length} bill${valid.length > 1 ? 's' : ''} detected`, 'scan');

  const tags = [];
  if (oldBills.length > 0) tags.push(`<span class="tag gold">${oldBills.length} Old</span>`);
  if (newBills.length > 0) tags.push(`<span class="tag green">${newBills.length} New</span>`);

  playFeedback('success');
  showResult('success',
    `Found ${valid.length} bill${valid.length > 1 ? 's' : ''} — ₱${total}`,
    `Added ₱${total} to today's total`,
    tags
  );
  showToast(`Added ₱${total}`, 'success');
}

/**
 * Draws bounding boxes correctly accounting for object-fit: contain black bars.
 * The <img> element may have black bars (letterbox/pillarbox) because the image
 * aspect ratio doesn't match the element's aspect ratio. We must calculate the
 * actual rendered image area inside the element and offset boxes accordingly.
 */
function drawBoxes(bills, imgWidth, imgHeight) {
  const canvas  = document.getElementById('boxCanvas');
  const preview = document.getElementById('preview');
  const ctx     = canvas.getContext('2d');

  const displayWidth  = preview.clientWidth;
  const displayHeight = preview.clientHeight;

  canvas.width  = displayWidth;
  canvas.height = displayHeight;
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Calculate actual rendered image rect inside object-fit: contain element
  const imageAspect   = imgWidth / imgHeight;
  const elementAspect = displayWidth / displayHeight;

  let renderedW, renderedH, offsetX, offsetY;

  if (imageAspect > elementAspect) {
    // Image is wider than element → black bars on top & bottom
    renderedW = displayWidth;
    renderedH = displayWidth / imageAspect;
    offsetX   = 0;
    offsetY   = (displayHeight - renderedH) / 2;
  } else {
    // Image is taller than element → black bars on left & right
    renderedH = displayHeight;
    renderedW = displayHeight * imageAspect;
    offsetX   = (displayWidth - renderedW) / 2;
    offsetY   = 0;
  }

  // Scale from natural image coords to rendered image coords
  const scaleX = renderedW / imgWidth;
  const scaleY = renderedH / imgHeight;

  bills.forEach(bill => {
    const x1 = offsetX + bill.x1 * scaleX;
    const y1 = offsetY + bill.y1 * scaleY;
    const x2 = offsetX + bill.x2 * scaleX;
    const y2 = offsetY + bill.y2 * scaleY;
    const w  = x2 - x1;
    const h  = y2 - y1;

    const isOld = bill.class === 'old_50';
    const color = isOld ? '#C9A84C' : '#2D6A4F';

    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(x1, y1, w, h);

    const label = `${isOld ? 'Old' : 'New'} ₱50 · ${Math.round(bill.confidence * 100)}%`;
    ctx.font = 'bold 13px DM Sans, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1 - 24, tw + 14, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x1 + 7, y1 - 7);
  });
}