<?php

namespace Bootstrap;

use App\Services\ReportService;
use App\Services\ReportServiceInterface;
use App\Services\RuleEngineService;
use App\Services\RuleEngineServiceInterface;
use App\Services\AIAnalysisService;
use App\Services\AIAnalysisServiceInterface;
use App\Services\BanService;
use App\Services\BanServiceInterface;
use App\Services\AppealService;
use App\Services\AppealServiceInterface;
use App\Services\ScoringEngineService;
use App\Services\ScoringEngineServiceInterface;
use App\Services\SeriesManagerService;
use App\Services\SeriesManagerServiceInterface;
use App\Services\RankManagerService;
use App\Services\RankManagerServiceInterface;
use App\Services\DisconnectHandlerService;
use App\Services\DisconnectHandlerServiceInterface;
use App\Services\PaymentService;
use App\Services\PaymentServiceInterface;
use App\Services\SubscriptionService;
use App\Services\SubscriptionServiceInterface;
use App\Services\CurrencyService;
use App\Services\CurrencyServiceInterface;
use App\Services\NotificationService;
use App\Services\NotificationServiceInterface;
use App\Controllers\ReportController;
use App\Controllers\AppealController;
use App\Controllers\BanController;
use App\Controllers\SeriesController;
use App\Controllers\PaymentController;
use App\Controllers\CurrencyController;
use App\Controllers\NotificationController;
use App\Controllers\SkillController;
use App\Services\SkillService;
use App\Services\SkillServiceInterface;
use App\Services\SeasonService;
use App\Services\SeasonServiceInterface;
use App\Services\ComboService;
use App\Services\ComboServiceInterface;
use App\Services\SkillEngineService;
use App\Services\SkillEngineServiceInterface;
use App\Services\SkillRandomizerService;
use App\Services\SkillRandomizerServiceInterface;
use App\Services\ManaService;
use App\Services\ManaServiceInterface;
use App\Services\MatchSkillStateService;

/**
 * ServiceProvider
 * 
 * Centralized service registration and dependency injection container.
 * Binds interfaces to implementations and provides factory methods for controllers.
 * 
 * This class follows the Service Locator pattern to manage dependencies
 * without requiring a full DI container framework.
 */
class ServiceProvider
{
    /** @var array<string, object> Singleton instances */
    private static array $instances = [];

    /** @var array<string, callable> Factory functions for services */
    private static array $factories = [];

    /** @var bool Whether the provider has been booted */
    private static bool $booted = false;

    /**
     * Boot the service provider.
     * Registers all service bindings.
     */
    public static function boot(): void
    {
        if (self::$booted) {
            return;
        }

        // Register service factories
        self::registerServices();
        
        self::$booted = true;
    }

    /**
     * Register all service bindings.
     * Binds interfaces to their concrete implementations.
     */
    private static function registerServices(): void
    {
        // Rule Engine Service (singleton)
        self::$factories[RuleEngineServiceInterface::class] = function () {
            return new RuleEngineService();
        };

        // AI Analysis Service (singleton)
        self::$factories[AIAnalysisServiceInterface::class] = function () {
            return new AIAnalysisService();
        };

        // Ban Service (singleton with database)
        self::$factories[BanServiceInterface::class] = function () {
            $service = new BanService();
            $db = self::getDatabase();
            if ($db !== null) {
                $service->setDatabase($db);
            }
            return $service;
        };

        // Report Service (depends on RuleEngine, AIAnalysis, BanService, and Supabase)
        self::$factories[ReportServiceInterface::class] = function () {
            $service = new ReportService(
                self::resolve(RuleEngineServiceInterface::class),
                self::resolve(AIAnalysisServiceInterface::class),
                self::resolve(BanServiceInterface::class)
            );
            // Set Supabase client for REST API operations (preferred)
            $supabase = self::getSupabaseClient();
            if ($supabase !== null) {
                $service->setSupabase($supabase);
            }
            // Also set database connection as fallback
            $db = self::getDatabase();
            if ($db !== null) {
                $service->setDatabase($db);
            }
            return $service;
        };

        // Appeal Service (depends on BanService)
        self::$factories[AppealServiceInterface::class] = function () {
            return new AppealService(
                self::resolve(BanServiceInterface::class)
            );
        };

        // Scoring Engine Service (singleton)
        self::$factories[ScoringEngineServiceInterface::class] = function () {
            return new ScoringEngineService();
        };

        // Series Manager Service (depends on ScoringEngine)
        self::$factories[SeriesManagerServiceInterface::class] = function () {
            $service = new SeriesManagerService();
            $service->setScoringEngine(self::resolve(ScoringEngineServiceInterface::class));
            return $service;
        };

        // Rank Manager Service (singleton)
        self::$factories[RankManagerServiceInterface::class] = function () {
            return new RankManagerService();
        };

        // Disconnect Handler Service (depends on SeriesManager)
        self::$factories[DisconnectHandlerServiceInterface::class] = function () {
            $service = new DisconnectHandlerService();
            $service->setSeriesManager(self::resolve(SeriesManagerServiceInterface::class));
            return $service;
        };

        // Subscription Service (singleton)
        self::$factories[SubscriptionServiceInterface::class] = function () {
            return new SubscriptionService();
        };

        // Payment Service (depends on database connection)
        self::$factories[PaymentServiceInterface::class] = function () {
            $db = self::getDatabase();
            return new PaymentService(
                getenv('VNPAY_TMN_CODE'),
                getenv('VNPAY_HASH_SECRET'),
                getenv('VNPAY_RETURN_URL'),
                getenv('VNPAY_IPN_URL'),
                getenv('VNPAY_GATEWAY_URL'),
                $db
            );
        };

        // Currency Service (coin/gem purchase)
        self::$factories[CurrencyServiceInterface::class] = function () {
            $db = self::getDatabase();
            return new CurrencyService($db);
        };

        // Notification Service (admin inbox)
        self::$factories[NotificationServiceInterface::class] = function () {
            return new NotificationService();
        };

        // Skill System Services
        self::$factories[SkillServiceInterface::class] = function () {
            $db = self::getDatabaseWrapper();
            return new SkillService($db);
        };

        self::$factories[SeasonServiceInterface::class] = function () {
            $db = self::getDatabaseWrapper();
            return new SeasonService($db);
        };

        self::$factories[ComboServiceInterface::class] = function () {
            $db = self::getDatabaseWrapper();
            return new ComboService(
                $db,
                self::resolve(SkillServiceInterface::class),
                self::resolve(SeasonServiceInterface::class)
            );
        };

        self::$factories[SkillEngineServiceInterface::class] = function () {
            $db = self::getDatabaseWrapper();
            return new SkillEngineService(
                $db,
                self::resolve(SkillServiceInterface::class)
            );
        };

        self::$factories[SkillRandomizerServiceInterface::class] = function () {
            return new SkillRandomizerService(
                self::resolve(SkillServiceInterface::class)
            );
        };

        // Mana Service (skill system)
        self::$factories[ManaServiceInterface::class] = function () {
            return new ManaService();
        };

        // Match Skill State (file-based)
        self::$factories[MatchSkillStateService::class] = function () {
            return new MatchSkillStateService(self::getDatabase());
        };
    }

    /**
     * Resolve a service from the container.
     * 
     * @param string $abstract The interface or class name to resolve
     * @return object The resolved service instance
     * @throws \RuntimeException If the service is not registered
     */
    public static function resolve(string $abstract): object
    {
        self::boot();

        // Return cached singleton if exists
        if (isset(self::$instances[$abstract])) {
            return self::$instances[$abstract];
        }

        // Create new instance using factory
        if (isset(self::$factories[$abstract])) {
            $instance = self::$factories[$abstract]();
            self::$instances[$abstract] = $instance;
            return $instance;
        }

        throw new \RuntimeException("Service not registered: {$abstract}");
    }

    /**
     * Create a ReportController with all dependencies injected.
     * 
     * @return ReportController
     */
    public static function createReportController(): ReportController
    {
        return new ReportController(
            self::resolve(ReportServiceInterface::class),
            self::resolve(BanServiceInterface::class)
        );
    }

    /**
     * Create an AppealController with all dependencies injected.
     * 
     * @return AppealController
     */
    public static function createAppealController(): AppealController
    {
        return new AppealController(
            self::resolve(AppealServiceInterface::class)
        );
    }

    /**
     * Create a BanController with all dependencies injected.
     * 
     * @return BanController
     */
    public static function createBanController(): BanController
    {
        return new BanController(
            self::resolve(BanServiceInterface::class)
        );
    }

    /**
     * Create a SeriesController with all dependencies injected.
     * 
     * @return SeriesController
     */
    public static function createSeriesController(): SeriesController
    {
        return new SeriesController(
            self::resolve(SeriesManagerServiceInterface::class)
        );
    }

    /**
     * Create a PaymentController with all dependencies injected.
     * 
     * @return PaymentController
     */
    public static function createPaymentController(): PaymentController
    {
        return new PaymentController(
            self::resolve(PaymentServiceInterface::class),
            self::resolve(SubscriptionServiceInterface::class)
        );
    }

    /**
     * Create a CurrencyController with all dependencies injected.
     * 
     * @return CurrencyController
     */
    public static function createCurrencyController(): CurrencyController
    {
        return new CurrencyController(
            self::resolve(CurrencyServiceInterface::class)
        );
    }

    /**
     * Create a NotificationController with all dependencies injected.
     * 
     * @return NotificationController
     */
    public static function createNotificationController(): NotificationController
    {
        return new NotificationController(
            self::resolve(NotificationServiceInterface::class)
        );
    }

    /**
     * Create a SkillController with all dependencies injected.
     * 
     * @return SkillController
     */
    public static function createSkillController(): SkillController
    {
        return new SkillController(
            self::resolve(SkillServiceInterface::class),
            self::resolve(SeasonServiceInterface::class),
            self::resolve(ComboServiceInterface::class),
            self::resolve(SkillEngineServiceInterface::class),
            self::resolve(SkillRandomizerServiceInterface::class),
            self::resolve(MatchSkillStateService::class)
        );
    }

    /**
     * Get Database wrapper instance.
     * Uses SupabaseDatabase (REST API) if PDO is not available.
     * 
     * @return \App\Database
     */
    private static function getDatabaseWrapper(): \App\Database
    {
        $pdo = self::getDatabase();
        
        // If PDO connection failed, use Supabase REST API
        if ($pdo === null) {
            $supabaseClient = self::getSupabaseClient();
            if ($supabaseClient !== null) {
                return new \App\SupabaseDatabase($supabaseClient);
            }
        }
        
        return new \App\Database($pdo);
    }

    /**
     * Get database connection.
     * Uses Supabase PostgreSQL if configured, otherwise falls back to MySQL.
     * 
     * @return \PDO|null
     */
    private static function getDatabase(): ?\PDO
    {
        // Try Supabase PostgreSQL first
        $supabaseUrl = getenv('SUPABASE_URL');
        if ($supabaseUrl) {
            try {
                // Parse Supabase URL to get host
                // Format: https://PROJECT_REF.supabase.co
                $parsed = parse_url($supabaseUrl);
                $host = $parsed['host'] ?? null;
                
                if ($host) {
                    // Supabase PostgreSQL connection
                    // Host: db.PROJECT_REF.supabase.co
                    $projectRef = explode('.', $host)[0];
                    $pgHost = "db.{$projectRef}.supabase.co";
                    $pgPort = 5432;
                    $pgDatabase = 'postgres';
                    $pgUsername = 'postgres';
                    // Use service key as password (or dedicated DB password if set)
                    $pgPassword = getenv('SUPABASE_DB_PASSWORD') ?: getenv('SUPABASE_SERVICE_KEY');
                    
                    // Check if we should skip SSL verification
                    $skipSsl = getenv('SUPABASE_SKIP_SSL_VERIFY') === '1';
                    
                    $dsn = "pgsql:host={$pgHost};port={$pgPort};dbname={$pgDatabase}";
                    $options = [
                        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                    ];
                    
                    // Note: PDO pgsql doesn't support SSL options directly in DSN
                    // For production, configure SSL at server level
                    
                    return new \PDO($dsn, $pgUsername, $pgPassword, $options);
                }
            } catch (\Exception $e) {
                error_log("Supabase PostgreSQL connection failed: " . $e->getMessage());
                // Fall through to MySQL
            }
        }
        
        // Fallback to MySQL
        try {
            $host = getenv('DB_HOST') ?: '127.0.0.1';
            $port = getenv('DB_PORT') ?: 3306;
            $database = getenv('DB_DATABASE') ?: 'mindpoint';
            $username = getenv('DB_USERNAME') ?: 'root';
            $password = getenv('DB_PASSWORD') ?: '';

            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
            return new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            ]);
        } catch (\Exception $e) {
            error_log("MySQL connection failed: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get Supabase client instance.
     * 
     * @return \App\Services\SupabaseClient|null
     */
    private static function getSupabaseClient(): ?\App\Services\SupabaseClient
    {
        $url = getenv('SUPABASE_URL');
        $key = getenv('SUPABASE_SERVICE_KEY') ?: getenv('SUPABASE_ANON_KEY');
        
        if (empty($url) || empty($key)) {
            return null;
        }
        
        return new \App\Services\SupabaseClient($url, $key);
    }

    /**
     * Clear all cached instances.
     * Useful for testing.
     */
    public static function flush(): void
    {
        self::$instances = [];
        self::$booted = false;
    }

    /**
     * Register a custom factory for a service.
     * Useful for testing with mocks.
     * 
     * @param string $abstract The interface or class name
     * @param callable $factory Factory function that returns the service
     */
    public static function register(string $abstract, callable $factory): void
    {
        self::$factories[$abstract] = $factory;
        // Clear cached instance if exists
        unset(self::$instances[$abstract]);
    }
}
