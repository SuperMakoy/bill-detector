/**
 * PiptiPipti - Bill Scanner with ONNX Runtime
 * Handles image upload and local ONNX model inference
 */

// Current uploaded file
let currentFile = null;

// ONNX Runtime model (loaded once on startup)
let session = null;

/**
 * Loads the ONNX model into memory
 * Called once on app startup, then reused for all predictions
 */
async function loadModel() {
  try {
    if (session) return; // Already loaded
    console.log('[ONNX] Loading model from:', ONNX_MODEL_PATH);
    session = await ort.InferenceSession.create(ONNX_MODEL_PATH, {
      executionProviders: ['wasm']
    });
    console.log('[ONNX] Model loaded successfully');
  } catch (err) {
    console.error('[ONNX] Failed to load model:', err);
    throw err;
  }
}

/**
 * Opens the device camera directly
 */
function openCamera() {
  document.getElementById('cameraInput').click();
}

// Audio context for sound feedback (initialized on first user interaction)
let audioCtx = null;

/**
 * Initializes audio context (must be called from user interaction)
 */
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Plays a beep sound
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in seconds
 * @param {number} volume - Volume (0-1)
 */
function playBeep(frequency, duration, volume) {
  if (!audioCtx) return;
  
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + duration);
}

/**
 * Plays success feedback (sound + vibration)
 * @param {string} type - 'success', 'warning', or 'error'
 */
function playFeedback(type) {
  // Vibration feedback (mobile devices)
  if ('vibrate' in navigator) {
    if (type === 'success') {
      navigator.vibrate([50, 30, 50]); // Double tap for success
    } else if (type === 'warning') {
      navigator.vibrate(100); // Single pulse for warning
    } else if (type === 'error') {
      navigator.vibrate([100, 50, 100, 50, 100]); // Triple for error
    }
  }
  
  // Sound feedback
  if (type === 'success') {
    // Pleasant ascending chime (C5 -> E5 -> G5)
    playBeep(523, 0.15, 0.3);
    setTimeout(() => playBeep(659, 0.15, 0.3), 100);
    setTimeout(() => playBeep(784, 0.2, 0.3), 200);
  } else if (type === 'warning') {
    // Single neutral tone
    playBeep(440, 0.25, 0.25);
  }
}

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
  document.getElementById('captureOptions').style.display = 'none';
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
  document.getElementById('cameraInput').value = '';
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('captureOptions').style.display = 'flex';
  document.getElementById('scanBtn').disabled = true;
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('resultBox').style.display = 'none';
  document.getElementById('loader').style.display = 'none';
  document.getElementById('boxCanvas').getContext('2d').clearRect(0, 0, 9999, 9999);
}

/**
 * Preprocesses image for ONNX model input
 * Resizes and normalizes image to model input size (704x704)
 * @param {HTMLImageElement} img - Image element to preprocess
 * @returns {Float32Array} Normalized image data
 */
function preprocessImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Model expects 704x704 input
  const INPUT_SIZE = 704;
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  
  // Draw image centered, maintaining aspect ratio
  const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
  const x = (canvas.width - img.naturalWidth * scale) / 2;
  const y = (canvas.height - img.naturalHeight * scale) / 2;
  
  ctx.fillStyle = '#808080'; // Pad with gray
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);
  
  // Get pixel data and normalize to [0, 1]
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const data = imageData.data;
  const normalized = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    normalized[j] = data[i] / 255;     // R
    normalized[j + 1] = data[i + 1] / 255; // G
    normalized[j + 2] = data[i + 2] / 255; // B
  }
  
  return normalized;
}

/**
 * Postprocesses ONNX model outputs to detections
 * @param {Object} outputs - Raw ONNX model outputs
 * @param {number} imgWidth - Original image width
 * @param {number} imgHeight - Original image height
 * @returns {Array} Array of detections with x, y, width, height, class, confidence
 */
function postprocessOutputs(outputs, imgWidth, imgHeight) {
  // ONNX YOLOv8 output format:
  // outputs: [1, num_classes + 4, num_anchors]
  // For this model: [1, 7, num_anchors] where 7 = 4 coords + 3 classes
  // Format: [x, y, w, h, new_50_conf, not_bill_conf, old_50_conf]
  
  const detections = [];
  const INPUT_SIZE = 704;
  
  // Get output tensor - usually the first and only output
  const outputKey = Object.keys(outputs)[0];
  const output = outputs[outputKey];
  const data = output.data;
  
  console.log('[ONNX] Output shape:', output.dims, 'Data length:', data.length);
  
  // Calculate stride based on output shape
  // YOLOv8 output is typically [1, 7, 8400] for this model
  const numClasses = 3;
  const coordsPerPred = 4; // x, y, w, h
  const valuesPerPred = coordsPerPred + numClasses; // 4 + 3 = 7
  const numPredictions = data.length / valuesPerPred;
  
  console.log('[ONNX] Processing', numPredictions, 'predictions');
  
  for (let i = 0; i < numPredictions; i++) {
    const idx = i * valuesPerPred;
    
    // YOLO format: x_center, y_center, width, height, class_probs...
    const x_center = data[idx];
    const y_center = data[idx + 1];
    const w = data[idx + 2];
    const h = data[idx + 3];
    
    // Class confidences (order: new_50, not_bill, old_50)
    const conf_new50 = data[idx + 4];
    const conf_notbill = data[idx + 5];
    const conf_old50 = data[idx + 6];
    
    // Find the class with highest confidence
    const maxConf = Math.max(conf_new50, conf_notbill, conf_old50);
    
    // Check confidence threshold
    if (maxConf < CONFIDENCE) continue;
    
    // Determine class
    let classIdx = 0;
    if (conf_notbill > conf_new50 && conf_notbill > conf_old50) classIdx = 1;
    else if (conf_old50 > conf_new50 && conf_old50 > conf_notbill) classIdx = 2;
    
    const classes = ['new_50', 'not_bill', 'old_50'];
    const className = classes[classIdx];
    
    // Scale coordinates back to original image size
    // The model was trained on 704x704, need to scale back to original
    const scaleX = imgWidth / INPUT_SIZE;
    const scaleY = imgHeight / INPUT_SIZE;
    
    const scaledX = x_center * scaleX;
    const scaledY = y_center * scaleY;
    const scaledW = w * scaleX;
    const scaledH = h * scaleY;
    
    detections.push({
      x: scaledX,
      y: scaledY,
      width: scaledW,
      height: scaledH,
      class: className,
      confidence: maxConf
    });
  }
  
  console.log('[ONNX] Found', detections.length, 'detections');
  return detections;
}

/**
 * Initiates bill detection on the uploaded image
 */
async function detect() {
  if (!currentFile) return;
  
  // Initialize audio on user interaction (required for mobile browsers)
  initAudio();
  
  const scanBtn = document.getElementById('scanBtn');
  const loader = document.getElementById('loader');
  const resultBox = document.getElementById('resultBox');
  
  scanBtn.disabled = true;
  loader.style.display = 'flex';
  resultBox.style.display = 'none';
  
  try {
    // Ensure model is loaded
    await loadModel();
    
    const preview = document.getElementById('preview');
    const imgWidth = preview.naturalWidth;
    const imgHeight = preview.naturalHeight;
    
    console.log('[ONNX] Preprocessing image...');
    const imageData = preprocessImage(preview);
    
    // Create input tensor (704x704)
    const INPUT_SIZE = 704;
    const tensor = new ort.Tensor('float32', imageData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    
    console.log('[ONNX] Running inference...');
    // Try common input names - the model might use 'images' or 'input'
    let outputs;
    try {
      outputs = await session.run({ images: tensor });
    } catch (e) {
      console.log('[ONNX] "images" failed, trying "input"...');
      outputs = await session.run({ input: tensor });
    }
    
    console.log('[ONNX] Postprocessing outputs...');
    const detections = postprocessOutputs(outputs, imgWidth, imgHeight);
    
    processDetections(detections, imgWidth, imgHeight);
  } catch (e) {
    console.error('[ONNX] Error during detection:', e);
    showResult('error', 'Detection failed', 'An error occurred. Check console for details.', []);
    showToast('Detection failed', 'error');
  } finally {
    loader.style.display = 'none';
    scanBtn.disabled = false;
  }
}

/**
 * Processes detection results
 * @param {Array} preds - Array of predictions
 * @param {number} imgWidth - Original image width
 * @param {number} imgHeight - Original image height
 */
function processDetections(preds, imgWidth, imgHeight) {
  // Filter valid bills
  const valid = preds.filter(p => 
    p.confidence >= CONFIDENCE && (p.class === 'old_50' || p.class === 'new_50')
  );
  const notBill = preds.some(p => p.class === 'not_bill' && p.confidence >= CONFIDENCE);
  
  // Draw boxes
  drawBoxes(valid, imgWidth, imgHeight);
  
  if (valid.length === 0) {
    playFeedback('warning');
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
  
  playFeedback('success');
  showResult('success', `Found ${valid.length} bill${valid.length > 1 ? 's' : ''} — ₱${total}`, `Added ₱${total} to today's total`, tags);
  showToast(`Added ₱${total}`, 'success');
}

/**
 * Draws bounding boxes on detected bills
 * @param {Array} bills - Array of detected bills
 * @param {number} imgWidth - Original image width
 * @param {number} imgHeight - Original image height
 */
function drawBoxes(bills, imgWidth, imgHeight) {
  const canvas = document.getElementById('boxCanvas');
  const preview = document.getElementById('preview');
  const ctx = canvas.getContext('2d');
  
  canvas.width = imgWidth;
  canvas.height = imgHeight;
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
