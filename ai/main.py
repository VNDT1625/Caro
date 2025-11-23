from fastapi import FastAPI
from pydantic import BaseModel
import random

app = FastAPI(title='MindPoint Arena AI (skeleton)')

class SuggestRequest(BaseModel):
    board: dict
    mark: str

class SuggestResponse(BaseModel):
    x: int
    y: int
    mark: str

@app.post('/suggest_move', response_model=SuggestResponse)
async def suggest_move(req: SuggestRequest):
    # naive random empty cell suggestion
    occupied = set(req.board.keys())
    # search near existing stones first
    candidates = []
    for key in occupied:
        x,y = map(int, key.split('_'))
        for dx in range(-2,3):
            for dy in range(-2,3):
                nx, ny = x+dx, y+dy
                k = f"{nx}_{ny}"
                if k not in occupied:
                    candidates.append((nx, ny))
    if not candidates:
        # fallback to first empty in small range
        for x in range(-7,8):
            for y in range(-7,8):
                k = f"{x}_{y}"
                if k not in occupied:
                    candidates.append((x,y))
    nx, ny = random.choice(candidates)
    return { 'x': nx, 'y': ny, 'mark': req.mark }

@app.get('/health')
async def health():
    return {'status':'ok'}
