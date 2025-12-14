# Design Document - Project Health Check

## Overview

Hệ thống kiểm tra sức khỏe dự án sẽ thực hiện audit toàn diện các thành phần của dự án Caro/Gomoku, bao gồm:
- Kiểm tra trạng thái hoàn thành của các specs
- Phát hiện vấn đề code quality
- Xác minh tích hợp giữa các services
- Chạy và báo cáo kết quả tests
- Kiểm tra tính đầy đủ của features

## Architecture

```
Project Health Check
├── Spec Auditor
│   ├── Parse tasks.md files
│   ├── Count completed/incomplete tasks
│   └── Generate completion report
├── Code Scanner
│   ├── TODO/FIXME finder
│   ├── Type error checker
│   └── Dead code detector
├── Integration Verifier
│   ├── API endpoint checker
│   ├── Socket event checker
│   └── Service registration checker
├── Test Runner
│   ├── PHP test runner
│   ├── Python test runner
│   └── Coverage reporter
└── Feature Checker
    ├── Swap2 verification
    ├── Ranked BO3 verification
    ├── AI Analysis verification
    └── Report system verification
```

## Components and Interfaces

### 1. Spec Auditor
- Input: `.kiro/specs/*/tasks.md` files
- Output: Completion status for each spec
- Method: Parse markdown checkboxes, count [x] vs [ ]

### 2. Code Scanner
- Input: Source files (*.tsx, *.ts, *.php, *.py)
- Output: List of issues found
- Method: Grep for patterns, run linters

### 3. Integration Verifier
- Input: Service configurations
- Output: Integration status report
- Method: Check ServiceProvider, routes, socket handlers

### 4. Test Runner
- Input: Test files
- Output: Test results with pass/fail counts
- Method: Execute phpunit and pytest

### 5. Feature Checker
- Input: Feature requirements
- Output: Feature completeness status
- Method: Manual verification checklist

## Data Models

### SpecStatus
```typescript
interface SpecStatus {
  name: string;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
  incompleteTasks: string[];
}
```

### CodeIssue
```typescript
interface CodeIssue {
  file: string;
  line: number;
  type: 'TODO' | 'FIXME' | 'ERROR' | 'WARNING';
  message: string;
}
```

### TestResult
```typescript
interface TestResult {
  suite: string;
  total: number;
  passed: number;
  failed: number;
  errors: string[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Spec Completion Percentage Accuracy
*For any* spec with N total tasks and M completed tasks, the completion percentage SHALL equal (M/N) * 100, rounded to nearest integer.
**Validates: Requirements 1.2**

### Property 2: Test Coverage Identification
*For any* service file in backend/app/Services/, there SHALL exist a corresponding test file in backend/tests/ or the service SHALL be flagged as untested.
**Validates: Requirements 4.3**

## Error Handling

- File not found: Skip and log warning
- Parse error: Report error and continue with other files
- Test failure: Capture output and include in report
- Service unavailable: Mark as "unable to verify"

## Testing Strategy

### Manual Verification
- Run health check script
- Verify output matches expected state
- Check all incomplete items are actionable

### Automated Checks
- Spec parsing accuracy
- Test execution success
- Integration verification

