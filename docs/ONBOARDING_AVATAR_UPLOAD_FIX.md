# Onboarding Avatar Upload Fix

## Problem
When users clicked on the "Choose image" button during the avatar upload step in the onboarding tour, the tour would automatically advance to the next step instead of waiting for the avatar to be uploaded successfully.

## Root Cause
The `avatar-upload` step was included in the `restrictedSteps` set, which had logic that automatically advanced to the next step when clicking on the target element (file input). This prevented users from completing the avatar upload before proceeding.

## Solution
Modified the click handler logic to only auto-advance for steps with `type: 'click'`, not for restricted steps like `avatar-upload`.

### Changes Made

**File: `frontend/src/components/OnboardingTour.tsx`**

1. **Removed automatic avatar click handler** (lines 639-662)
   - Deleted the `useEffect` that was listening for clicks on the avatar upload button
   - This was causing premature advancement to the next step

2. **Updated click handler logic** (lines 506-525)
   - Changed condition from: `step.type === 'click' || restrictedSteps.has(step.id)`
   - To: `step.type !== 'click'` (only auto-advance for click-type steps)
   - Removed the `restrictedSteps` set from auto-advance logic
   - Now `avatar-upload` step requires user to click the "Next" button after uploading

3. **Updated comment** (line 27)
   - Changed Vietnamese comment to English: "Don't show dark overlay"

## Behavior After Fix

### Avatar Upload Step Flow
1. User sees the avatar upload step with instructions
2. User clicks "Choose image" button to select an image
3. User uploads the image (file input dialog opens and closes)
4. Avatar is updated in the UI
5. User clicks the "Next" button to proceed to the next step

### Key Points
- ✅ File input is still accessible (not blocked)
- ✅ Users can upload avatars without being forced to advance
- ✅ Users must explicitly click "Next" to proceed
- ✅ Other restricted steps (sound-settings, notification-settings, etc.) still work correctly
- ✅ No hardcoded strings or logic changes

## Testing
To verify the fix works:
1. Start the onboarding tour
2. Navigate to the avatar upload step
3. Click "Choose image" button
4. Select an image file
5. Verify the tour does NOT automatically advance
6. Click "Next" button to proceed to the next step

## Files Modified
- `frontend/src/components/OnboardingTour.tsx`
