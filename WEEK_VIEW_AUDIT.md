# Week View Audit: iPad App UX Assessment

## Overall Assessment

**The Week view is better designed than Today** — but still has iPad issues.

### What's Good
✅ **Focused on the right thing**: Timetable grid is the main content (not secondary)  
✅ **View switching**: Has Week/Day/Month toggle (though Day/Month not fully implemented)  
✅ **Useful sidebar**: Priorities, upcoming dates, progress, notes (less clutter than Today)  
✅ **Filter option**: "Show unfinished only" is helpful  
✅ **Navigation**: Prev/Next week buttons + "Today" + "CI start" jump

### What's Bad (iPad UX)
❌ **Timetable requires horizontal scroll** (860px minimum, iPad is 1024px max)  
❌ **Hero section still large** (same ~190px as Today)  
❌ **Sidebar takes 300-350px** (squeezes timetable width)  
❌ **No "3-day view"** (alternatives for small screens)  
❌ **Full 7 periods shown** even if you only teach 5-6

---

## Problem Analysis

### 1. Timetable Grid Doesn't Fit iPad Width

**Current CSS** (line 2206-2215):
```css
.week-timetable-grid {
  grid-template-columns: 92px repeat(5, minmax(145px, 1fr));
  min-width: 860px;  /* Forces horizontal scroll */
}
```

**Math**:
- Left column (Period): 92px
- 5 days × 145px minimum: 725px
- **Total: 817px + gaps = 860px minimum**

On iPad 1024px:
- Sidebar: 350px
- Timetable: 674px available (less than 860px minimum)
- **Result**: Horizontal scroll required**

**The Fix**:
```css
/* Option A: Reduce cell size on iPad */
@media (max-width: 1023px) {
  .week-timetable-grid {
    grid-template-columns: 60px repeat(5, minmax(120px, 1fr));
    min-width: auto;  /* Fit container */
  }
}

/* Option B: Show 3-day view on iPad */
@media (max-width: 1023px) {
  .week-timetable-grid {
    grid-template-columns: 60px repeat(3, minmax(140px, 1fr));
    /* Show Mon-Wed by default, scroll to see Thu-Fri */
  }
}
```

### 2. Hero Section is Over-Engineered

**Current**: 180-200px height (similar to Today)

**Includes**:
- View toggle (Week/Day/Month buttons)
- Date navigation (Prev/Today/Next, CI start)
- Heading + summary + 3 action buttons
- Time panel (right side)

**On iPad**: Takes ~25% of screen height

**The Fix**: Compress or condense
```css
@media (max-width: 1023px) {
  .week-hero {
    padding: 12px 16px;  /* was: 14px 22px */
    grid-template-columns: 1fr;  /* stack on mobile */
  }
  .week-hero-meta {
    display: none;  /* Hide time panel */
  }
  .week-heading {
    font-size: clamp(1.4rem, 2.5vw, 1.75rem);  /* was: 2rem+ */
  }
}
```

**Saves**: 50-70px

### 3. Sidebar Width Squeezes Timetable

**Current**: `grid-template-columns: minmax(0, 1fr) minmax(310px, 370px)`

On iPad:
- Available width: 1024px
- Sidebar min: 310px (often expands to 350px+)
- Timetable: Only 674px left (still too narrow for 860px grid)

**The Fix**:
```css
@media (max-width: 1023px) {
  .week-dashboard-grid {
    grid-template-columns: 1fr;  /* Stack vertically */
  }
  .week-sidebar {
    display: grid;
    grid-template-columns: repeat(2, 1fr);  /* 2-column sidebar cards */
  }
}
```

**Benefit**: Timetable uses full 1024px width (minus padding)

### 4. No Alternative Views for iPad

**Current**: Only full 5-day × 7-period grid

**Problem**: Not all teachers have 7 periods. Some have 5-6. Yet iPad shows empty cells.

**The Fix**: Add view modes:
```
Week View Modes:
- "Full week" (Mon-Fri, all periods) ← Current
- "3-day focus" (Today + next 2 days) ← New, for iPad
- "Today detail" (just today, expanded view) ← New, for small iPad
```

Buttons in hero:
```html
<div class="week-view-toggle">
  <button data-view="week-full">Full week</button>
  <button data-view="week-3day">This 3 days</button>
  <button data-view="week-today">Today detail</button>
</div>
```

---

## iPad-Specific Recommendations

### High Priority: Make Timetable Fit

**Problem**: Horizontal scroll frustrates users  
**Solution**: Show 3-day view by default on iPad, scroll to see more days

```css
@media (max-width: 1023px) {
  .week-timetable-grid {
    grid-template-columns: 60px repeat(3, minmax(140px, 1fr));
    min-width: 100%;
  }
  /* Optional: Add scroll indicators */
  .week-timetable-scroll {
    scroll-behavior: smooth;
  }
}
```

**Trade-off**: Need left/right scroll to see Thu-Fri (acceptable, like phone)

### Medium Priority: Stack Sidebar

**Problem**: Sidebar reduces timetable width  
**Solution**: Move sidebar below timetable on iPad

```css
@media (max-width: 1023px) {
  .week-dashboard-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .week-sidebar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));  /* 2-col sidebar cards */
    gap: 8px;
  }
}
```

**Result**: Sidebar panels (priorities, deadlines, progress, notes) display 2-across below timetable

### Medium Priority: Compress Hero

**Problem**: Hero takes 200px (takes 25% of iPad screen)  
**Solution**: Reduce padding, stack elements, hide time panel

```css
@media (max-width: 1023px) {
  .week-hero {
    padding: 12px 16px;  /* from 14px 22px */
    gap: 8px;  /* from 12px 22px */
  }
  .week-hero-meta {
    display: none;  /* Time/room visible in topbar anyway */
  }
  .week-heading {
    font-size: clamp(1.4rem, 2.5vw, 1.75rem);
  }
  .week-summary {
    font-size: 0.88rem;  /* from 0.92rem */
  }
}
```

**Saves**: ~50px

### Low Priority: Add View Mode Toggle

**Problem**: No alternative views for different screen sizes  
**Solution**: Add buttons for "Full week" vs "3-day focus" vs "Today detail"

```html
<div class="week-view-toggle" role="group">
  <button class="week-mode-btn is-active" data-mode="full">Full week</button>
  <button class="week-mode-btn" data-mode="3day">3-day focus</button>
</div>
```

JavaScript toggles `.week-timetable-grid.mode-3day` class, which changes grid columns via CSS.

---

## Current State vs. Ideal State (iPad)

### Current (Doesn't Work Well)
```
Hero (200px)
├─ View toggles + Date nav
├─ Heading + summary
└─ Time panel

Timetable (needs 860px) +  Sidebar (350px)
└─ DOESN'T FIT on 1024px → Horizontal scroll required
```

### Ideal (What iPad Needs)

**Option A: 3-Day View (Recommended)**
```
Hero (120px, compact)
├─ Date nav buttons + "Full week" toggle
└─ Heading (compact)

Timetable (3-day, ~600px) [scrolls left/right for other days]
Sidebar (2-col cards below)
```

**Option B: Full Week Stack (Alternative)**
```
Hero (120px, compact)
Timetable (full 5-day, but smaller cells, fits 1024px width)
Sidebar (2-col cards below)
```

---

## Implementation Priority

### Phase 1 (30 minutes): Make It Fit Without Scroll
1. Reduce hero height (50px saved)
2. Stack dashboard grid vertically (sidebar below)
3. Reduce timetable cell sizes to fit iPad width
4. Hide hero time panel

**Result**: No horizontal scroll, everything fits, iPad-ready

### Phase 2 (1 hour): Polish
5. Add 3-day view toggle
6. Reduce font sizes appropriately
7. Make sidebar cards more compact
8. Optimize button sizes for touch

### Phase 3 (Optional): Future
9. Swipe navigation between weeks
10. Pinch-zoom for timetable
11. Save view preference (full week vs 3-day) to localStorage

---

## Comparison: Today View vs Week View

| Aspect | Today | Week |
|--------|-------|------|
| Primary Content | Today's lessons | Full timetable |
| Hero Size | 190px | 190px |
| Sidebar Importance | High (progress/notes) | Medium (priorities/deadlines) |
| iPad Fit | ❌ No (weekly grid takes space) | ⚠️ Partial (horizontal scroll) |
| Solution | Delete weekly grid | Reduce to 3-day or shrink cells |

---

## Bottom Line

**Week view is conceptually better** (focused on timetable), but **still doesn't fit iPad properly**.

Two changes make it iPad-ready:
1. **Compress hero** (50px saved)
2. **Show 3-day view** (Mon-Wed visible, scroll for Thu-Fri)

These two changes alone = no horizontal scroll, fits on iPad portrait, feels like an app.

Want to go with this approach?
