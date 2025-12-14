# Hướng dẫn chạy 2 AI song song

## Thực tế
- **Kiro**: KHÔNG thể chạy hoàn toàn tự động (cần user interaction khi gặp lỗi)
- **GPT CLI**: Có thể chạy lâu hơn với `--full-auto` nhưng vẫn có giới hạn

## Cách tốt nhất: Chạy GPT CLI liên tục, Kiro làm khi bạn thức

### Bước 1: Mở 2 terminal

**Terminal 1 - GPT CLI (chạy qua đêm):**
```powershell
cd C:\PJ\caro
codex --model o3 --full-auto
```
Paste prompt này:
```
Đọc file scripts/ai-orchestrator/prompts/gpt_master_prompt.md và làm theo.
Làm Payment System trước, sau đó AI Training.
Cập nhật scripts/ai-orchestrator/gpt_status.json sau mỗi bước.
KHÔNG DỪNG cho đến khi xong tất cả tasks.
```

**Terminal 2 - Kiro (khi bạn thức):**
- Mở Kiro IDE
- Paste: "Đọc scripts/ai-orchestrator/prompts/for_kiro.md và làm Ranked BO3 System"

### Bước 2: Khi bạn dậy

1. Check `scripts/ai-orchestrator/gpt_status.json` xem GPT làm được gì
2. Check `scripts/ai-orchestrator/kiro_status.json` xem Kiro làm được gì
3. Nếu GPT dừng, paste prompt mới để nó tiếp tục
4. Nếu Kiro dừng, click "Keep going" hoặc paste prompt mới

## Phân công công việc

| AI | Tasks | Priority |
|----|-------|----------|
| GPT CLI | Payment System, AI Training Upgrade | Chạy qua đêm |
| Kiro | Ranked BO3 System, Fix AI Chat | Khi bạn thức |

## Files quan trọng

- `gpt_status.json` - GPT ghi trạng thái
- `kiro_status.json` - Kiro ghi trạng thái  
- `prompts/for_gpt.md` - Prompt cho GPT
- `prompts/for_kiro.md` - Prompt cho Kiro

## Mẹo

1. GPT CLI với `--full-auto` sẽ chạy lâu hơn Kiro
2. Nếu GPT gặp lỗi, nó sẽ ghi vào `gpt_status.json`
3. Sáng dậy check status files trước
