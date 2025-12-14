#!/bin/bash
echo "Starting PHP server with router on port 8001..."
echo "(Node.js socket server uses port 8000)"
cd public
php -S localhost:8001 router.php

