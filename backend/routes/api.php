<?php
    
/**
 * API Routes Configuration
 * 
 * This file defines all API routes for the Report Violation System.
 * Routes are organized by feature and include middleware configuration.
 * 
 * Route structure:
 * - method: HTTP method (GET, POST, PUT, DELETE)
 * - path: URL pattern (supports {param} placeholders)
 * - handler: Controller method to call
 * - middleware: Array of middleware to apply
 * - auth: Whether authentication is required
 * - admin: Whether admin authorization is required
 */

return [
    // ============================================================================
    // REPORT VIOLATION SYSTEM ROUTES
    // ============================================================================

    // Public/User Routes
    [
        'method' => 'POST',
        'path' => '/api/reports',
        'handler' => ['ReportController', 'store'],
        'middleware' => ['rate_limit:report'],
        'auth' => true,
        'admin' => false,
        'description' => 'Create a new report',
        'validates' => 'Requirements 1.1, 1.5',
    ],

    // Admin Report Routes
    [
        'method' => 'GET',
        'path' => '/api/reports',
        'handler' => ['ReportController', 'index'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'List all reports (admin)',
        'validates' => 'Requirements 9.1',
    ],
    [
        'method' => 'GET',
        'path' => '/api/reports/{id}',
        'handler' => ['ReportController', 'show'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Get report detail (admin)',
        'validates' => 'Requirements 9.2',
    ],
    [
        'method' => 'PUT',
        'path' => '/api/reports/{id}',
        'handler' => ['ReportController', 'update'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Update report (admin)',
        'validates' => 'Requirements 9.3, 9.4',
    ],

    // ============================================================================
    // APPEAL SYSTEM ROUTES
    // ============================================================================

    // User Appeal Routes
    [
        'method' => 'POST',
        'path' => '/api/appeals',
        'handler' => ['AppealController', 'store'],
        'middleware' => ['rate_limit:appeal'],
        'auth' => true,
        'admin' => false,
        'description' => 'Create a new appeal',
        'validates' => 'Requirements 7.1',
    ],

    // Admin Appeal Routes
    [
        'method' => 'GET',
        'path' => '/api/appeals',
        'handler' => ['AppealController', 'index'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'List all appeals (admin)',
        'validates' => 'Requirements 9.5',
    ],
    [
        'method' => 'GET',
        'path' => '/api/appeals/{id}',
        'handler' => ['AppealController', 'show'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Get appeal detail (admin)',
        'validates' => 'Requirements 9.5',
    ],
    [
        'method' => 'PUT',
        'path' => '/api/appeals/{id}',
        'handler' => ['AppealController', 'update'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Process appeal (admin)',
        'validates' => 'Requirements 7.5',
    ],

    // ============================================================================
    // BAN SYSTEM ROUTES
    // ============================================================================

    // User Ban Routes
    [
        'method' => 'GET',
        'path' => '/api/bans/status',
        'handler' => ['BanController', 'status'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Check current user ban status',
        'validates' => 'Requirements 6.3',
    ],

    // Admin Ban Routes
    [
        'method' => 'POST',
        'path' => '/api/admin/bans',
        'handler' => ['BanController', 'store'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Create a new ban (admin)',
        'validates' => 'Requirements 6.1, 6.2',
    ],
    [
        'method' => 'GET',
        'path' => '/api/admin/bans',
        'handler' => ['BanController', 'index'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'List all bans (admin)',
        'validates' => 'Requirements 9.1',
    ],
    [
        'method' => 'GET',
        'path' => '/api/admin/bans/{id}',
        'handler' => ['BanController', 'show'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Get ban detail (admin)',
        'validates' => 'Requirements 9.1',
    ],
    [
        'method' => 'POST',
        'path' => '/api/admin/bans/{id}/lift',
        'handler' => ['BanController', 'lift'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Lift a ban (admin)',
        'validates' => 'Requirements 7.5',
    ],
    [
        'method' => 'GET',
        'path' => '/api/admin/bans/user/{userId}',
        'handler' => ['BanController', 'userHistory'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Get ban history for a user (admin)',
        'validates' => 'Requirements 9.1',
    ],

    // ============================================================================
    // RANKED BO3 SERIES ROUTES
    // ============================================================================

    // Series Management Routes
    [
        'method' => 'POST',
        'path' => '/api/series/create',
        'handler' => ['SeriesController', 'create'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Create a new ranked BO3 series (called from matchmaking)',
        'validates' => 'Requirements 1.1',
    ],
    [
        'method' => 'GET',
        'path' => '/api/series/{id}',
        'handler' => ['SeriesController', 'show'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get series state',
        'validates' => 'Requirements 9.3',
    ],
    [
        'method' => 'POST',
        'path' => '/api/series/{id}/end-game',
        'handler' => ['SeriesController', 'endGame'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'End a game within the series',
        'validates' => 'Requirements 2.1',
    ],
    [
        'method' => 'POST',
        'path' => '/api/series/{id}/forfeit',
        'handler' => ['SeriesController', 'forfeit'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Forfeit current game',
        'validates' => 'Requirements 7.3',
    ],
    [
        'method' => 'POST',
        'path' => '/api/series/{id}/abandon',
        'handler' => ['SeriesController', 'abandon'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Abandon entire series',
        'validates' => 'Requirements 7.4',
    ],
    [
        'method' => 'POST',
        'path' => '/api/series/{id}/rematch',
        'handler' => ['SeriesController', 'rematch'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Request rematch after series ends',
        'validates' => 'Requirements 10.1, 10.2',
    ],
    [
        'method' => 'POST',
        'path' => '/api/series/{id}/forfeit-disconnect',
        'handler' => ['SeriesController', 'forfeitDisconnect'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Forfeit game due to disconnect (auto-win for remaining player)',
        'validates' => 'Requirements 1.4, 1.5, 2.1, 2.2 (ranked-disconnect-auto-win)',
    ],

    // ============================================================================
    // PAYMENT (VNPay demo)
    // ============================================================================
    [
        'method' => 'POST',
        'path' => '/api/payment/create',
        'handler' => ['PaymentController', 'create'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Tao lien ket thanh toan',
        'validates' => 'Payment create',
    ],
    [
        'method' => 'POST',
        'path' => '/api/payment/webhook',
        'handler' => ['PaymentController', 'webhook'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Nhan IPN/return',
        'validates' => 'Payment webhook',
    ],
    [
        'method' => 'GET',
        'path' => '/api/payment/status/{txnRef}',
        'handler' => ['PaymentController', 'status'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Xem trang thai giao dich',
        'validates' => 'Payment status',
    ],
    [
        'method' => 'POST',
        'path' => '/api/payment/test',
        'handler' => ['PaymentController', 'testActivate'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Test activate subscription (dev only)',
        'validates' => 'Payment test',
    ],
    [
        'method' => 'GET',
        'path' => '/payment-return',
        'handler' => ['PaymentController', 'returnPage'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'VNPay return redirect page',
        'validates' => 'Payment return',
    ],

    // ============================================================================
    // DATASET SEARCH API (Server-side search để giảm tải frontend)
    // ============================================================================
    [
        'method' => 'POST',
        'path' => '/api/dataset/search',
        'handler' => ['DatasetController', 'search'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Search dataset for matching answer (server-side)',
        'validates' => 'Dataset search',
    ],
    [
        'method' => 'GET',
        'path' => '/api/dataset/stats',
        'handler' => ['DatasetController', 'stats'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get dataset statistics',
        'validates' => 'Dataset stats',
    ],

    // ============================================================================
    // CURRENCY (Coin/Gem Purchase)
    // ============================================================================
    [
        'method' => 'GET',
        'path' => '/api/currency/packages',
        'handler' => ['CurrencyController', 'getPackages'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get available currency packages',
        'validates' => 'Currency packages',
    ],
    [
        'method' => 'POST',
        'path' => '/api/currency/purchase',
        'handler' => ['CurrencyController', 'createPurchase'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Create currency purchase (VNPay)',
        'validates' => 'Currency purchase',
    ],
    [
        'method' => 'POST',
        'path' => '/api/currency/webhook',
        'handler' => ['CurrencyController', 'webhook'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Currency payment webhook',
        'validates' => 'Currency webhook',
    ],
    [
        'method' => 'GET',
        'path' => '/api/currency/status/{txnRef}',
        'handler' => ['CurrencyController', 'getStatus'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get purchase status',
        'validates' => 'Currency status',
    ],
    [
        'method' => 'GET',
        'path' => '/api/currency/history',
        'handler' => ['CurrencyController', 'getHistory'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get user purchase history',
        'validates' => 'Currency history',
    ],
    [
        'method' => 'GET',
        'path' => '/api/currency/balance',
        'handler' => ['CurrencyController', 'getBalance'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get user balance',
        'validates' => 'Currency balance',
    ],
    [
        'method' => 'POST',
        'path' => '/api/currency/test',
        'handler' => ['CurrencyController', 'testPurchase'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Test currency purchase (dev only)',
        'validates' => 'Currency test',
    ],
    [
        'method' => 'GET',
        'path' => '/currency-return',
        'handler' => ['CurrencyController', 'returnPage'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Currency payment return redirect',
        'validates' => 'Currency return',
    ],

    // ============================================================================
    // NOTIFICATION INBOX ROUTES
    // ============================================================================

    // User Notification Routes
    [
        'method' => 'GET',
        'path' => '/api/notifications/inbox',
        'handler' => ['NotificationController', 'inbox'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get user inbox',
        'validates' => 'Requirements 2.1, 2.2',
    ],
    [
        'method' => 'GET',
        'path' => '/api/notifications/unread-count',
        'handler' => ['NotificationController', 'unreadCount'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get unread notification count',
        'validates' => 'Requirements 2.5',
    ],
    [
        'method' => 'GET',
        'path' => '/api/notifications/{id}',
        'handler' => ['NotificationController', 'show'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get notification detail',
        'validates' => 'Requirements 2.3, 2.4',
    ],
    [
        'method' => 'POST',
        'path' => '/api/notifications/{id}/read',
        'handler' => ['NotificationController', 'markRead'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Mark notification as read',
        'validates' => 'Requirements 3.2',
    ],
    [
        'method' => 'POST',
        'path' => '/api/notifications/read-all',
        'handler' => ['NotificationController', 'markAllRead'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Mark all notifications as read',
        'validates' => 'Requirements 3.3',
    ],
    [
        'method' => 'DELETE',
        'path' => '/api/notifications/{id}',
        'handler' => ['NotificationController', 'delete'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Delete notification for user',
        'validates' => 'Requirements 3.1, 3.4',
    ],
    [
        'method' => 'POST',
        'path' => '/api/notifications/{id}/claim-gift',
        'handler' => ['NotificationController', 'claimGift'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Claim gift from notification',
        'validates' => 'Gift notification feature',
    ],

    // Admin Notification Routes
    [
        'method' => 'POST',
        'path' => '/api/admin/notifications',
        'handler' => ['NotificationController', 'send'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Admin send notification',
        'validates' => 'Requirements 1.1, 1.2, 1.3',
    ],
    [
        'method' => 'GET',
        'path' => '/api/admin/notifications/sent',
        'handler' => ['NotificationController', 'sent'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Admin view sent notifications',
        'validates' => 'Requirements 4.1',
    ],
    [
        'method' => 'GET',
        'path' => '/api/admin/notifications/{id}/stats',
        'handler' => ['NotificationController', 'stats'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Get notification read stats',
        'validates' => 'Requirements 4.2',
    ],
    [
        'method' => 'DELETE',
        'path' => '/api/admin/notifications/{id}',
        'handler' => ['NotificationController', 'adminDelete'],
        'middleware' => [],
        'auth' => true,
        'admin' => true,
        'description' => 'Admin delete notification (cascade)',
        'validates' => 'Requirements 4.3',
    ],

    // ============================================================================
    // SKILL SYSTEM ROUTES
    // ============================================================================

    // Season Routes
    [
        'method' => 'GET',
        'path' => '/api/seasons/current',
        'handler' => ['SkillController', 'getCurrentSeason'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get current active season',
        'validates' => 'Skill System AC1',
    ],

    // Skill Routes
    [
        'method' => 'GET',
        'path' => '/api/skills',
        'handler' => ['SkillController', 'getSkills'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get skills for a season',
        'validates' => 'Skill System AC1',
    ],
    [
        'method' => 'GET',
        'path' => '/api/skills/recommended',
        'handler' => ['SkillController', 'getRecommendedCombo'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get recommended skill combo by playstyle',
        'validates' => 'Skill System AC5',
    ],
    [
        'method' => 'GET',
        'path' => '/api/skills/{id}',
        'handler' => ['SkillController', 'getSkillById'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Get skill detail',
        'validates' => 'Skill System AC1',
    ],

    // User Skill Routes
    [
        'method' => 'GET',
        'path' => '/api/user/skills',
        'handler' => ['SkillController', 'getUserSkills'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get user unlocked skills',
        'validates' => 'Skill System AC6',
    ],
    [
        'method' => 'GET',
        'path' => '/api/user/combos',
        'handler' => ['SkillController', 'getUserCombos'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get user skill combos',
        'validates' => 'Skill System AC2',
    ],
    [
        'method' => 'POST',
        'path' => '/api/user/combos',
        'handler' => ['SkillController', 'saveCombo'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Save skill combo',
        'validates' => 'Skill System AC2',
    ],
    [
        'method' => 'POST',
        'path' => '/api/user/combos/active',
        'handler' => ['SkillController', 'setActiveCombo'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Set active combo preset',
        'validates' => 'Skill System AC2',
    ],

    // In-Game Skill Routes
    [
        'method' => 'POST',
        'path' => '/api/match/{id}/skill/random',
        'handler' => ['SkillController', 'getRandomSkillsForTurn'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get random skills for current turn',
        'validates' => 'Skill System AC3',
    ],
    [
        'method' => 'POST',
        'path' => '/api/match/{id}/skill/use',
        'handler' => ['SkillController', 'useSkill'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Use a skill in match',
        'validates' => 'Skill System AC3',
    ],

    // ============================================================================
    // SWAP 2 OPENING RULE ROUTES
    // ============================================================================
    [
        'method' => 'POST',
        'path' => '/api/swap2/initialize',
        'handler' => ['Swap2Controller', 'initialize'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Initialize Swap 2 for a game',
        'validates' => 'Requirements 7.3',
    ],
    [
        'method' => 'POST',
        'path' => '/api/swap2/place-stone',
        'handler' => ['Swap2Controller', 'placeStone'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Place a stone during Swap 2',
        'validates' => 'Requirements 7.1',
    ],
    [
        'method' => 'POST',
        'path' => '/api/swap2/make-choice',
        'handler' => ['Swap2Controller', 'makeChoice'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Make a color choice during Swap 2',
        'validates' => 'Requirements 7.2',
    ],
    [
        'method' => 'GET',
        'path' => '/api/swap2/state/{roomId}',
        'handler' => ['Swap2Controller', 'getState'],
        'middleware' => [],
        'auth' => true,
        'admin' => false,
        'description' => 'Get current Swap 2 state',
        'validates' => 'Requirements 7.1',
    ],

    // ============================================================================
    // AI PROXY ROUTES (bypass browser extension interference)
    // ============================================================================
    [
        'method' => 'POST',
        'path' => '/api/ai/analyze',
        'handler' => ['AIProxyController', 'analyze'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy analyze request to AI service',
        'validates' => 'AI Analysis proxy',
    ],
    [
        'method' => 'GET',
        'path' => '/api/ai/usage',
        'handler' => ['AIProxyController', 'usage'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy usage request to AI service',
        'validates' => 'AI Usage proxy',
    ],
    [
        'method' => 'POST',
        'path' => '/api/ai/ask',
        'handler' => ['AIProxyController', 'ask'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy ask request to AI service',
        'validates' => 'AI Ask proxy',
    ],
    [
        'method' => 'POST',
        'path' => '/api/ai/replay/create',
        'handler' => ['AIProxyController', 'replayCreate'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy replay create to AI service',
        'validates' => 'AI Replay proxy',
    ],
    [
        'method' => 'POST',
        'path' => '/api/ai/replay/navigate',
        'handler' => ['AIProxyController', 'replayNavigate'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy replay navigate to AI service',
        'validates' => 'AI Replay proxy',
    ],
    [
        'method' => 'POST',
        'path' => '/api/ai/replay/play',
        'handler' => ['AIProxyController', 'replayPlay'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy replay play to AI service',
        'validates' => 'AI Replay proxy',
    ],
    [
        'method' => 'GET',
        'path' => '/api/ai/health',
        'handler' => ['AIProxyController', 'health'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Proxy health check to AI service',
        'validates' => 'AI Health proxy',
    ],

    // ============================================================================
    // DEBUG ROUTES (remove in production)
    // ============================================================================
    [
        'method' => 'GET',
        'path' => '/api/debug/notifications',
        'handler' => ['NotificationController', 'debugNotifications'],
        'middleware' => [],
        'auth' => false,
        'admin' => false,
        'description' => 'Debug: Check notifications with gift_data',
        'validates' => 'Debug only',
    ],
];
