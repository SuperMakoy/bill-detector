/**
 * PiptiPipti - Modal & Toast
 * Handles modal dialogs and toast notifications
 */

/**
 * Opens a confirmation modal
 * @param {string} title - Modal title
 * @param {string} desc - Modal description
 * @param {string} confirmLabel - Text for confirm button
 * @param {boolean} danger - Whether to style as danger action
 * @param {Function} action - Function to call on confirmation
 */
function openModal(title, desc, confirmLabel, danger, action) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalDesc').textContent = desc;
  
  const btn = document.getElementById('modalConfirm');
  btn.textContent = confirmLabel;
  btn.className = `modal-confirm ${danger ? 'danger' : ''}`;
  btn.onclick = () => {
    closeModal();
    action();
  };
  
  document.getElementById('modalOverlay').classList.add('open');
}

/**
 * Closes the modal
 */
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/**
 * Shows confirmation modal for ending the week
 */
function confirmEndWeek() {
  const stats = getWeekStats(loadData().currentWeek);
  openModal(
    'End Week & Save',
    `Save this week's total of ₱${stats.total} (${stats.old + stats.new} bills) to history and start fresh?`,
    'Save Week',
    false,
    endWeek
  );
}

/**
 * Shows confirmation modal for resetting today
 */
function confirmResetToday() {
  openModal(
    'Reset Today',
    "This will clear all of today's scans and totals. Cannot be undone.",
    'Reset Today',
    true,
    resetToday
  );
}

/**
 * Shows confirmation modal for clearing all data
 */
function confirmClearAll() {
  openModal(
    'Clear All Data',
    'This will permanently delete ALL data including history. Are you sure?',
    'Delete Everything',
    true,
    clearAll
  );
}

/**
 * Shows a toast notification
 * @param {string} msg - Message to display
 * @param {string} type - Toast type ('success', 'warning', 'error')
 */
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
