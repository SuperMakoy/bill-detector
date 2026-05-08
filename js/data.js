/**
 * PiptiPipti - Data Management
 * Handles localStorage operations and data structures
 */

// Undo stack for reverting changes
let undoStack = [];

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
 * Loads data from localStorage
 * @returns {Object} Application data with currentWeek and history
 */
function loadData() {
  const raw = localStorage.getItem('piptiData');
  if (!raw) {
    return {
      currentWeek: getEmptyWeek(),
      history: []
    };
  }
  return JSON.parse(raw);
}

/**
 * Saves data to localStorage
 * @param {Object} data - Application data to save
 */
function saveData(data) {
  localStorage.setItem('piptiData', JSON.stringify(data));
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
  
  // Save current state to undo stack
  undoStack.push(JSON.parse(JSON.stringify(d)));
  if (undoStack.length > 20) undoStack.shift();
  
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
 * Undoes the last scan action
 */
function undoLastScan() {
  if (undoStack.length === 0) {
    showToast('Nothing to undo', 'warning');
    return;
  }
  
  const data = loadData();
  const today = getTodayName();
  const previousState = undoStack.pop();
  
  data.currentWeek[today] = previousState;
  saveData(data);
  
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
  undoStack = [];
  
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
  undoStack = [];
  document.getElementById('dayNote').value = '';
  refreshTodayUI();
  retake();
  showToast('Today reset', 'warning');
}

/**
 * Clears all application data
 */
function clearAll() {
  localStorage.removeItem('piptiData');
  undoStack = [];
  refreshTodayUI();
  renderHistoryView();
  retake();
  showToast('All data cleared', 'error');
}
