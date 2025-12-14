// Script để chia nhỏ caro_dataset.jsonl thành các file nhỏ hơn
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../frontend/public/caro_dataset.jsonl');
const OUTPUT_DIR = path.join(__dirname, '../frontend/public/datasets');
const MAX_SIZE_KB = 500; // Mỗi file tối đa 500KB

// Tạo thư mục output nếu chưa có
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Đọc file gốc
const content = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

console.log(`Tổng số entries: ${lines.length}`);
console.log(`Kích thước file gốc: ${(fs.statSync(INPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);

// Chia thành các chunks
let currentChunk = [];
let currentSize = 0;
let chunkIndex = 1;
const chunks = [];

for (const line of lines) {
  const lineSize = Buffer.byteLength(line + '\n', 'utf-8');
  
  if (currentSize + lineSize > MAX_SIZE_KB * 1024 && currentChunk.length > 0) {
    // Lưu chunk hiện tại
    chunks.push(currentChunk);
    currentChunk = [];
    currentSize = 0;
    chunkIndex++;
  }
  
  currentChunk.push(line);
  currentSize += lineSize;
}

// Lưu chunk cuối cùng
if (currentChunk.length > 0) {
  chunks.push(currentChunk);
}

console.log(`Chia thành ${chunks.length} files`);

// Ghi các file chunks
chunks.forEach((chunk, index) => {
  const filename = `caro_dataset_part${index + 1}.jsonl`;
  const filepath = path.join(OUTPUT_DIR, filename);
  const content = chunk.join('\n') + '\n';
  fs.writeFileSync(filepath, content, 'utf-8');
  const sizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(2);
  console.log(`✓ ${filename}: ${chunk.length} entries, ${sizeKB} KB`);
});

// Tạo file index
const indexData = {
  totalParts: chunks.length,
  totalEntries: lines.length,
  parts: chunks.map((chunk, index) => ({
    file: `caro_dataset_part${index + 1}.jsonl`,
    entries: chunk.length
  }))
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'index.json'),
  JSON.stringify(indexData, null, 2),
  'utf-8'
);

console.log('\n✓ Hoàn thành! Đã tạo file index.json');
console.log(`\nĐể sử dụng, cập nhật caroDataset.ts để load từ /datasets/`);
