# Requirements Document

## Introduction

This specification addresses a critical performance issue in the AI chat feature where loading the Caro dataset causes the browser to freeze with "Response has been truncated" errors. The system currently attempts to load the entire dataset synchronously when the AI chat tab is opened, causing poor user experience.

## Glossary

- **Dataset**: The caro_dataset.jsonl file containing Q&A pairs for the AI chat feature
- **AI Chat Tab**: The "Cao nhân AI" tab in the chat overlay component
- **Free Mode**: Basic AI mode that uses local dataset matching
- **Trial/Pro Mode**: Advanced AI modes that use external API calls
- **Dataset Loading**: The process of fetching and parsing the caro_dataset.jsonl file
- **Browser Freeze**: When the UI becomes unresponsive during dataset loading

## Requirements

### Requirement 1

**User Story:** As a user, I want to open the AI chat tab without experiencing browser freezes, so that I can quickly start asking questions.

#### Acceptance Criteria

1. WHEN a user opens the AI chat tab THEN the system SHALL display the interface immediately without blocking the UI thread
2. WHEN the dataset is loading THEN the system SHALL show a non-blocking loading indicator that allows other interactions
3. WHEN the dataset loading exceeds 3 seconds THEN the system SHALL provide a fallback message allowing the user to proceed with Trial/Pro modes
4. WHEN the dataset fails to load THEN the system SHALL gracefully degrade to Trial/Pro modes without crashing
5. WHEN the dataset is successfully loaded THEN the system SHALL cache it for subsequent uses within the same session

### Requirement 2

**User Story:** As a developer, I want the dataset to be loaded efficiently, so that the application performs well even with large data files.

#### Acceptance Criteria

1. WHEN the dataset file exceeds 1MB THEN the system SHALL use streaming or chunked loading techniques
2. WHEN parsing the dataset THEN the system SHALL process entries incrementally to avoid blocking the main thread
3. WHEN the dataset is cached THEN the system SHALL reuse the cached version for all subsequent AI chat interactions
4. WHEN multiple tabs request the dataset THEN the system SHALL deduplicate requests to load it only once
5. WHEN the dataset import fails THEN the system SHALL log the error details without exposing them to the user

### Requirement 3

**User Story:** As a user, I want to use Trial or Pro AI modes immediately, so that I don't have to wait for the Free mode dataset to load.

#### Acceptance Criteria

1. WHEN a user selects Trial or Pro mode THEN the system SHALL allow immediate interaction without waiting for dataset loading
2. WHEN the Free mode dataset is still loading THEN the system SHALL disable only the Free mode option while keeping Trial/Pro available
3. WHEN switching between AI modes THEN the system SHALL not re-trigger dataset loading if already in progress
4. WHEN the dataset eventually loads THEN the system SHALL enable the Free mode option automatically
5. WHEN the user sends a message in Trial/Pro mode THEN the system SHALL process it immediately regardless of dataset status

### Requirement 4

**User Story:** As a system administrator, I want to optimize the dataset file size, so that loading performance is improved for all users.

#### Acceptance Criteria

1. WHEN the dataset file is prepared THEN the system SHALL validate that it contains only necessary data without redundancy
2. WHEN the dataset exceeds 500KB THEN the system SHALL consider splitting it into multiple smaller files
3. WHEN the dataset is deployed THEN the system SHALL ensure it is properly compressed for network transfer
4. WHEN the dataset is updated THEN the system SHALL maintain backward compatibility with the loading mechanism
5. WHEN the dataset structure changes THEN the system SHALL handle parsing errors gracefully without breaking the UI
