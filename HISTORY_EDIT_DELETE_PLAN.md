# Job History Edit/Delete Functionality Plan

## Executive Summary

This plan outlines the implementation of functionality to edit and delete job history items. When a history item is modified or removed, the job's production totals (`parts_produced`, `parts_overproduced`) and status will be recalculated based on the remaining history entries.

### Key Features
1. **Delete History Item**: Remove a history entry and recalculate job production
2. **Edit History Item**: Update the delta value in a history entry and recalculate job production
3. **Automatic Recalculation**: Recalculate `parts_produced`, `parts_overproduced`, and job status based on all history entries
4. **Status Management**: Automatically update job status (completed/active) based on recalculated production

### Example Flow - Edit History
- Job has 3 history entries: [10, 5, 3] (total: 18, needed: 10)
- Current state: `parts_produced: 10`, `parts_overproduced: 8`, `status: completed`
- User edits first entry from 10 to 8
- Recalculation: total = 16 (8 + 5 + 3)
- New state: `parts_produced: 10`, `parts_overproduced: 6`, `status: completed`

### Example Flow - Delete History
- Job has 3 history entries: [10, 5, 3] (total: 18, needed: 10)
- Current state: `parts_produced: 10`, `parts_overproduced: 8`, `status: completed`
- User deletes entry with delta 5
- Recalculation: total = 13 (10 + 3)
- New state: `parts_produced: 10`, `parts_overproduced: 3`, `status: completed`

### Example Flow - Status Change
- Job has history: [5, 2] (total: 7, needed: 10)
- Current state: `parts_produced: 7`, `parts_overproduced: 0`, `status: active`
- User edits entry from 5 to 12
- Recalculation: total = 14 (12 + 2)
- New state: `parts_produced: 10`, `parts_overproduced: 4`, `status: completed` (changed from active)

## Overview
Allow users to edit and delete individual job history entries, with automatic recalculation of job production totals and status.

## Current Behavior
- History entries are displayed as read-only list items
- History entries cannot be modified or deleted
- Production totals are calculated only when new production is added
- Job status is set based on current production values

## Desired Behavior
- Each history entry should have edit and delete buttons
- Editing a history entry allows changing the delta value
- Deleting a history entry removes it from the history
- After edit/delete, recalculate production totals from all remaining history entries
- Update job status based on recalculated production
- Preserve archived status if job is archived

## Implementation Plan

### 1. Database Schema Changes

**No schema changes required** - The `job_updates` table already supports updates via Supabase.

**Note**: The database allows updating and deleting records in `job_updates` table. RLS policies already allow authenticated users to modify job updates.

### 2. Type Definitions

**File: `src/types/job.ts`**

**No changes required** - `JobUpdateRecord` interface already includes all necessary fields:
- `id: string` - For identifying the record to update/delete
- `delta: number` - For editing the value
- Other fields remain unchanged

**Optional**: Add a helper type for update payload:
```typescript
export interface UpdateHistoryItemPayload {
  delta: number
}
```

### 3. Store Logic Changes

**File: `src/stores/jobs.ts`**

**New Function: `recalculateJobProduction(jobId: string)`**
- Helper function to recalculate production from all history entries
- Sum all deltas from `job_updates`
- Calculate `parts_produced = min(total, parts_needed)`
- Calculate `parts_overproduced = max(0, total - parts_needed)`
- Update job status based on `parts_produced >= parts_needed`
- Preserve archived status if job is archived

**New Function: `deleteHistoryItem(jobId: string, historyId: string)`**
1. Find the job in local state
2. Delete the history entry from database using Supabase
3. If deletion succeeds, fetch all remaining history entries for the job
4. Recalculate production totals using `recalculateJobProduction`
5. Update job record in database with new production totals and status
6. Update local state with new job data and filtered history

**New Function: `updateHistoryItem(jobId: string, historyId: string, newDelta: number)`**
1. Validate newDelta > 0 (throw error if invalid)
2. Find the job in local state
3. Update the history entry in database using Supabase
4. If update succeeds, fetch all history entries for the job (including updated one)
5. Recalculate production totals using `recalculateJobProduction`
6. Update job record in database with new production totals and status
7. Update local state with new job data and updated history

**Implementation Details:**
- Both functions should handle errors gracefully
- Both functions should update local state optimistically or after successful database operation
- Both functions should preserve archived status if job is archived
- Both functions should handle the case where all history is deleted (production = 0)

**Key Logic for Recalculation:**
```typescript
function recalculateJobProduction(jobId: string, historyEntries: JobUpdateRecord[], job: JobRecord) {
  // Sum all deltas from history entries
  // If no history entries, total is 0
  const totalProduced = historyEntries.reduce((sum, entry) => sum + entry.delta, 0)

  // Calculate parts_produced (capped at parts_needed)
  // This represents the requested parts that have been produced
  const newPartsProduced = Math.min(totalProduced, job.parts_needed)

  // Calculate parts_overproduced (excess beyond parts_needed)
  // This represents extra parts produced beyond what was requested
  const newPartsOverproduced = Math.max(0, totalProduced - job.parts_needed)

  // Determine status based on production vs needed
  // If job is archived, preserve archived status
  // If parts_produced >= parts_needed, job is completed
  // Otherwise, job is active
  const newStatus = job.archived
    ? 'archived'
    : newPartsProduced >= job.parts_needed
      ? 'completed'
      : 'active'

  return {
    parts_produced: newPartsProduced,
    parts_overproduced: newPartsOverproduced,
    status: newStatus
  }
}
```

**Status Update Logic:**
- If job was `completed` and recalculated `parts_produced < parts_needed`: Status changes to `active`
- If job was `active` and recalculated `parts_produced >= parts_needed`: Status changes to `completed`
- If job is `archived`: Status remains `archived` (preserved)
- Overproduction field is automatically updated based on total production

**Changes to `addProduction` function:**
- Consider extracting recalculation logic to `recalculateJobProduction` helper
- Or keep current logic for backward compatibility

### 4. UI Component Changes

**File: `src/components/dashboard/JobCard.vue`**

**Template Changes:**
- Update history list items to include edit/delete buttons
- Add edit/delete buttons to each history entry
- Style buttons appropriately (small, inline)
- Add hover states for better UX

**Script Changes:**
- Add new emit events: `deleteHistory`, `editHistory`
- Add handlers for edit/delete actions
- Add state for editing (editingHistoryId, editDelta)
- Add modal or inline editing for history items

**History Item Display:**
```vue
<li v-for="update in job.job_updates" :key="update.id">
  <div class="history-item">
    <span>{{ formatHistoryEntry(update.delta, update.created_at) }}</span>
    <div class="history-actions">
      <button @click="handleEditHistory(update)" class="btn-icon">Edit</button>
      <button @click="handleDeleteHistory(update.id)" class="btn-icon">Delete</button>
    </div>
  </div>
</li>
```

**Edit Modal/Form:**
- Create a simple modal or inline form for editing history delta
- Input field for new delta value
- Validation: delta must be > 0
- Save and Cancel buttons

**Delete Confirmation:**
- Show confirmation dialog before deleting
- Display what will be deleted and impact on production

### 5. Parent Component Changes

**File: `src/views/DashboardView.vue`**

**New Handlers:**
- `handleDeleteHistory(jobId: string, historyId: string)`
  - Call `jobsStore.deleteHistoryItem(jobId, historyId)`
  - Handle errors
  - Show success/error messages

- `handleEditHistory(jobId: string, historyId: string, newDelta: number)`
  - Call `jobsStore.updateHistoryItem(jobId, historyId, newDelta)`
  - Handle errors
  - Show success/error messages

**Emit Events:**
- Add `@deleteHistory` and `@editHistory` event handlers to `JobCard` component

### 6. Modal Component (Optional)

**File: `src/components/dashboard/HistoryEditModal.vue`** (New)

**Features:**
- Modal for editing history entry
- Input field for delta value
- Validation
- Save and Cancel buttons
- Display current delta value
- Show impact preview (optional)

**Props:**
- `show: boolean`
- `historyEntry: JobUpdateRecord`
- `currentDelta: number`

**Events:**
- `@close`
- `@save: (newDelta: number) => void`

### 7. Localization Updates

**Translation Keys Needed:**
- `jobs.history.edit` - "Edit" button label
- `jobs.history.delete` - "Delete" button label
- `jobs.history.editTitle` - "Edit History Entry"
- `jobs.history.deleteTitle` - "Delete History Entry"
- `jobs.history.deleteMessage` - Confirmation message for deletion
- `jobs.history.deltaLabel` - "Quantity"
- `jobs.history.save` - "Save"
- `jobs.history.cancel` - "Cancel"
- `jobs.history.editSuccess` - Success message after edit
- `jobs.history.deleteSuccess` - Success message after delete
- `jobs.history.editError` - Error message for edit failure
- `jobs.history.deleteError` - Error message for delete failure

**Files to Update:**
- `src/locales/en.ts`
- `src/locales/bg.ts`
- `src/locales/uk.ts`

### 8. Error Handling

**Scenarios to Handle:**
1. **Delete fails**: Show error message, don't update UI
2. **Edit fails**: Show error message, revert changes
3. **Network error**: Show error message, retry option
4. **Invalid delta**: Validate before submission (must be > 0)
5. **Concurrent modification**: Handle if another user modifies history simultaneously

**Error Messages:**
- Use existing error handling patterns
- Show user-friendly error messages
- Log errors to console for debugging

### 9. Edge Cases

**Edge Case 1: Delete last history entry**
- All history entries deleted
- Production should be reset to 0
- Job status should be `active` (unless archived)
- `parts_produced: 0`, `parts_overproduced: 0`

**Edge Case 2: Edit to negative total**
- If editing reduces total below 0, set to 0
- Actually, this shouldn't happen if we validate delta > 0
- But if sum of all deltas becomes negative, clamp to 0

**Edge Case 3: All history deleted**
- Job should have `parts_produced: 0`, `parts_overproduced: 0`
- Status should be `active` (unless archived)

**Edge Case 4: Job is archived**
- Should preserve `archived: true` status
- Status field should remain `archived`

**Edge Case 5: Recalculation after edit**
- If job was `completed` and edit reduces production below needed, status should become `active`
- If job was `active` and edit increases production above needed, status should become `completed`

### 10. Visual Design

**History Item Layout:**
```
┌─────────────────────────────────────────┐
│  10 added on 15 Jan 2025 14:30  [Edit] [Delete] │
└─────────────────────────────────────────┘
```

**Edit Modal:**
```
┌─────────────────────────────────────────┐
│  Edit History Entry                     │
│                                         │
│  Quantity: [8        ]                  │
│                                         │
│  [Cancel]              [Save]           │
└─────────────────────────────────────────┘
```

**Button Styles:**
- Small icon buttons (edit/delete icons)
- Hover effects
- Confirmation dialog for delete
- Inline or modal editing

### 11. Implementation Order

1. ✅ Create plan document
2. Add recalculation helper function to store
3. Add `deleteHistoryItem` function to store
4. Add `updateHistoryItem` function to store
5. Update JobCard component to show edit/delete buttons
6. Create HistoryEditModal component (optional, or use inline editing)
7. Add event handlers in DashboardView
8. Update localization files
9. Add error handling
10. Test edge cases
11. Add confirmation dialogs
12. Style and polish UI

### 12. Testing Scenarios

**Test 1: Delete History Entry**
- Job has history: [10, 5, 3] (total: 18, needed: 10)
- Delete entry with delta 5
- Verify: total = 13, `parts_produced: 10`, `parts_overproduced: 3`
- Verify: status remains `completed`

**Test 2: Edit History Entry**
- Job has history: [10, 5, 3] (total: 18, needed: 10)
- Edit entry with delta 10 to delta 8
- Verify: total = 16, `parts_produced: 10`, `parts_overproduced: 6`
- Verify: status remains `completed`

**Test 3: Edit Reduces Production Below Needed**
- Job has history: [10, 5] (total: 15, needed: 10, status: completed)
- Edit entry with delta 10 to delta 2
- Verify: total = 7, `parts_produced: 7`, `parts_overproduced: 0`
- Verify: status changes to `active`

**Test 4: Edit Increases Production Above Needed**
- Job has history: [5, 2] (total: 7, needed: 10, status: active)
- Edit entry with delta 5 to delta 12
- Verify: total = 14, `parts_produced: 10`, `parts_overproduced: 4`
- Verify: status changes to `completed`

**Test 5: Delete Last History Entry**
- Job has history: [10] (total: 10, needed: 10, status: completed)
- Delete the only history entry
- Verify: total = 0, `parts_produced: 0`, `parts_overproduced: 0`
- Verify: status changes to `active`

**Test 6: Delete All History Entries**
- Job has history: [10, 5, 3]
- Delete all entries one by one
- Verify: After each deletion, production is recalculated correctly
- Verify: After last deletion, production is 0

**Test 7: Archived Job**
- Job is archived with history: [10, 5] (total: 15, needed: 10)
- Edit or delete history entry
- Verify: Status remains `archived`
- Verify: Production is recalculated correctly

### 13. Performance Considerations

**Optimistic Updates:**
- Update UI immediately, then sync with server
- Revert on error

**Batch Operations:**
- If multiple edits/deletes are needed, consider batching
- For now, handle one operation at a time

**Re-fetch vs Recalculate:**
- Option 1: Re-fetch all history after edit/delete (simpler, but more network calls)
- Option 2: Recalculate from local state (faster, but need to ensure consistency)
- **Recommendation**: Re-fetch history after edit/delete to ensure consistency

### 14. Security Considerations

**Authorization:**
- RLS policies already ensure only authenticated users can modify history
- No additional authorization needed

**Validation:**
- Validate delta > 0 on client and server
- Validate historyId exists before update/delete
- Validate jobId exists before operations

### 15. Notes

- History entries should be recalculated in chronological order (oldest first) to maintain consistency
- Currently, history is sorted by `created_at` descending (newest first) for display
- For recalculation, order doesn't matter since we're just summing deltas
- Consider adding `updated_at` field to history entries to track when they were modified
- Consider adding audit trail for history modifications (who edited/deleted, when)

## Quick Reference: Files to Modify

1. **Store Logic** (`src/stores/jobs.ts`)
   - Add `recalculateJobProduction` helper function
   - Add `deleteHistoryItem` function
   - Add `updateHistoryItem` function

2. **UI Component** (`src/components/dashboard/JobCard.vue`)
   - Add edit/delete buttons to history items
   - Add edit modal or inline editing
   - Add event handlers

3. **Parent Component** (`src/views/DashboardView.vue`)
   - Add `handleDeleteHistory` function
   - Add `handleEditHistory` function
   - Wire up event handlers

4. **Modal Component** (`src/components/dashboard/HistoryEditModal.vue`) - Optional
   - Create new modal component for editing history

5. **Localization** (`src/locales/en.ts`, `bg.ts`, `uk.ts`)
   - Add translation keys for edit/delete functionality

6. **Types** (`src/types/job.ts`) - Optional
   - Add `UpdateHistoryItemPayload` type if needed

## Implementation Checklist

- [ ] Create plan document
- [ ] Add `recalculateJobProduction` helper function to store
- [ ] Add `deleteHistoryItem` function to store
- [ ] Add `updateHistoryItem` function to store
- [ ] Update JobCard component to show edit/delete buttons
- [ ] Create HistoryEditModal component (or use inline editing)
- [ ] Add event handlers in DashboardView
- [ ] Update localization files (en, bg, uk)
- [ ] Add error handling
- [ ] Add confirmation dialogs
- [ ] Test: Delete history entry
- [ ] Test: Edit history entry
- [ ] Test: Edit reduces production below needed
- [ ] Test: Edit increases production above needed
- [ ] Test: Delete last history entry
- [ ] Test: Archived job handling
- [ ] Style and polish UI

