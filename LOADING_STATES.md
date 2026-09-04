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

### **Style 3: Text Skeleton**
```
▓▓▓▓▓▓▓▓▓▓
▓▓▓▓▓▓
```
- Shimmer effect untuk text placeholders
- Digunakan untuk card skeleton

---

## 📍 Where It Appears

### **Dashboard:**
```
Stats (. . .)           → Loads instantly from cache
Monitor List (. . .)    → Loads instantly from cache
Recent Table (. . .)    → Loads instantly from cache
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
```

### **Navigation (After Preload):**
```
User clicks menu
      ↓
Page changes instantly
      ↓
Skeleton dots appear briefly (< 100ms)
      ↓
Data loads from cache (instant)
      ↓
Skeleton replaced with real data
```

---

## 🎨 CSS Classes

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

### **4. Skeleton Shimmer**
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
  // Replace stats with animated dots
  $$('[data-stat],[data-count]').forEach(function (e) { 
    e.innerHTML = '<span class="sesd-loading-inline"></span>'; 
  });
  
  // Add skeleton to empty containers
  $$('[data-list]').forEach(function (container) {
    var skeleton = el('div', { class: 'sesd-skeleton-container' });
    skeleton.innerHTML = '...'; // Animated dots
    container.appendChild(skeleton);
  });
}
```

### **2. renderList() Function:**
```javascript
function renderList(tplSel, records, fill) {
  // Remove skeleton when data ready
  var skeleton = container.querySelector('.sesd-skeleton-container');
  if (skeleton) skeleton.remove();
  
  // Render real data
  records.forEach(function (rec) {
    // ... render logic
  });
}
```

### **3. Auto-trigger:**
```javascript
async function loadAndRender(p) {
  prepLoading(); // Show loading indicators
  
  try {
    var data = await DB.dashboard();
    renderList('[data-template]', data.assets); // Auto-removes skeleton
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
| Stats show | ❌ 0 → 14 (jarring) | ✅ ... → 14 (smooth) |
| List appears | ❌ Flash (sudden) | ✅ Fade (smooth) |

### **Loading Duration:**
- **First load**: 1-2 seconds (see dots briefly)
- **Cached load**: < 100ms (dots barely visible)
- **Navigation**: Instant (dots may not even show)

---

## 🎨 Customization

### **Change Dot Color:**
Edit `preloader.css` line 173:
```css
.sesd-loading-dots-alt .dot {
  background: #6366f1; /* Change to your brand color */
}
```

### **Change Container Background:**
Edit `preloader.css` line 123:
```css
.sesd-skeleton-container {
  background: linear-gradient(135deg, #f8fafc, #f1f5f9); /* Light blue */
  
  /* Alternative: Light purple */
  /* background: linear-gradient(135deg, #faf5ff, #f3e8ff); */
  
  /* Alternative: Light green */
  /* background: linear-gradient(135deg, #f0fdf4, #dcfce7); */
}
```

### **Change Loading Text:**
Edit `app.js` line 177 (in prepLoading function):
```javascript
skeleton.innerHTML = '<div class="sesd-loading-dots-alt">' +
  '<span>Memuat data</span>' + // Change text here
  '<div class="dot"></div>' +
  '</div>';
```

Options:
- "Memuat data"
- "Loading"
- "Mohon tunggu"
- "Sedang memuat"

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

### **Problem: Dots tidak muncul**

**Solution:** Check CSS file loaded:
```html
<link rel="stylesheet" href="assets/preloader.css">
```

### **Problem: Dots stuck (tidak hilang)**

**Solution:** Check data loading. Open Console (F12) for errors.

### **Problem: Animasi patah-patah**

**Solution:** Gunakan browser modern (Chrome, Firefox, Edge). IE not supported.

---

## ✅ Benefits

1. ✅ **Clear feedback** - User tahu data sedang load
2. ✅ **No blank screen** - Container terlihat professional
3. ✅ **Smooth transition** - Dari skeleton ke data real
4. ✅ **Brand consistency** - Loading style seragam
5. ✅ **Perceived speed** - Terasa lebih cepat dengan feedback visual

---

## 🎬 Animation Timeline

```
0.0s: Container appears with skeleton
0.0s: Dots start bouncing (staggered)
0.5s: Data arrives from cache
0.6s: Skeleton fades out
0.7s: Real data fades in
1.0s: Animation complete
```

Total duration: ~1 second (or instant if cached)

---

## 📊 Performance

- **CSS animations only** - No JavaScript animation (60fps)
- **Hardware accelerated** - Uses transform (GPU)
- **Lightweight** - ~2KB CSS (minified)
- **No layout shift** - Skeleton same size as content

---

Ready to use! No additional setup needed. ✨
