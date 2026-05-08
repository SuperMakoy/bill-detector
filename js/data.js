/**
 * PiptiPipti - Data Management
 * Handles localStorage operations and data structures
 */

// Store only the last scan for undo (single undo, not a stack)
let lastScanBackup = null;

/**
 * Generates a unique device ID (UUID v4)
 * @returns {string} A unique identifier
 */
function generateDeviceId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Gets or creates a unique device ID for this browser/device
 * Stored separately so it persists even if app data is cleared
 * @returns {string} The device ID
 */
function getDeviceId() {
  let deviceId = localStorage.getItem('pipti_device_id');
  if (!deviceId) {
    deviceId = generateDeviceId();
    localStorage.setItem('pipti_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Gets the localStorage key for this device's data
 * @returns {string} Device-specific storage key
 */
function getStorageKey() {
  return `piptiData_${getDeviceId()}`;
}

/**
 * Gets a shortened version of the device ID for display
 * @returns {string} Short device ID (e.g., "A1B2-C3D4")
 */
function getShortDeviceId() {
  const deviceId = getDeviceId();
  const parts = deviceId.split('-');
  return `${parts[0].slice(0, 4).toUpperCase()}-${parts[1].toUpperCase()}`;
}

/**
 * Detects the type of device based on user agent and screen size
 * @returns {string} Device type: 'phone', 'tablet', 'desktop', or 'other'
 */
function getDeviceType() {
  const ua = navigator.userAgent.toLowerCase();
  const screenWidth = window.innerWidth;
  
  // Check for mobile phones
  const isMobile = /iphone|ipod|android.*mobile|windows phone|blackberry|bb10/i.test(ua);
  if (isMobile) return 'phone';
  
  // Check for tablets
  const isTablet = /ipad|android(?!.*mobile)|tablet|kindle|silk/i.test(ua) || 
                   (screenWidth >= 600 && screenWidth <= 1024 && 'ontouchstart' in window);
  if (isTablet) return 'tablet';
  
  // Check for desktop/laptop (no touch or large screen)
  const isDesktop = screenWidth > 1024 || !('ontouchstart' in window);
  if (isDesktop) return 'desktop';
  
  return 'other';
}

/**
 * Gets the SVG icon for the current device type
 * @returns {string} SVG HTML string
 */
function getDeviceIcon() {
  const type = getDeviceType();
  
  const icons = {
    phone: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="2"/></svg>',
    tablet: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01" stroke-width="2"/></svg>',
    desktop: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    other: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16.01" stroke-width="2"/></svg>'
  };
  
  return icons[type] || icons.other;
}

/**
 * Gets human-readable device type label
 * @returns {string} Device type label
 */
function getDeviceTypeLabel() {
  const labels = {
    phone: 'Phone',
    tablet: 'Tablet',
    desktop: 'Desktop',
    other: 'Device'
  };
  return labels[getDeviceType()] || 'Device';
}

/**
 * Exports current data as a shareable code (base64 encoded)
 * @returns {string} Encoded data string
 */
function exportDataCode() {
  const data = loadData();
  const exportObj = {
    deviceId: getShortDeviceId(),
    deviceType: getDeviceTypeLabel(),
    exportedAt: new Date().toISOString(),
    data: data
  };
  return btoa(encodeURIComponent(JSON.stringify(exportObj)));
}

/**
 * Imports data from a shareable code
 * @param {string} code - Base64 encoded data string
 * @returns {Object} Result with success boolean and message
 */
function importDataCode(code) {
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(code.trim())));
    
    if (!decoded.data || !decoded.data.currentWeek) {
      return { success: false, message: 'Invalid data format' };
    }
    
    // Save imported data
    saveData(decoded.data);
    
    return { 
      success: true, 
      message: `Data imported from ${decoded.deviceType} (${decoded.deviceId})`,
      sourceDevice: decoded.deviceId,
      sourceType: decoded.deviceType
    };
  } catch (e) {
    return { success: false, message: 'Invalid code. Please check and try again.' };
  }
}

/**
 * Copies data code to clipboard
 */
async function copyDataToClipboard() {
  const code = exportDataCode();
  try {
    await navigator.clipboard.writeText(code);
    showToast('Data code copied!', 'success');
    return true;
  } catch (e) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Data code copied!', 'success');
    return true;
  }
}

/**
 * Creates an empty week data structure
 * @returns {Object} Empty week with all days initialized
 */
function getEmptyWeek() {
  const data = {};
  DAYS.forEach(d => {
    data[d] = {
      total: 0,
      old: 0,
      new: 0,
      scans: 0,
      note: '',
      log: []
    };
  });
  return data;
}

/**
 * Loads data from localStorage (device-specific)
 * @returns {Object} Application data with currentWeek and history
 */
function loadData() {
  const raw = localStorage.getItem(getStorageKey());
  if (!raw) {
    return {
      currentWeek: getEmptyWeek(),
      history: []
    };
  }
  return JSON.parse(raw);
}

/**
 * Saves data to localStorage (device-specific)
 * @param {Object} data - Application data to save
 */
function saveData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

/**
 * Gets the current day name (Monday-Sunday)
 * @returns {string} Current day name
 */
function getTodayName() {
  const d = new Date().getDay();
  return DAYS[d === 0 ? 6 : d - 1];
}

/**
 * Calculates statistics for a week
 * @param {Object} week - Week data object
 * @returns {Object} Statistics with total, old, new, and scans counts
 */
function getWeekStats(week) {
  let total = 0, old = 0, newB = 0, scans = 0;
  DAYS.forEach(d => {
    total += week[d].total;
    old += week[d].old;
    newB += week[d].new;
    scans += week[d].scans;
  });
  return { total, old, new: newB, scans };
}

/**
 * Gets today's data from the current week
 * @returns {Object} Today's data
 */
function getTodayData() {
  return loadData().currentWeek[getTodayName()];
}

/**
 * Adds a scan result to today's data
 * @param {number} oldCount - Number of old bills detected
 * @param {number} newCount - Number of new bills detected
 * @param {string} desc - Description of the scan
 * @param {string} type - Type of entry ('scan' or 'manual')
 */
function addToToday(oldCount, newCount, desc, type) {
  const data = loadData();
  const today = getTodayName();
  const d = data.currentWeek[today];
  const amount = (oldCount + newCount) * 50;
  
  // Save current state for undo (only the last scan)
  lastScanBackup = JSON.parse(JSON.stringify(d));
  
  // Update totals
  d.total += amount;
  d.old += oldCount;
  d.new += newCount;
  d.scans += 1;
  
  // Add log entry
  const time = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  d.log.push({
    desc,
    amount,
    time,
    type,
    old: oldCount,
    new: newCount
  });
  
  data.currentWeek[today] = d;
  saveData(data);
  refreshTodayUI();
}

/**
 * Undoes the last scan action (single undo only)
 */
function undoLastScan() {
  if (!lastScanBackup) {
    showToast('Nothing to undo', 'warning');
    return;
  }
  
  const data = loadData();
  const today = getTodayName();
  
  data.currentWeek[today] = lastScanBackup;
  saveData(data);
  
  // Clear backup after undo (can only undo once)
  lastScanBackup = null;
  
  refreshTodayUI();
  showToast('Last scan undone', 'warning');
  playFeedback('warning');
}

/**
 * Loads the day note into the textarea
 */
function loadDayNote() {
  document.getElementById('dayNote').value = getTodayData().note || '';
}

/**
 * Saves the day note from the textarea
 */
function saveDayNote() {
  const data = loadData();
  data.currentWeek[getTodayName()].note = document.getElementById('dayNote').value;
  saveData(data);
}

/**
 * Ends the current week and saves it to history
 */
function endWeek() {
  const data = loadData();
  const stats = getWeekStats(data.currentWeek);
  const now = new Date();
  
  data.history.push({
    savedAt: now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    stats,
    days: JSON.parse(JSON.stringify(data.currentWeek))
  });
  
  data.currentWeek = getEmptyWeek();
  saveData(data);
  lastScanBackup = null;
  
  refreshTodayUI();
  renderWeekView();
  renderHistoryView();
  showToast('Week saved to history', 'success');
}

/**
 * Resets today's data
 */
function resetToday() {
  const data = loadData();
  data.currentWeek[getTodayName()] = {
    total: 0,
    old: 0,
    new: 0,
    scans: 0,
    note: '',
    log: []
  };
  saveData(data);
  lastScanBackup = null;
  document.getElementById('dayNote').value = '';
  refreshTodayUI();
  retake();
  showToast('Today reset', 'warning');
}

/**
 * Clears all application data (keeps device ID)
 */
function clearAll() {
  localStorage.removeItem(getStorageKey());
  lastScanBackup = null;
  refreshTodayUI();
  renderHistoryView();
  retake();
  showToast('All data cleared', 'error');
}
