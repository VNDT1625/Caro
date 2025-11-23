<?php
namespace App;

class GameEngine
{
    // Simple placeholder for shared game rules (server-authoritative)
    public static function checkWinner(array $board): ?string
    {
        // board: associative array with keys "x_y" => 'X' or 'O'
        // Return 'X' or 'O' if winner, or null
        if (empty($board)) {
            return null;
        }

        // Build position sets for X and O
        $positions = ['X' => [], 'O' => []];
        foreach ($board as $key => $val) {
            if (!in_array($val, ['X', 'O'])) continue;
            $parts = explode('_', $key);
            if (count($parts) !== 2) continue;
            $x = intval($parts[0]);
            $y = intval($parts[1]);
            $positions[$val]["{$x}_{$y}"] = true;
        }

        $dirs = [
            [1, 0], // ngang
            [0, 1], // dọc
            [1, 1], // chéo chính
            [1, -1] // chéo phụ
        ];

        foreach (['X', 'O'] as $player) {
            foreach ($positions[$player] as $key => $_) {
                $parts = explode('_', $key);
                $x0 = intval($parts[0]);
                $y0 = intval($parts[1]);

                foreach ($dirs as $d) {
                    $dx = $d[0];
                    $dy = $d[1];
                    $count = 1;
                    // forward
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 + $dx * $i) . "_" . ($y0 + $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    // backward
                    $i = 1;
                    while (isset($positions[$player]["" . ($x0 - $dx * $i) . "_" . ($y0 - $dy * $i)])) {
                        $count++;
                        $i++;
                    }
                    if ($count >= 5) {
                        return $player;
                    }
                }
            }
        }

        return null;
    }

    // Faster check that only inspects lines through the last move.
    // x0, y0: coordinates of the last placed stone.
    // Returns 'X' or 'O' if that move caused a win, otherwise null.
    public static function checkWinnerLastMove(array $board, int $x0, int $y0): ?string
    {
        // Build quick lookup of positions (same as checkWinner)
        $positions = ['X' => [], 'O' => []];
        foreach ($board as $key => $val) {
            if (!in_array($val, ['X', 'O'])) continue;
            $parts = explode('_', $key);
            if (count($parts) !== 2) continue;
            $x = intval($parts[0]);
            $y = intval($parts[1]);
            $positions[$val]["{$x}_{$y}"] = true;
        }

        $keyLast = "{$x0}_{$y0}";
        // If there is no stone at the last move, nothing to check
        $player = null;
        if (isset($positions['X'][$keyLast])) {
            $player = 'X';
        } elseif (isset($positions['O'][$keyLast])) {
            $player = 'O';
        } else {
            return null;
        }

        $dirs = [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1]
        ];

        foreach ($dirs as $d) {
            $dx = $d[0];
            $dy = $d[1];
            $count = 1;

            // forward direction
            $i = 1;
            while (isset($positions[$player]["" . ($x0 + $dx * $i) . "_" . ($y0 + $dy * $i)])) {
                $count++;
                $i++;
            }

            // backward direction
            $i = 1;
            while (isset($positions[$player]["" . ($x0 - $dx * $i) . "_" . ($y0 - $dy * $i)])) {
                $count++;
                $i++;
            }

            if ($count >= 5) {
                return $player;
            }
        }

        return null;
    }
}