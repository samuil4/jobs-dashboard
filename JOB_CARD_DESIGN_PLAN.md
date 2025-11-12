# Job Card Design Update Plan

## Overview
Update the job card component to have a more compact, single-line stats view and a simplified production form.

## Requirements

1. **Stats Section:**
   - Reorder stats: Place overproduced parts at the end
   - Create compact single-line view for all stats
   - Shorten labels: "Produced" → "DONE", "Overproduced" → "Over"

2. **Production Form:**
   - Remove "Produced quantity" label text
   - Remove help paragraph
   - Place input and button on a single row

## Current Structure

### Stats Section (lines 84-101)
- Uses grid layout: `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))`
- Current order:
  1. Parts Needed
  2. Parts Produced
  3. Parts Overproduced (conditional)
  4. Parts Remaining
- Each stat has a label above and value below

### Production Form (lines 103-117)
- Label: "Produced quantity" (from `jobs.productionDelta`)
- Input field with placeholder
- Help paragraph: "Enter how many additional parts were produced..."
- Submit button on separate line

## Implementation Plan

### 1. Update Locale Files

**Files:** `src/locales/en.ts`, `src/locales/bg.ts`, `src/locales/uk.ts`

**Changes:**
- Add new short label keys:
  - `jobs.partsProducedShort: 'DONE'` (or update existing)
  - `jobs.partsOverproducedShort: 'Over'` (or update existing)
- Update existing labels to be shorter if needed:
  - `jobs.partsProduced: 'DONE'` (replace "Produced")
  - `jobs.partsOverproduced: 'Over'` (replace "Overproduced")
- Keep or remove `jobs.productionDelta` (label will be removed from form)
- Keep `jobs.deltaHelp` but it won't be displayed in the form

**Alternative approach:** Update existing keys directly rather than adding new ones.

### 2. Update JobCard Component Template

**File:** `src/components/dashboard/JobCard.vue`

#### Stats Section Changes (lines 84-101)

**Current:**
```vue
<div class="stats">
  <div>
    <span class="label">{{ t('jobs.partsNeeded') }}</span>
    <strong>{{ job.parts_needed }}</strong>
  </div>
  <div>
    <span class="label">{{ t('jobs.partsProduced') }}</span>
    <strong>{{ job.parts_produced }}</strong>
  </div>
  <div v-if="partsOverproduced > 0" class="overproduced">
    <span class="label">{{ t('jobs.partsOverproduced') }}</span>
    <strong>{{ partsOverproduced }}</strong>
  </div>
  <div>
    <span class="label">{{ t('jobs.partsRemaining') }}</span>
    <strong>{{ partsRemaining }}</strong>
  </div>
</div>
```

**New:**
```vue
<div class="stats">
  <div class="stat-item">
    <span class="label">{{ t('jobs.partsNeeded') }}:</span>
    <strong>{{ job.parts_needed }}</strong>
  </div>
  <div class="stat-item">
    <span class="label">{{ t('jobs.partsProduced') }}:</span>
    <strong>{{ job.parts_produced }}</strong>
  </div>
  <div class="stat-item">
    <span class="label">{{ t('jobs.partsRemaining') }}:</span>
    <strong>{{ partsRemaining }}</strong>
  </div>
  <div v-if="partsOverproduced > 0" class="stat-item overproduced">
    <span class="label">{{ t('jobs.partsOverproduced') }}:</span>
    <strong>{{ partsOverproduced }}</strong>
  </div>
</div>
```

**Key changes:**
- Reorder: Needed → Produced → Remaining → Overproduced (at end)
- Change from vertical layout (label above, value below) to horizontal (label: value)
- Add colons after labels for inline display
- Move overproduced to the end (after remaining)

#### Production Form Changes (lines 103-117)

**Current:**
```vue
<form class="production-form" @submit.prevent="handleProductionSubmit">
  <label :for="`production-${job.id}`">{{ t('jobs.productionDelta') }}</label>
  <input
    :id="`production-${job.id}`"
    v-model.number="productionInput"
    type="number"
    min="1"
    :placeholder="t('jobs.deltaHelp')"
  />
  <p class="help">{{ t('jobs.deltaHelp') }}</p>
  <p v-if="localError" class="error">{{ localError }}</p>
  <button class="btn btn-primary" type="submit">
    {{ t('jobs.updateProduction') }}
  </button>
</form>
```

**New:**
```vue
<form class="production-form" @submit.prevent="handleProductionSubmit">
  <div class="production-form-row">
    <input
      :id="`production-${job.id}`"
      v-model.number="productionInput"
      type="number"
      min="1"
      :placeholder="t('jobs.updateProduction')"
      class="production-input"
    />
    <button class="btn btn-primary" type="submit">
      {{ t('jobs.updateProduction') }}
    </button>
  </div>
  <p v-if="localError" class="error">{{ localError }}</p>
</form>
```

**Key changes:**
- Remove label element
- Remove help paragraph
- Wrap input and button in a row container
- Move error message outside the row (below)
- Use placeholder for input (optional, can use button text or empty)

### 3. Update JobCard Component Styles

**File:** `src/components/dashboard/JobCard.vue`

#### Stats Section Styles (lines 216-246)

**Current:**
```css
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stats strong {
  display: block;
  font-size: 20px;
  margin-top: 6px;
}

.stats .overproduced {
  color: #2563eb;
}

.stats .overproduced .label {
  color: #2563eb;
}

.stats .overproduced strong {
  color: #2563eb;
}
```

**New:**
```css
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.stat-item .label {
  font-size: 13px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.stat-item strong {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.stat-item.overproduced {
  color: #2563eb;
}

.stat-item.overproduced .label {
  color: #2563eb;
}

.stat-item.overproduced strong {
  color: #2563eb;
}
```

**Key changes:**
- Change from grid to flex layout
- Make labels inline with values (horizontal layout)
- Reduce font sizes for compact view
- Add border-bottom for visual separation
- Adjust spacing and alignment
- Keep overproduced styling

#### Production Form Styles (lines 248-258)

**Current:**
```css
.production-form .help {
  font-size: 12px;
  margin: 4px 0 8px;
  color: #6b7280;
}

.production-form .error {
  color: #dc2626;
  font-size: 12px;
  margin: 0 0 8px;
}
```

**New:**
```css
.production-form {
  margin-top: 12px;
}

.production-form-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.production-input {
  flex: 1;
  min-width: 100px;
  height: 36px;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  margin: 0;
}

.production-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.production-form .error {
  color: #dc2626;
  font-size: 12px;
  margin: 8px 0 0;
}
```

**Key changes:**
- Add row container for flex layout
- Style input to work in flex row
- Remove help paragraph styles (no longer needed)
- Update error message margin
- Make input flexible (grows to fill space)

### 4. Responsive Design Considerations

**Mobile/Tablet adjustments:**
- Stats may wrap to multiple lines on small screens (flex-wrap handles this)
- Production form row may stack on very small screens
- Consider reducing gap sizes on mobile

**Add responsive styles:**
```css
@media (max-width: 640px) {
  .stats {
    gap: 12px 16px;
  }

  .stat-item {
    font-size: 12px;
  }

  .stat-item strong {
    font-size: 14px;
  }

  .production-form-row {
    flex-direction: column;
    align-items: stretch;
  }

  .production-input {
    width: 100%;
  }
}
```

## Implementation Steps

1. **Update locale files** (`src/locales/en.ts`, `bg.ts`, `uk.ts`)
   - Update `partsProduced` to "DONE"
   - Update `partsOverproduced` to "Over"
   - Verify translations for other languages

2. **Update JobCard template** (`src/components/dashboard/JobCard.vue`)
   - Reorder stats (move overproduced to end)
   - Change stats to inline layout (label: value)
   - Update production form (remove label, remove help, single row)

3. **Update JobCard styles** (`src/components/dashboard/JobCard.vue`)
   - Change stats from grid to flex
   - Update stat item styles for inline display
   - Add production form row styles
   - Update input styles
   - Add responsive styles

4. **Test**
   - Verify stats display correctly on all screen sizes
   - Verify production form works correctly
   - Verify error messages display correctly
   - Verify overproduced stat shows at the end
   - Verify labels are shortened correctly

## Visual Comparison

### Before:
```
┌─────────────────────────────────────────┐
│ Stats (Grid):                           │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │Needed│ │Prod  │ │Over  │ │Remain│   │
│ │  10  │ │  8   │ │  2   │ │  2   │   │
│ └──────┘ └──────┘ └──────┘ └──────┘   │
│                                         │
│ Production Form:                        │
│ Produced quantity                       │
│ [___________]                           │
│ Help text...                            │
│ [Add production]                        │
└─────────────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────────────┐
│ Stats (Single line):                    │
│ Needed: 10  DONE: 8  Remaining: 2  Over: 2 │
│ ───────────────────────────────────────│
│                                         │
│ Production Form:                        │
│ [___________] [Add production]          │
│                                         │
└─────────────────────────────────────────┘
```

## Notes

- Labels can be further shortened if needed (e.g., "Needed" → "Need", "Remaining" → "Left")
- Consider using icons or symbols for even more compact display
- Production form input placeholder can be empty or show button text
- Error messages will appear below the form row
- Overproduced stat only shows when > 0, so it won't always be at the end visually, but it will be last in the DOM order

## Files to Modify

1. `src/locales/en.ts` - Update label translations
2. `src/locales/bg.ts` - Update label translations
3. `src/locales/uk.ts` - Update label translations
4. `src/components/dashboard/JobCard.vue` - Update template and styles

