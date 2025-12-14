-- Migration: Create profiles_with_email view for admin panel
-- This view joins profiles with auth.users to get email addresses
-- Only accessible by admin users

-- Drop existing view if exists
DROP VIEW IF EXISTS public.profiles_with_email;

-- Create view that joins profiles with auth.users
CREATE VIEW public.profiles_with_email AS
SELECT 
    p.user_id,
    p.username,
    p.display_name,
    u.email,
    p.current_rank,
    p.mindpoint,
    p.elo_rating,
    p.total_matches,
    p.total_wins,
    p.total_losses,
    p.coins,
    p.gems,
    p.settings,
    p.last_active,
    p.created_at
FROM public.profiles p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Grant access to authenticated users (RLS will handle permissions)
GRANT SELECT ON public.profiles_with_email TO authenticated;

-- Enable RLS on the view
ALTER VIEW public.profiles_with_email SET (security_invoker = on);

-- Create RLS policy: Only admins can read this view
-- Note: Views inherit RLS from underlying tables, but we add explicit policy
CREATE POLICY "Admin can view profiles_with_email"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles admin_profile
        WHERE admin_profile.user_id = auth.uid()
        AND (admin_profile.settings->>'is_admin')::boolean = true
    )
    OR user_id = auth.uid()
);

-- Alternative: If the above doesn't work due to view limitations,
-- create a function instead
CREATE OR REPLACE FUNCTION public.get_profiles_with_email(
    p_limit INT DEFAULT 15,
    p_offset INT DEFAULT 0,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    email TEXT,
    current_rank TEXT,
    mindpoint INT,
    elo_rating INT,
    total_matches INT,
    total_wins INT,
    total_losses INT,
    coins INT,
    gems INT,
    settings JSONB,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Check if current user is admin
    SELECT (settings->>'is_admin')::boolean INTO is_admin
    FROM public.profiles
    WHERE profiles.user_id = auth.uid();
    
    IF NOT COALESCE(is_admin, false) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.user_id,
        p.username,
        p.display_name,
        u.email,
        p.current_rank,
        p.mindpoint,
        p.elo_rating,
        p.total_matches,
        p.total_wins,
        p.total_losses,
        p.coins,
        p.gems,
        p.settings,
        p.last_active,
        p.created_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.user_id = u.id
    WHERE (p_search IS NULL OR p_search = '' OR 
           p.username ILIKE '%' || p_search || '%' OR 
           p.display_name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_profiles_with_email TO authenticated;
