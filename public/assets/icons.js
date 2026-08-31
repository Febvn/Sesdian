/* ============================================================
   SESDIAN - inline SVG icon set (replaces emoji).
   window.SESDIAN_ICONS[name]  -> '<svg ...>'   (1em, currentColor, stroke)
   window.SESDIAN_EMOJI[emoji] -> name          (for mapping legacy emoji)
   window.sesdIcon(name)       -> '<span class="ic">svg</span>'
   ============================================================ */
(function () {
  var P = {
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    tag: '<path d="M3 3h7l11 11-7 7L3 10z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
    clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6v16h12V5h-2"/><path d="M9 12h6M9 16h6"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10.5 21a1.5 1.5 0 0 0 3 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    wrench: '<path d="M15 6a3.5 3.5 0 0 0-4.6 4.6L4 17l3 3 6.4-6.4A3.5 3.5 0 0 0 18 9l-2.3 2.3-2-2z"/>',
    pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    check_circle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    wave: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8"/><path d="M10 12h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 4v16h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
    building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/>',
    factory: '<path d="M3 21V10l6 4V10l6 4V6l6 3v12z"/><path d="M3 21h18"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    chair: '<path d="M6 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><path d="M5 11h14l-1 5H6z"/><path d="M7 16v5M17 16v5"/>',
    car: '<path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5"/><path d="M3 13h18v5H3z"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M14 9h4M14 13h4M6 15.5c.5-1.5 1.7-2.2 3-2.2s2.5.7 3 2.2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13h10l1-13"/>',
    shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/>',
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M3 20c0-3.4 3-5.3 6-5.3s6 1.9 6 5.3"/><path d="M16 5a3.3 3.3 0 0 1 0 6.6M17 14.4c2.4.3 4 2.2 4 5.6"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>',
  };
  var EMOJI = {
    '⚡': 'zap', '📦': 'package', '🏷': 'tag', '🏠': 'home', '🔄': 'refresh',
    '📋': 'clipboard', '🔔': 'bell', '🔍': 'search', '🔧': 'wrench', '📍': 'pin',
    '✅': 'check_circle', '👤': 'user', '📱': 'phone', '✕': 'x', '👋': 'wave',
    '🗄': 'archive', '⏳': 'clock', '📊': 'chart', '🏛': 'building', '🏭': 'factory',
    '💻': 'monitor', '🪑': 'chair', '🚗': 'car', '📄': 'file', '🔒': 'lock',
    '👁': 'eye', '🪪': 'idcard', '📧': 'mail', '✏': 'pencil', '🗑': 'trash',
    '🛡': 'shield', '👥': 'users', '✓': 'check',
  };
  function svg(body) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1em" height="1em" aria-hidden="true">' + body + '</svg>'; }
  var ICONS = {};
  for (var k in P) ICONS[k] = svg(P[k]);
  window.SESDIAN_ICONS = ICONS;
  window.SESDIAN_EMOJI = EMOJI;
  window.sesdIcon = function (name) { return '<span class="ic">' + (ICONS[name] || '') + '</span>'; };
})();
