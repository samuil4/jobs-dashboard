# UI Layout Update Plan

## Executive Summary

This plan outlines the implementation of a new fixed header/footer layout for the dashboard. The header will contain search, filters, and add job button in a compact single-row layout. The footer will contain language switcher and logout button, both fixed when scrolling.

### Key Changes
1. **Fixed Header**: Compact header with search, filters, and add job button
2. **Fixed Footer**: Footer with language switcher and logout button
3. **Remove Brand**: Remove brand heading from header
4. **Remove Dashboard Header**: Remove dashboard-header section
5. **Compact Design**: Minimize space usage for header and footer

## Overview
Restructure the UI to have a fixed header with all controls and a fixed footer with user actions, maximizing content space.

## Current Behavior
- Header in App.vue: Contains brand heading, language switcher, and logout button (sticky, not fixed)
- Dashboard header: Contains brand heading and add job button
- Filters: Separate card with search, status filter, and show archived toggle
- Footer: None

## Desired Behavior
- **Fixed Header**: Compact header with search, filters, show archived toggle, and add job button (all on one row)
- **Fixed Footer**: Footer with language switcher and logout button
- **No Brand**: Remove brand heading from header
- **No Dashboard Header**: Remove dashboard-header section
- **Compact Design**: Header and footer take minimal space
- **Content Padding**: Add padding to main content to account for fixed header/footer

## Implementation Plan

### 1. App.vue Changes

**File: `src/App.vue`**

**Template Changes:**
- Remove brand heading and brand-link
- Keep header structure but make it fixed (not sticky)
- Create new footer component/section
- Move language switcher and logout button to footer
- Update header to be compact (minimal padding, smaller height)
- Add padding to main content area to account for fixed header/footer

**Script Changes:**
- Remove brand-related logic (if any)
- Keep authentication logic
- Keep showHeader computed property

**Style Changes:**
- Change header from `position: sticky` to `position: fixed`
- Make header compact: reduce padding, height
- Add footer styles: fixed position, bottom: 0
- Add padding to main content: `padding-top: [header-height]`, `padding-bottom: [footer-height]`
- Ensure header and footer have proper z-index
- Add background to header/footer for content scrolling underneath

### 2. DashboardView.vue Changes

**File: `src/views/DashboardView.vue`**

**Template Changes:**
- Remove `dashboard-header` section (lines 229-239)
- Remove `filters` card section (lines 241-261)
- Create new compact header component or integrate into App.vue header
- Move search input to header
- Move status filter to header
- Move show archived toggle to header
- Move add job button to header
- Update main content area to start immediately (no gap for removed sections)

**Script Changes:**
- Keep all existing logic (filters, modals, handlers)
- No changes to computed properties or functions

**Style Changes:**
- Remove `.dashboard-header` styles
- Remove `.filters` styles
- Remove `.filter-group` styles
- Update `.dashboard` styles: remove gap, adjust padding
- Update `.jobs-grid` styles if needed

### 3. Create AppHeader Component (Optional)

**File: `src/components/AppHeader.vue`** (New, Optional)

**Alternative Approach**: Instead of creating a separate component, integrate header content directly into App.vue and pass props/events from DashboardView.

**If Creating Component:**
- Props: `searchTerm`, `statusFilter`, `showArchived`, `archivedToggleLabel`
- Events: `update:searchTerm`, `update:statusFilter`, `toggleArchived`, `addJob`
- Template: Compact single-row layout with all controls
- Styles: Minimal padding, flexbox layout, responsive

### 4. Create AppFooter Component (Optional)

**File: `src/components/AppFooter.vue`** (New, Optional)

**Alternative Approach**: Integrate footer directly into App.vue.

**If Creating Component:**
- Props: None (uses stores directly)
- Events: None (handles logout internally)
- Template: Language switcher and logout button
- Styles: Fixed position, bottom: 0, compact design

### 5. Layout Structure

**New Structure:**
```
App.vue
├── Fixed Header (App.vue) [Fixed at top, height: 56px]
│   ├── Search Input [Compact, 32px height]
│   ├── Status Filter [Compact, 32px height]
│   ├── Show Archived Toggle [Compact button]
│   └── Add Job Button [Compact button]
├── Main Content (RouterView) [Padding-top: 64px, Padding-bottom: 64px]
│   └── DashboardView
│       └── Jobs Grid (no header, no filters card)
└── Fixed Footer (App.vue) [Fixed at bottom, height: 48px]
    ├── Language Switcher [Compact, 32px height]
    └── Logout Button [Compact button]
```

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Fixed Header (56px)                                      │
│ [Search] [Filter] [Show Archived] [Add Job]              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ Main Content Area                                         │
│ (Padding: 64px top, 64px bottom)                         │
│                                                           │
│ ┌───────┐ ┌───────┐ ┌───────┐                          │
│ │ Job 1 │ │ Job 2 │ │ Job 3 │                          │
│ └───────┘ └───────┘ └───────┘                          │
│                                                           │
├─────────────────────────────────────────────────────────┤
│ Fixed Footer (48px)                                      │
│                                    [Language] [Logout]    │
└─────────────────────────────────────────────────────────┘
```

### 6. Header Layout

**Single Row Layout:**
```
[Search Input] [Status Filter] [Show Archived] [Add Job Button]
```

**Layout Details:**
- All items on one row using flexbox
- Search input: Flexible width (grows to fill space)
- Status filter: Fixed width (120px - 150px)
- Show archived toggle: Fixed width (auto)
- Add job button: Fixed width (auto, compact)
- Gap between items: `8px` or `12px`
- Alignment: `align-items: center`
- Justification: `justify-content: flex-start` (or space-between)

**Responsive Design:**
- Desktop (> 768px): All items on one row, evenly spaced
- Tablet (640px - 768px): All items on one row, may need smaller sizes
- Mobile (< 640px): Stack vertically or use compact layout with smaller controls

**Compact Styling:**
- Header height: `56px` (compact)
- Minimal padding: `padding: 8px 16px`
- Small input heights: `height: 32px`
- Small button sizes: `height: 32px`, `padding: 6px 12px`
- Small font sizes: `font-size: 14px`
- Reduce gaps: `gap: 8px` or `12px`
- Border: `border-bottom: 1px solid #e5e7eb`
- Background: `background: #fff`

### 7. Footer Layout

**Single Row Layout:**
```
[Language Switcher] [Logout Button]
```

**Layout Details:**
- Items on one row using flexbox
- Alignment: `justify-content: flex-end` (right-aligned)
- Gap between items: `8px` or `12px`
- Alignment: `align-items: center`

**Alignment:**
- Right-aligned: Language switcher and logout on the right (recommended)
- Alternative: Left-aligned if preferred

**Compact Styling:**
- Footer height: `48px` (compact)
- Minimal padding: `padding: 8px 16px`
- Small button sizes: `height: 32px`, `padding: 6px 12px`
- Small font sizes: `font-size: 14px`
- Reduce gaps: `gap: 8px` or `12px`
- Border: `border-top: 1px solid #e5e7eb`
- Background: `background: #fff`

### 8. Spacing and Padding

**Content Padding:**
- Top padding: Account for fixed header height (e.g., `padding-top: 60px`)
- Bottom padding: Account for fixed footer height (e.g., `padding-bottom: 60px`)
- Side padding: Keep existing padding or adjust as needed

**Header Height:**
- Target: `48px` to `56px` (compact)
- Adjust based on content and styling

**Footer Height:**
- Target: `48px` to `56px` (compact)
- Adjust based on content and styling

### 9. Z-Index Management

**Z-Index Values:**
- Header: `z-index: 100` (above content)
- Footer: `z-index: 100` (above content)
- Modals: `z-index: 1000` (above header/footer)
- Ensure proper stacking context

### 10. Responsive Design

**Desktop (> 768px):**
- Header: All items on one row
- Footer: Items on one row, right-aligned
- Content: Full width with padding

**Tablet (640px - 768px):**
- Header: All items on one row, may need smaller sizes
- Footer: Items on one row
- Content: Full width with padding

**Mobile (< 640px):**
- Header: Stack vertically or use compact layout
- Footer: Stack vertically or use compact layout
- Content: Full width with adjusted padding

### 11. Implementation Steps

1. ✅ Create plan document
2. Update App.vue: Remove brand, make header fixed, add footer
3. Move language switcher and logout to footer in App.vue
4. Update DashboardView: Remove dashboard-header
5. Update DashboardView: Remove filters card
6. Create compact header in App.vue with search, filters, add job
7. Pass props/events from DashboardView to App.vue header (or use stores)
8. Update styles: Make header/footer compact
9. Add content padding for fixed header/footer
10. Test responsive design
11. Test scrolling behavior
12. Polish and adjust spacing

### 12. Props/Events Communication

**Option 1: Use Stores (Recommended)**
- Use existing `jobsStore` for search, filters, showArchived
- Use existing `authStore` for logout
- No props/events needed, components read from stores directly

**Option 2: Props/Events**
- Pass props from DashboardView to App.vue header
- Emit events from header to DashboardView
- More complex, requires prop drilling

**Recommendation**: Use Option 1 (stores) for simpler implementation.

### 13. Style Updates

**Header Styles:**
```css
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px; /* Compact */
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  z-index: 100;
}
```

**Footer Styles:**
```css
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px; /* Compact */
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  z-index: 100;
}
```

**Content Padding:**
```css
.app-content {
  padding-top: 72px; /* Header height (56px) + padding (16px) */
  padding-bottom: 64px; /* Footer height (48px) + padding (16px) */
  min-height: calc(100vh - 56px - 48px); /* Account for header and footer */
}
```

**Alternative: Use CSS Variables:**
```css
:root {
  --header-height: 56px;
  --footer-height: 48px;
  --header-footer-padding: 16px;
}

.app-content {
  padding-top: calc(var(--header-height) + var(--header-footer-padding));
  padding-bottom: calc(var(--footer-height) + var(--header-footer-padding));
  min-height: calc(100vh - var(--header-height) - var(--footer-height));
}
```

### 14. Compact Form Controls

**Input Styles:**
- Height: `32px` or `36px` (smaller than default)
- Font size: `14px` (smaller than default)
- Padding: `6px 12px` (compact)
- Border radius: `6px` (slightly smaller)

**Select Styles:**
- Height: `32px` or `36px`
- Font size: `14px`
- Padding: `6px 12px`
- Border radius: `6px`

**Button Styles:**
- Height: `32px` or `36px`
- Padding: `6px 12px`
- Font size: `14px`
- Border radius: `6px`

**Toggle Button Styles:**
- Compact size
- Smaller text
- Minimal padding

### 15. Testing Scenarios

**Test 1: Fixed Header**
- Scroll page, header should remain fixed at top
- Header should not overlap content
- Content should start below header

**Test 2: Fixed Footer**
- Scroll page, footer should remain fixed at bottom
- Footer should not overlap content
- Content should end before footer

**Test 3: Compact Layout**
- Header should be compact (minimal height)
- Footer should be compact (minimal height)
- All controls should fit on one row (desktop)

**Test 4: Responsive Design**
- Test on mobile: Header/footer should stack if needed
- Test on tablet: Layout should adapt
- Test on desktop: All items on one row

**Test 5: Functionality**
- Search should work
- Status filter should work
- Show archived toggle should work
- Add job button should work
- Language switcher should work
- Logout button should work

### 16. Edge Cases

**Edge Case 1: Very Long Search Text**
- Search input should not break layout
- Use `min-width` and `max-width` for inputs
- Allow input to shrink if needed

**Edge Case 2: Small Screen**
- Header items may need to stack
- Footer items may need to stack
- Consider hamburger menu for mobile (optional)

**Edge Case 3: Content Height**
- Ensure content area has minimum height
- Footer should not overlap content on short pages
- Use `min-height: calc(100vh - header-height - footer-height)`

### 17. Accessibility

**Keyboard Navigation:**
- Ensure all controls are keyboard accessible
- Tab order should be logical
- Focus states should be visible

**Screen Readers:**
- Ensure labels are properly associated
- Use ARIA labels where needed
- Maintain semantic HTML structure

### 18. Notes

- Header and footer should have consistent styling
- Consider using CSS variables for heights/padding
- Ensure header/footer backgrounds are opaque (not transparent)
- Test with different content lengths
- Consider adding shadow to header/footer for depth
- Ensure modals appear above fixed header/footer

## Quick Reference: Files to Modify

1. **App.vue** (`src/App.vue`)
   - Remove brand heading
   - Make header fixed
   - Add footer with language switcher and logout
   - Add compact header with search, filters, add job
   - Update content padding

2. **DashboardView.vue** (`src/views/DashboardView.vue`)
   - Remove `dashboard-header` section
   - Remove `filters` card section
   - Update styles: remove header/filter styles
   - Update content area styling

3. **LanguageSwitcher.vue** (`src/components/LanguageSwitcher.vue`)
   - May need to update styles for compact footer
   - Ensure it works in footer context

4. **main.css** (`src/assets/main.css`)
   - May need to add global styles for fixed header/footer
   - Update app-content styles if needed

## Implementation Checklist

- [ ] Create plan document
- [ ] Update App.vue: Remove brand heading
- [ ] Update App.vue: Make header fixed
- [ ] Update App.vue: Add footer section
- [ ] Update App.vue: Move language switcher to footer
- [ ] Update App.vue: Move logout to footer
- [ ] Update App.vue: Add compact header with search, filters, add job
- [ ] Update DashboardView: Remove dashboard-header
- [ ] Update DashboardView: Remove filters card
- [ ] Update DashboardView: Update styles
- [ ] Update styles: Make header compact
- [ ] Update styles: Make footer compact
- [ ] Update styles: Add content padding
- [ ] Test: Fixed header behavior
- [ ] Test: Fixed footer behavior
- [ ] Test: Compact layout
- [ ] Test: Responsive design
- [ ] Test: All functionality works
- [ ] Polish: Adjust spacing and sizing

