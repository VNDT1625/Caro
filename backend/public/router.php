<?php
// Router script for PHP built-in server
// Usage: php -S localhost:8001 router.php
// Note: Node.js socket server uses port 8000, so PHP backend uses 8001
// Or: cd backend/public && php -S localhost:8001 router.php

// Set CORS headers early in router
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

if (in_array($origin, $allowedOrigins)) {
  header("Access-Control-Allow-Origin: $origin");
} else {
  // Fallback: cho phép tất cả origins trong dev mode
  header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// PHP built-in server may not parse Authorization header - parse manually
if (!isset($_SERVER['HTTP_AUTHORIZATION'])) {
    // Try to get from getallheaders()
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $_SERVER['HTTP_AUTHORIZATION'] = $headers['authorization'];
        }
    }
    // If still not set, try REDIRECT_HTTP_AUTHORIZATION
    if (!isset($_SERVER['HTTP_AUTHORIZATION']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Debug: log requests (uncomment to debug)
// error_log("Router: $uri");

// If the file exists and is not a PHP file, serve it directly
if ($uri !== '/' && $uri !== '/index.php' && file_exists(__DIR__ . $uri) && !preg_match('/\.php$/', $uri)) {
    return false; // Serve the file as-is
}

// Otherwise, route everything to index.php
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/index.php';

