# Overproduction Functionality Plan

## Executive Summary

This plan outlines the implementation of overproduction functionality that allows users to submit more items than requested (e.g., requested 10, submit 12). The extra production (2 in this example) will be stored separately and displayed as a non-editable field alongside the requested parts.

### Key Changes
1. **Database**: Add `parts_overproduced` column to `jobs` table
2. **Types**: Add `parts_overproduced` field to `JobRecord` interface
3. **Store**: Modify `addProduction` to calculate and store overproduction separately
4. **UI**: Display overproduction as a separate non-editable field
5. **Validation**: Remove restrictions preventing overproduction submissions

### Example Flow
- Job requests: 10 parts
- User submits: 12 parts
- Result:
  - `parts_produced`: 10 (capped at requested)
  - `parts_overproduced`: 2 (extra production)
  - `parts_remaining`: 0

## Overview
Allow users to produce more items than requested and visualize the extra production as a separate non-editable field next to requested parts.

## Current Behavior
- Production is capped at `parts_needed`
- When submitting production that exceeds remaining parts, a confirmation dialog appears
- The `addProduction` function in the store caps production at `parts_needed`
- Only the amount up to `parts_needed` is stored in `parts_produced`

## Desired Behavior
- Users can submit any amount of production (e.g., requested 10, submit 12)
- The extra production (2 in this example) should be stored separately
- Display three fields:
  1. **Requested Parts** (parts_needed) - non-editable
  2. **Produced Parts** (capped at parts_needed) - non-editable
  3. **Overproduction** (extra parts beyond requested) - non-editable, visually distinct

## Implementation Plan

### 1. Database Schema Changes

**Migration SQL** (to be added to README.md):
```sql
-- Add parts_overproduced column to jobs table
ALTER TABLE public.jobs
ADD COLUMN parts_overproduced INTEGER NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.jobs.parts_overproduced IS 'Number of parts produced beyond the requested amount (parts_needed)';
```

**Database Updates Required:**
- Add `parts_overproduced` column to `jobs` table
- Default value: 0
- Type: INTEGER
- Not null constraint

### 2. Type Definitions Update

**File: `src/types/job.ts`**
- Add `parts_overproduced: number` to `JobRecord` interface

### 3. Store Logic Changes

**File: `src/stores/jobs.ts`**

**Changes to `addProduction` function:**
- Remove the capping logic that prevents production beyond `parts_needed`
- Calculate overproduction: `Math.max(0, (job.parts_produced + delta) - job.parts_needed)`
- Update `parts_produced` to be capped at `parts_needed`: `Math.min(job.parts_produced + delta, job.parts_needed)`
- Add/update `parts_overproduced`: `job.parts_overproduced + Math.max(0, (job.parts_produced + delta) - job.parts_needed)`
- Update database query to include `parts_overproduced` in SELECT and UPDATE operations

**Key Logic:**
```typescript
const currentTotalProduced = job.parts_produced + job.parts_overproduced
const newTotalProduced = currentTotalProduced + delta
const newPartsProduced = Math.min(newTotalProduced, job.parts_needed)
const newOverproduced = Math.max(0, newTotalProduced - job.parts_needed)
```

**Important:**
- `parts_produced` is always capped at `parts_needed`
- `parts_overproduced` is the excess beyond `parts_needed`
- Total actual production = `parts_produced + parts_overproduced`

**Changes to `fetchJobs` function:**
- Include `parts_overproduced` in SELECT query

**Changes to `createJob` function:**
- Include `parts_overproduced: 0` in INSERT query

**Changes to `updateJob` function:**
- When `partsNeeded` is updated, recalculate `parts_produced` and `parts_overproduced`:
  - Calculate current total: `currentTotal = job.parts_produced + job.parts_overproduced`
  - If new `parts_needed` >= `currentTotal`:
    - `parts_produced = currentTotal`
    - `parts_overproduced = 0`
  - If new `parts_needed` < `currentTotal`:
    - `parts_produced = new parts_needed`
    - `parts_overproduced = currentTotal - new parts_needed`

### 4. UI Component Changes

**File: `src/components/dashboard/JobCard.vue`**

**Template Changes:**
- Update stats section (lines 96-109) to show:
  1. **Parts Needed** (requested) - existing (keep as is)
  2. **Parts Produced** (capped at needed) - existing (keep as is, this shows requested parts produced)
  3. **Parts Overproduced** (new field) - add new stat div, non-editable, visually distinct
  4. **Parts Remaining** - keep existing, but will show 0 when job is completed (even if overproduced)

**Stats Grid Layout:**
- Change from 3 columns to 4 columns
- Add overproduction stat between "Parts Produced" and "Parts Remaining"
- Or keep 3 columns and replace "Parts Remaining" with "Overproduced" when remaining is 0 (conditional display)

**Script Changes:**
- Remove validation that prevents submission when `partsRemaining <= 0` (line 45-48)
- Remove or simplify the confirmation dialog for overproduction (lines 50-59) - either remove entirely or make it informational only
- Add computed property for `partsOverproduced`: `computed(() => job.parts_overproduced ?? 0)`
- Update `partsRemaining` to show 0 when production exceeds needed: `Math.max(0, props.job.parts_needed - props.job.parts_produced)`
- The form should always allow submission of any positive number

**Styling Changes:**
- Add visual distinction for overproduction field (e.g., different color, icon, or badge)
- Consider adding a helpful tooltip or label explanation

### 5. Localization Updates

**Translation Keys Needed:**
- `jobs.partsOverproduced` - Label for overproduction field (e.g., "Overproduced parts")
- Update `jobs.deltaHelp` to clarify that overproduction is allowed (e.g., "Enter how many additional parts were produced. Overproduction beyond requested amount will be tracked separately.")
- Remove or update `jobs.confirmOverProduction` - Either remove the confirmation dialog or make it informational
- Remove `jobs.alreadyCompleted` validation message since overproduction is now allowed

**Files to Update:**
- `src/locales/en.ts` - Add `partsOverproduced: 'Overproduced parts'`
- `src/locales/bg.ts` - Add Bulgarian translation
- `src/locales/uk.ts` - Add Ukrainian translation

**Example Translations:**
- English: `partsOverproduced: 'Overproduced parts'`
- Bulgarian: `partsOverproduced: 'Надпроизведени детайли'`
- Ukrainian: `partsOverproduced: 'Перевироблено деталей'`

### 6. History Tracking

**Consideration:**
- Should overproduction be tracked in `job_updates` history?
- Current implementation tracks `delta` - this already captures the actual amount submitted
- History entries will show the full delta (including overproduction), which is correct behavior

### 7. Status Calculation

**Update Status Logic:**
- Job should be marked as `completed` when `parts_produced >= parts_needed`
- Overproduction does not affect completion status (job is complete when requested amount is met)

### 8. Edge Cases to Handle

1. **Editing Job (Reducing parts_needed):**
   - If current `parts_produced + parts_overproduced > new parts_needed`:
     - Set `parts_produced = new parts_needed`
     - Set `parts_overproduced = (old parts_produced + old parts_overproduced) - new parts_needed`

2. **Editing Job (Increasing parts_needed):**
   - If there's existing overproduction and new `parts_needed > old parts_needed`:
     - Reduce overproduction first, then increase `parts_produced` if needed
     - If `parts_overproduced > 0` and `new parts_needed > old parts_produced`:
       - Transfer from overproduction to produced until overproduction is 0 or produced equals needed

3. **Multiple Production Submissions:**
   - Each submission should correctly calculate cumulative overproduction
   - Example: Needed 10, produced 8, submit 5:
     - New produced: 10 (capped)
     - New overproduced: 3 (8 + 5 - 10)

## Visual Design

### Stats Display Layout
```
┌─────────────────┬─────────────────┬─────────────────┐
│  Parts Needed   │ Parts Produced  │ Overproduced    │
│      10         │       10        │       2         │
└─────────────────┴─────────────────┴─────────────────┘
```

### Visual Distinctions
- **Parts Needed**: Standard display (existing)
- **Parts Produced**: Standard display, but ensure it's clear it's capped at needed
- **Overproduced**:
  - Different color (e.g., blue or green to indicate bonus)
  - Optional: Icon or badge
  - Tooltip: "Extra parts produced beyond requested amount"

## Implementation Order

1. ✅ Create plan document
2. Database schema migration (SQL)
3. Update TypeScript types
4. Update store logic (`addProduction`, `fetchJobs`, `createJob`, `updateJob`)
5. Update UI component (JobCard.vue)
6. Update localization files
7. Test edge cases
8. Update README.md with new migration

## Testing Scenarios

1. **Basic Overproduction:**
   - Job needs 10 parts
   - Submit 12 parts
   - Verify: produced = 10, overproduced = 2

2. **Multiple Submissions:**
   - Job needs 10 parts
   - Submit 8 parts (produced = 8, overproduced = 0)
   - Submit 5 parts (produced = 10, overproduced = 3)

3. **Editing Job (Reduce needed):**
   - Job has 12 produced, 10 needed (overproduced = 2)
   - Change needed to 8
   - Verify: produced = 8, overproduced = 4

4. **Editing Job (Increase needed):**
   - Job has 12 produced, 10 needed (overproduced = 2)
   - Change needed to 15
   - Verify: produced = 12, overproduced = 0

5. **Already Completed Job:**
   - Job has 10 produced, 10 needed
   - Submit 5 more
   - Verify: produced = 10, overproduced = 5

## Notes

- Overproduction is cumulative across all production submissions
- Overproduction field is read-only (non-editable)
- Overproduction does not affect job completion status
- History entries will continue to show the full delta submitted (including overproduction)
- The form should allow submission even when job is already completed (to track additional production)

## Quick Reference: Files to Modify

1. **Database Schema** (README.md)
   - Add migration SQL for `parts_overproduced` column

2. **Type Definitions** (`src/types/job.ts`)
   - Add `parts_overproduced: number` to `JobRecord`

3. **Store Logic** (`src/stores/jobs.ts`)
   - Update `fetchJobs`: Include `parts_overproduced` in SELECT
   - Update `createJob`: Include `parts_overproduced: 0` in INSERT
   - Update `addProduction`: Calculate overproduction, update both fields
   - Update `updateJob`: Recalculate overproduction when `parts_needed` changes

4. **UI Component** (`src/components/dashboard/JobCard.vue`)
   - Add overproduction stat display
   - Remove validation preventing overproduction
   - Remove/simplify confirmation dialog
   - Update computed properties

5. **Localization** (`src/locales/en.ts`, `bg.ts`, `uk.ts`)
   - Add `partsOverproduced` translation key
   - Update `deltaHelp` text
   - Remove/update `confirmOverProduction` and `alreadyCompleted`

## Implementation Checklist

- [ ] Database migration SQL added to README.md
- [ ] Database migration executed in Supabase
- [ ] Type definitions updated (`JobRecord`)
- [ ] Store `fetchJobs` updated
- [ ] Store `createJob` updated
- [ ] Store `addProduction` updated with overproduction logic
- [ ] Store `updateJob` updated with overproduction recalculation
- [ ] UI component stats section updated
- [ ] UI component validation removed
- [ ] UI component confirmation dialog removed/simplified
- [ ] Localization files updated (en, bg, uk)
- [ ] Testing: Basic overproduction scenario
- [ ] Testing: Multiple submissions
- [ ] Testing: Edit job (reduce needed)
- [ ] Testing: Edit job (increase needed)
- [ ] Testing: Already completed job

