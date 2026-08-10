# Teacher Planner Audit: ONE-SCREEN REDESIGN

## The Core Problem

Your **Today** dashboard is trying to do too much. It has:

1. Hero (greeting + time)
2. Metrics (4 cards)
3. **Today's lessons** (main content)
4. **Weekly overview grid** (duplicate of Week view) ← **THE PROBLEM**
5. Sidebar (attention, progress, notes)

On iPad, scrolling hits **immediately after 3-4 lessons** because the weekly overview grid pushes everything down.

---

## The Hard Truth

**The weekly overview grid doesn't belong in "Today" view.**

Why?
- You already have a **Week view** that does this better
- It's 860px wide minimum (requires horizontal scroll)
- It takes up 200-300px of height (4-5 lessons worth of space)
- Most users tap "View Week" to see the week anyway
- **Duplicate content = wasted space**

---

## My Recommendation: DELETE the Weekly Overview Panel

### Option A: Remove Completely (RECOMMENDED)
Delete the entire "Weekly overview" section (lines 3370-3378 in HTML).

**What you gain**: 
- 250px+ of vertical space freed
- One less panel to scroll through
- Cleaner, focused "Today" experience

**Trade-off**: Users who want a quick weekly peek must tap "View Week" button (which exists in hero)

### Option B: Replace with "Next 3 Days" Compact View
Instead of full week grid (5 days × 7 periods), show just:
- **Tomorrow** + **Day after** lessons only
- Horizontally scrollable card list, not a grid
- Takes ~150px height max

**Example card layout**:
```
┌──────────┐ ┌──────────┐
│ Tomorrow │ │ Day 3    │
│ 3 lessons│ │ 2 lessons│
└──────────┘ └──────────┘
```

**What you gain**: 
- Quick context of coming days
- Still saves 100px vs current grid
- No duplicate of Week view
- Touch-friendly (no horizontal scroll of timetable grid)

---

## Screen Real Estate Analysis (iPad Portrait 1024px height)

### CURRENT (Everything)
```
Hero:                   190px (26%)
Metrics:                 96px (13%)
Lessons header:          60px (8%)
Lessons (visible):       80px (11%) ← Only ~2 visible before scroll
---
SCROLL REQUIRED HERE ↓
Weekly overview:        200px (28%) ← Culprit
Sidebar (partially):     ~400px off-screen
---
TOTAL NEEDED:          ~1100px (107% of screen)
```

### OPTION A: Remove Weekly Overview
```
Hero:                   190px (19%)
Metrics:                 96px (9%)
Lessons header:          60px (6%)
Lessons:                300px (29%) ← 6-7 lessons VISIBLE
---
SCROLL (optional)
Sidebar (progress/notes): 200px (20%)
---
TOTAL FITS:           ~900px (88% of screen) ✓
```

**Result**: 6-7 lessons visible without ANY scrolling required. Perfect for iPad app UX.

### OPTION B: Replace with 3-Day Cards
```
Hero:                   190px (19%)
Metrics:                 96px (9%)
Lessons header:          60px (6%)
Lessons:                200px (20%) ← 4-5 lessons visible
3-Day cards:            120px (12%) ← Horizontally scrollable
---
SCROLL (optional)
Sidebar:                200px (20%)
---
TOTAL FITS:           ~900px (88% of screen) ✓
```

**Result**: Main focus on today, but gives glimpse of coming days. No duplicate of Week view.

---

## What Should Stay on One Screen

### ESSENTIAL (Must See Without Scroll)
- ✅ Hero (greeting, key info, action buttons)
- ✅ Metrics (4 key numbers: lessons, needs planning, week progress, assessments)
- ✅ TODAY'S LESSONS (primary content - should show 5-7 items)

### IMPORTANT (Okay to Scroll Once)
- ⚠️ Sidebar panels (Attention, Progress, Notes) - can scroll to see

### NOT NEEDED (Duplicate/Low Priority)
- ❌ Weekly overview grid - use Week view instead
- ❌ Full week timetable in Today view

---

## Specific Recommendation: Go with Option A

### Why?
1. **Simplicity**: Removes cognitive load (one view = one job)
2. **Space**: Frees 250px for content that matters
3. **UX**: "Today" for today, "Week" for week (mental model is clear)
4. **iPad App Feel**: Most iPad apps have one main view (not overlapping views)
5. **Implementation**: Simple CSS hide + delete HTML section

### CSS Change (2 lines):
```css
@media (max-width: 1023px) {
  .today-week-panel {
    display: none;  /* Hide weekly overview on iPad */
  }
}
```

Or permanently (in HTML): Delete lines 3370-3378 entirely.

### What Users Get
Instead of:
- Hero → 3 lessons visible → scroll → weekly grid → sidebar

They get:
- Hero → 6 lessons visible → (optional scroll to sidebar)

**Much better app experience.**

---

## Alternative: If You Want to Keep Context

If you want users to have "next 3 days" context without scrolling, replace the grid with this compact version:

```html
<section class="today-panel today-upcoming-panel">
  <header class="today-panel-header">
    <div><h2>Next 3 days</h2></div>
  </header>
  <div class="upcoming-scroll">
    <!-- Tomorrow's lessons: horizontal card list -->
    <!-- Day 3's lessons: horizontal card list -->
  </div>
</section>
```

This version:
- Takes 120-150px (vs 250px for grid)
- Scrolls horizontally (not competing with vertical flow)
- Doesn't duplicate Week view
- More touch-friendly

---

## Implementation Choices

| Choice | Pros | Cons |
|--------|------|------|
| **A: Remove grid** | Simplest, most space, clearest UX | Users must tap "Week" to see others |
| **B: Add 3-day cards** | Context without duplication | More HTML/CSS to build |
| **C: Keep grid compressed** | Familiar interface | Still requires scrolling, wasted space |

---

## My Vote

**Option A (Remove) + metric tweak = 80% improvement, 5 minutes of work**

Here's the surgery:

### In HTML (teacher_planner.html):
Delete this entire section (lines ~3370-3378):
```html
<section class="today-panel today-week-panel">
  <header class="today-panel-header">
    <div><h2>Weekly overview</h2></div>
    <button type="button" id="todayViewFullWeek" class="today-panel-link">View full timetable</button>
  </header>
  <div class="today-week-scroll">
    <div class="today-week-grid" role="grid" aria-label="Weekly timetable overview">...</div>
  </div>
</section>
```

### In CSS (teacher-planner-redesign.css):
Add this if you want to hide instead of delete:
```css
.planner-redesign #panel-today .today-week-panel {
  display: none;  /* Remove weekly overview from Today view */
}
```

### In JavaScript (optional, for metrics):
Update the "View weekly overview" link in metrics (line 3206) to link to Week tab instead.

**Result**: Fits on one iPad screen. Done.

---

## Testing Checklist (Post-Removal)

On iPad in portrait:
- [ ] Hero + metrics + all today's lessons visible without scrolling
- [ ] No horizontal scroll
- [ ] Sidebar optionally scrollable (not blocking main content)
- [ ] "View Week" button works (takes to Week tab)
- [ ] Today's lessons show 5-7 items comfortably

---

## Bottom Line

**Don't try to cram the week into the Today view.** That's why you have a Week view.

Remove the weekly overview grid → Everything fits on one screen → Feels like an iPad app.

Simple as that.
