/**
 * PiptiPipti - View Renderers
 * Handles rendering of Week and History views
 */

/**
 * Renders the Week view with all day cards
 */
function renderWeekView() {
  const data = loadData();
  const stats = getWeekStats(data.currentWeek);
  const today = getTodayName();
  
  // Update summary bar
  document.getElementById('wv-total').textContent = `₱${stats.total}`;
  document.getElementById('wv-old').textContent = stats.old;
  document.getElementById('wv-new').textContent = stats.new;
  document.getElementById('wv-bills').textContent = stats.old + stats.new;

  // Render day cards
  document.getElementById('weekGrid').innerHTML = DAYS.map(day => {
    const d = data.currentWeek[day];
    const isToday = day === today;
    return `
      <div class="day-card ${isToday ? 'today' : ''}" onclick="showDayDetail('${day}')">
        ${isToday ? '<div class="today-badge">Today</div>' : ''}
        <div class="day-name">${day.substring(0, 3)}</div>
        <div class="day-amount">₱${d.total}</div>
        <div class="day-tags">
          ${d.old > 0 ? `<span class="day-tag gold">${d.old}O</span>` : ''}
          ${d.new > 0 ? `<span class="day-tag green">${d.new}N</span>` : ''}
          ${d.total === 0 ? '<span class="day-tag empty">—</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  // Hide day detail by default
  document.getElementById('dayDetail').style.display = 'none';
}

/**
 * Shows detailed information for a specific day
 * @param {string} day - Day name to show details for
 */
function showDayDetail(day) {
  const d = loadData().currentWeek[day];
  
  document.getElementById('dd-name').textContent = day;
  document.getElementById('dd-total').textContent = `₱${d.total}`;
  document.getElementById('dd-old').textContent = d.old;
  document.getElementById('dd-new').textContent = d.new;
  document.getElementById('dd-scans').textContent = d.scans;
  
  const noteEl = document.getElementById('dd-note');
  if (d.note) {
    noteEl.textContent = d.note;
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }
  
  const detail = document.getElementById('dayDetail');
  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Renders the History view with past weeks
 */
function renderHistoryView() {
  const data = loadData();
  const list = document.getElementById('historyList');
  
  if (data.history.length === 0) {
    list.innerHTML = '<div class="history-empty">No past weeks yet.<br><span style="color:var(--text3);font-size:0.75rem;">Complete a week to see history here.</span></div>';
    return;
  }
  
  list.innerHTML = [...data.history].reverse().map((week, i) => {
    const num = data.history.length - i;
    return `
      <div class="history-week-card">
        <div class="hwc-header">
          <div>
            <div class="hwc-title">Week ${num}</div>
            <div class="hwc-date">${week.savedAt || ''}</div>
          </div>
          <div class="hwc-total">₱${week.stats.total}</div>
        </div>
        <div class="hwc-tags">
          <span class="tag gold">${week.stats.old} Old</span>
          <span class="tag green">${week.stats.new} New</span>
          <span class="tag">${week.stats.scans} Scans</span>
        </div>
        <div class="hwc-days">
          ${DAYS.map(day => `
            <div class="hwc-day">
              <div class="hwc-day-name">${day.substring(0, 3)}</div>
              <div class="hwc-day-amt">₱${week.days[day]?.total || 0}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}
