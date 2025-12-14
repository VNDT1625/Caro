# Implementation Plan

- [x] 1. Create useOnlinePlayers hook with Supabase Presence




  - [ ] 1.1 Create hook file with presence subscription logic
    - Set up Supabase Realtime presence channel for 'online-users'
    - Handle join/leave events to maintain online players list
    - Fetch player profiles from profiles table
    - _Requirements: 1.1, 1.2_
  - [x]* 1.2 Write property test for online list consistency

    - **Property 1: Online list real-time consistency**
    - **Validates: Requirements 1.2, 4.2**
  - [ ] 1.3 Implement filter functions (search, rank, friends)
    - Add searchQuery filter for username matching
    - Add rankFilter for rank-based filtering
    - Add friendsOnly filter using friends list
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 1.4 Write property tests for filter functions
    - **Property 3: Search filter correctness**




    - **Property 4: Rank filter correctness**
    - **Property 5: Friends filter correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. Create OnlinePlayersPanel component

  - [ ] 2.1 Create panel component with header showing online count
    - Display total online count in header
    - Show count breakdown by rank on hover tooltip
    - _Requirements: 4.1, 4.3_
  - [ ]* 2.2 Write property test for online count accuracy
    - **Property 6: Online count accuracy**
    - **Validates: Requirements 4.1**

  - [ ] 2.3 Implement player list with avatar, username, rank
    - Render PlayerCard for each online player
    - Show avatar (or placeholder), username, rank badge
    - Support scrollable list with virtual scrolling for performance
    - _Requirements: 1.3, 1.4_

  - [ ]* 2.4 Write property test for player display completeness
    - **Property 2: Player display completeness**

    - **Validates: Requirements 1.3**
  - [ ] 2.5 Add search box and filter controls
    - Add search input for username filtering
    - Add rank dropdown filter

    - Add "Friends Only" toggle
    - Show empty state when no matches
    - _Requirements: 3.1, 3.2, 3.3, 3.4_





- [x] 3. Create PlayerContextMenu component


  - [ ] 3.1 Implement context menu with action options
    - Show menu on player click with View Profile, Challenge, Message options




    - Position menu relative to click position

    - Close on outside click or escape key
    - _Requirements: 2.1_



  - [ ] 3.2 Implement action handlers
    - Challenge: Send game invitation via API
    - Message: Open DM chat panel
    - View Profile: Navigate to profile page
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 4. Integrate OnlinePlayersPanel into AiAnalysis page
  - [ ] 4.1 Add panel to right sidebar in desktop view
    - Show panel below analysis panel on desktop
    - Hide panel when user not authenticated
    - _Requirements: 1.1, 1.5_
  - [ ] 4.2 Add collapsible panel for mobile view
    - Create expandable drawer for mobile
    - Show online count badge when collapsed
    - _Requirements: 1.4_

- [ ] 5. Add i18n translations
  - [ ] 5.1 Add Vietnamese translations
    - Add keys for panel title, filters, empty states, actions
    - _Requirements: All_
  - [ ] 5.2 Add English translations
    - Add corresponding English translations
    - _Requirements: All_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
