# Loading States - Animated Dots

## 🎯 Overview

Sistem loading dengan **animated dots (. . .)** untuk container yang sedang memuat data.

---

## ✨ Features

### 1. **Full Page Preloader** (First Load Only)
- Gradient background dengan spinner
- Muncul hanya sekali saat pertama buka website
- Fade out smooth setelah data loaded

### 2. **Container Skeleton Loading** (Data Loading)
- Animated dots (. . .) untuk list/table yang sedang load
- Muncul di container kosong saat data belum muncul
- Auto-hilang saat data sudah muncul

### 3. **Inline Loading** (Stats & Counts)
- Animated dots untuk angka statistik
- Contoh: `Total Aset: ...` → `Total Aset: 14`

### 4. **Staggered Card Animation**
- Dashboard stat cards animate in sequentially
- Each card delays 100ms after the previous
- Fade + slide up effect

### 5. **List Item Fade-In**
- Items in lists animate in with stagger effect
- 50ms delay between each item
- Smooth opacity transition

---

## 🎨 Loading Styles

### **Style 1: Skeleton Container (Default)**
```
┌─────────────────────────────┐
│                             │
│    Memuat data  ● ● ●       │
│                             │
└─────────────────────────────┘
```
- Background gradient (light blue)
- Text "Memuat data" dengan 3 bouncing dots
- Pulse animation

### **Style 2: Inline Dots**
```
Total Aset: ...
```
- Animated dots yang muncul bertahap (. → .. → ...)
- Untuk stats dan counts

### **Style 3: Card Skeleton with Stagger**
```
Card 1 (fade in) → Card 2 (100ms delay) → Card 3 (200ms delay)...
```
- Cards start at opacity 0, translateY(10px)
- Animate to opacity 1, translateY(0)
- 400ms transition with ease

---

## 📍 Where It Appears

### **Dashboard:**
```
Stats Cards → Fade in with stagger (100ms each)
├── Total Aset: ... → 14
├── Total Stok: ... → 14
├── Stok Tersedia: ... → 9
├── Stok Dipinjam: ... → 5
└── Pending: ... → 1

Monitor List → Fade in (50ms stagger per item)
Recent Table → Fade in (50ms stagger per item)
```

### **Data Aset:**
```
Asset Grid (Memuat data ● ● ●)  → Loads from cache
Stats (. . .)                   → Loads instantly
```

### **Daftar Pinjam:**
```
Borrowing Table (Memuat data ● ● ●)  → Loads from cache
Status Counts (. . .)                → Loads instantly
```

---

## 🔄 Flow Diagram

### **First Load (Cold Start):**
```
User opens page
      ↓
Full screen preloader (1-2s)
      ↓
Page visible with skeleton dots
      ↓
Data loads (from API)
      ↓
Skeleton replaced with real data
      ↓
Stats animate in (staggered 100ms)
      ↓
Cards animate in (staggered 100ms)
      ↓
List items animate in (staggered 50ms)
```

### **Navigation (After Preload):**
```
User clicks menu
      ↓
Cards/Lists start hidden (opacity: 0)
      ↓
Data loads from cache (instant)
      ↓
Stats and cards animate in with stagger
      ↓
List items fade in with stagger
```

### **Subsequent Page Loads (Same Session):**
```
User navigates to dashboard
      ↓
Cards already have .loaded class (instant)
      ↓
Data loads instantly from cache
      ↓
No animation needed
```

---

## 🎨 CSS Classes

### **Dashboard Stat Cards:**
```html
<div class="dashboard-stat-card" data-stat-card="total_assets">
  <!-- Content with data-stat -->
</div>
```

States:
- `opacity: 0; transform: translateY(10px)` - Initial
- `.loaded` → `opacity: 1; transform: translateY(0)`

### **Container Skeleton:**
```html
<div class="sesd-skeleton-container">
  <div class="sesd-loading-dots-alt">
    <span>Memuat data</span>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
</div>
```

### **Inline Loading:**
```html
<span class="sesd-loading-inline"></span>
<!-- Auto shows animated dots via CSS -->
```

### **Card Skeleton:**
```html
<div class="sesd-skeleton-card">
  <div class="sesd-skeleton-text"></div>
  <div class="sesd-skeleton-text sesd-skeleton-text-short"></div>
</div>
```

---

## 🎭 Animations

### **1. Dot Bounce** (Container Dots)
```css
@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
```
- Duration: 1.4s
- Effect: Dots bounce up and down
- Stagger: Each dot delayed by 0.16s

### **2. Dot Ellipsis** (Inline Dots)
```css
@keyframes dotEllipsis {
  0%, 20% { content: ''; }
  40% { content: '.'; }
  60% { content: '..'; }
  80%, 100% { content: '...'; }
}
```
- Duration: 1.5s
- Effect: Shows . → .. → ... → (repeat)

### **3. Skeleton Pulse**
```css
@keyframes skeletonPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```
- Duration: 2s
- Effect: Fade in/out gently

### **4. Card Fade-In**
```css
.dashboard-stat-card {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.dashboard-stat-card.loaded {
  opacity: 1;
  transform: translateY(0);
}
```
- Duration: 400ms
- Stagger: 100ms between cards

### **5. List Item Fade-In**
```css
.dashboard-list-item {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.dashboard-list-item.loaded {
  opacity: 1;
}
```
- Duration: 300ms
- Stagger: 50ms between items

### **6. Skeleton Shimmer**
```css
@keyframes skeletonShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```
- Duration: 2s
- Effect: Gradient moves left to right

---

## 🔧 How It Works (Technical)

### **1. prepLoading() Function:**
```javascript
function prepLoading() {
  // Skip if data already cached
  if (window.SESDIAN_CACHE && window.SESDIAN_CACHE.loaded) return;

  // Replace stats with animated dots
  $$('[data-stat],[data-count]').forEach(function (e) {
    if (!e.querySelector('.sesd-loading-inline')) {
      e.innerHTML = '<span class="sesd-loading-inline"></span>';
    }
  });

  // Add skeleton to empty containers
  $$('[data-list],[data-monitor-list],[data-recent-list]').forEach(function (container) {
    if (!container.querySelector('.sesd-skeleton-container')) {
      var skeleton = el('div', { class: 'sesd-skeleton-container' });
      skeleton.innerHTML = '...'; // Animated dots
      container.appendChild(skeleton);
    }
  });
}
```

### **2. renderList() Function:**
```javascript
function renderList(tplSel, records, fill) {
  // Remove skeleton when data ready
  var skeleton = container.querySelector('.sesd-skeleton-container');
  if (skeleton) skeleton.remove();

  // Render real data with stagger animation
  records.forEach(function (rec, index) {
    var n = entry.src.cloneNode(true);
    applyBinds(n, rec);
    if (fill) fill(n, rec);

    // Fade in with stagger
    n.style.opacity = '0';
    entry.container.appendChild(n);

    setTimeout(function() {
      n.style.opacity = '1';
    }, index * 50);
  });
}
```

### **3. Dashboard Stats Animation:**
```javascript
var statsKeys = Object.keys(d.stats);
statsKeys.forEach(function (k, i) {
  var e = $('[data-stat="' + k + '"]');
  if (e) {
    // Remove loading indicator
    var loadingSpan = e.querySelector('.sesd-loading-inline');
    if (loadingSpan) loadingSpan.remove();

    // Set value and animate
    e.textContent = d.stats[k];
    e.style.opacity = '0';
    setTimeout(function() { e.style.opacity = '1'; }, i * 100);
  }

  // Mark card as loaded
  var card = $('[data-stat-card="' + k + '"]');
  if (card) {
    setTimeout(function() { card.classList.add('loaded'); }, i * 100);
  }
});
```

### **4. Auto-trigger:**
```javascript
async function loadAndRender(p) {
  prepLoading(); // Show loading indicators

  try {
    var data = await DB.dashboard();
    // Stats and lists animate in automatically
  } catch (e) {
    // Error handling
  }
}
```

---

## 🎯 User Experience

### **Perceived Performance:**
| Scenario | Without Loading | With Loading Dots |
|----------|----------------|-------------------|
| Empty screen | ❌ Blank (confusing) | ✅ "Memuat data..." (clear) |
| Stats show | ❌ 0 → 14 (jarring) | ✅ ... → 14 (smooth fade) |
| List appears | ❌ Flash (sudden) | ✅ Fade in (staggered) |
| Cards appear | ❌ Instant | ✅ Slide up (staggered) |

### **Loading Duration:**
- **First load**: 1-2 seconds (see spinner, then animations)
- **Cached load**: < 100ms (animations barely visible)
- **Navigation**: Instant (animations may not show)

---

## 📱 Mobile Responsive

Animations work perfectly on mobile:
- Dots are touch-friendly (no hover needed)
- Smooth 60fps animations
- Lightweight CSS (no JS animation)

---

## ♿ Accessibility

- **Screen readers**: Loading text announced
- **Reduced motion**: Respects `prefers-reduced-motion` media query
- **Keyboard navigation**: No impact (non-interactive)

---

## 🐛 Troubleshooting

### **Problem: Cards don't animate**

**Solution:** Check that elements have `dashboard-stat-card` class.

### **Problem: Dots stuck (tidak hilang)**

**Solution:** Check data loading. Open Console (F12) for errors.

### **Problem: Animasi patah-patah**

**Solution:** Gunakan browser modern (Chrome, Firefox, Edge). IE not supported.

---

## ✅ Benefits

1. ✅ **Clear feedback** - User tahu data sedang load
2. ✅ **No blank screen** - Container terlihat professional
3. ✅ **Smooth transition** - Dari skeleton ke data real
4. ✅ **Staggered animations** - Cards and items animate in sequence
5. ✅ **Brand consistency** - Loading style seragam
6. ✅ **Perceived speed** - Terasa lebih cepat dengan feedback visual

---

## 🎬 Animation Timeline

```
0.0s: Page loads, cards hidden (opacity: 0)
0.0s: Data begins loading
0.1s: First stat appears, first card animates in
0.2s: Second stat appears, second card animates in
0.3s: Third stat appears, third card animates in
0.4s: Fourth stat appears, fourth card animates in
0.5s: Fifth stat appears, fifth card animates in
0.6s: Monitor list items start fading in (50ms stagger)
1.0s: Recent table items start fading in
1.5s: All animations complete
```

Total duration: ~1.5 seconds (or instant if cached)

---

## 📊 Performance

- **CSS animations only** - No JavaScript animation (60fps)
- **Hardware accelerated** - Uses transform (GPU)
- **Lightweight** - ~2KB CSS (minified)
- **No layout shift** - Skeleton same size as content

---
