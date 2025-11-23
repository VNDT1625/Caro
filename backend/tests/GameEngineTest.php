<?php
use PHPUnit\Framework\TestCase;
use App\GameEngine;

class GameEngineTest extends TestCase
{
    public function testNoWinner()
    {
        $board = [];
        $this->assertNull(GameEngine::checkWinner($board));
    }
    
    public function testHorizontalWin()
    {
        $board = [
            "0_0" => 'X',
            "1_0" => 'X',
            "2_0" => 'X',
            "3_0" => 'X',
            "4_0" => 'X'
        ];
        $this->assertEquals('X', GameEngine::checkWinner($board));
    }

    public function testVerticalWin()
    {
        $board = [
            "0_0" => 'O',
            "0_1" => 'O',
            "0_2" => 'O',
            "0_3" => 'O',
            "0_4" => 'O'
        ];
        $this->assertEquals('O', GameEngine::checkWinner($board));
    }

    public function testDiagonalWin()
    {
        $board = [
            "2_2" => 'X',
            "3_3" => 'X',
            "4_4" => 'X',
            "5_5" => 'X',
            "6_6" => 'X'
        ];
        $this->assertEquals('X', GameEngine::checkWinner($board));
    }

    public function testNoWinnerMixed()
    {
        $board = [
            "0_0" => 'X',
            "1_0" => 'O',
            "2_0" => 'X',
            "3_0" => 'O',
            "4_0" => 'X'
        ];
        $this->assertNull(GameEngine::checkWinner($board));
    }
}