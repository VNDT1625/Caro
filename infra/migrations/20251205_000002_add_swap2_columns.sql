-- ============================================================================
-- Swap 2 Opening Rule - Database Migration
-- Migration: Add swap2_enabled to rooms and swap2_history to matches
-- Requirements: 4.4, 7.3, 4.1
-- ============================================================================

-- ============================================================================
-- 12.1: Add swap2_enabled column to rooms table
-- Requirements: 4.4
-- ============================================================================

-- Add swap2_enabled column to rooms table
-- Default is false for backward compatibility
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS swap2_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.rooms.swap2_enabled IS 'Whether Swap 2 opening rule is enabled for this room. Auto-true for ranked mode.';

-- Create index for faster filtering by swap2 status
CREATE INDEX IF NOT EXISTS idx_rooms_swap2_enabled ON public.rooms(swap2_enabled) WHERE swap2_enabled = true;

-- ============================================================================
-- 12.2: Add swap2_history column to matches table
-- Requirements: 7.3
-- ============================================================================

-- Add swap2_history column to matches table
-- Stores the complete Swap 2 sequence: actions and final color assignment
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS swap2_history JSONB;

-- Add comment for documentation
COMMENT ON COLUMN public.matches.swap2_history IS 'Swap 2 opening sequence history: { actions: Swap2Action[], finalAssignment: ColorAssignment }';

-- Create index for querying matches with swap2 history
CREATE INDEX IF NOT EXISTS idx_matches_swap2_history ON public.matches(swap2_history) WHERE swap2_history IS NOT NULL;

-- ============================================================================
-- 12.3: Update existing ranked rooms to have swap2_enabled=true
-- Requirements: 4.1
-- ============================================================================

-- Update all existing ranked rooms to have swap2_enabled=true
-- This ensures ranked mode always uses Swap 2
UPDATE public.rooms 
SET swap2_enabled = true 
WHERE mode = 'ranked' AND (swap2_enabled IS NULL OR swap2_enabled = false);

-- ============================================================================
-- Trigger: Auto-set swap2_enabled for ranked rooms
-- Requirements: 4.1
-- ============================================================================

-- Create function to auto-enable swap2 for ranked rooms
CREATE OR REPLACE FUNCTION public.auto_enable_swap2_for_ranked()
RETURNS TRIGGER AS $$
BEGIN
    -- If mode is ranked, always set swap2_enabled to true
    IF NEW.mode = 'ranked' THEN
        NEW.swap2_enabled := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_auto_swap2_ranked_insert ON public.rooms;
CREATE TRIGGER trigger_auto_swap2_ranked_insert
    BEFORE INSERT ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_enable_swap2_for_ranked();

-- Create trigger for UPDATE (in case mode changes)
DROP TRIGGER IF EXISTS trigger_auto_swap2_ranked_update ON public.rooms;
CREATE TRIGGER trigger_auto_swap2_ranked_update
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    WHEN (OLD.mode IS DISTINCT FROM NEW.mode)
    EXECUTE FUNCTION public.auto_enable_swap2_for_ranked();

