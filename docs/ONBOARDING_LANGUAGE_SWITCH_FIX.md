# Onboarding Language Switch Fix

## Problem
When users changed the language during the onboarding tour (especially at the "languageSettings" step), the tour text did not update. It remained in the previous language (e.g., Japanese) even after selecting Vietnamese or English.

## Root Cause
The `getSteps` callback had incomplete dependencies. It depended on `[profileDetailMode, branch]` but was missing the `ob` function dependency. 

When the language changed:
1. `t` function from LanguageContext updated
2. `ob` callback was recalculated (has `[t]` dependency)
3. But `getSteps` was NOT recalculated (missing `ob` dependency)
4. Steps array kept the old translations
5. Component rendered with outdated text

## Solution
Added `ob` to the dependency array of the `getSteps` useCallback hook.

### Changes Made

**File: `frontend/src/components/OnboardingTour.tsx`**

Line 380: Updated dependency array
```typescript
// Before:
}, [profileDetailMode, branch])

// After:
}, [ob, profileDetailMode, branch])
```

## How It Works Now

### Language Change Flow
1. User changes language in settings
2. LanguageContext updates `t` function
3. `ob` callback is recalculated (dependency: `[t]`)
4. `getSteps` is recalculated (dependency: `[ob, profileDetailMode, branch]`)
5. Steps array is regenerated with new translations
6. Component re-renders with correct language text

### Dependency Chain
```
Language Change
    ↓
t function updates (from LanguageContext)
    ↓
ob callback updates (depends on t)
    ↓
getSteps callback updates (depends on ob)
    ↓
steps array regenerates with new translations
    ↓
Component re-renders with correct language
```

## Testing
To verify the fix works:
1. Start the onboarding tour
2. Navigate to the "languageSettings" step
3. Change language (e.g., from Japanese to Vietnamese)
4. Verify the tour text updates immediately
5. Continue through remaining steps
6. All text should be in the selected language

## Files Modified
- `frontend/src/components/OnboardingTour.tsx` (line 380)

## Impact
- ✅ Language changes now immediately update onboarding text
- ✅ No breaking changes to existing functionality
- ✅ Minimal code change (1 line)
- ✅ Follows React best practices for useCallback dependencies
