/**
 * PiptiPipti - Main Entry Point
 * Handles initialization and navigation
 */

/**
 * Initializes the application
 */
function init() {
  // Set current date in topbar
  const now = new Date();
  document.getElementById('topbar-date').textContent =
    now.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  
  // Set today's label
  document.getElementById('today-day-label').textContent = getTodayName();
  
  // Display device info in settings
  document.getElementById('deviceIdDisplay').textContent = getShortDeviceId();
  document.getElementById('deviceIconDisplay').innerHTML = getDeviceIcon();
  document.getElementById('deviceTypeLabel').textContent = getDeviceTypeLabel();
  
  // Initialize UI
  refreshTodayUI();
  refreshSidebarWeek();
  loadDayNote();
  
  // Setup modal close on overlay click
  document.getElementById('modalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  
  // Setup import modal close on overlay click
  document.getElementById('importModalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeImportModal();
  });
}

/**
 * Switches between views
 * @param {string} name - View name ('today', 'week', 'history', 'settings')
 * @param {HTMLElement|null} btn - Button element that triggered the switch
 */
function showView(name, btn) {
  // Hide all views and show selected
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  
  // Update navigation button states
  document.querySelectorAll('.nav-btn, .bottom-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
    const bn = document.getElementById(`bn-${name}`);
    if (bn) bn.classList.add('active');
  }
  
  // Update topbar title
  const titles = {
    today: "Today's Count",
    week: "This Week",
    history: "History",
    settings: "Settings"
  };
  document.getElementById('topbar-title').textContent = titles[name];
  
  // Render view-specific content
  if (name === 'week') renderWeekView();
  if (name === 'history') renderHistoryView();
}

// Initialize the app when DOM is ready
init();
