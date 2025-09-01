# 🚀 GitGenie CLI - Complete Documentation

## 📋 P### 4. Commit Message Generati### 7. CLI Argu### 8. Error Handling & Feedback

- Validates Git repository existence.
- Checks for staged changes; automatically stages if missing.
- Handles Gemini API errors and falls back gracefully to manual commit messages.
- Only warns about missing API key when `--genie` flag is used.
- Provides spinner feedback for staging, commit generation, and pushing.
- Clear console messages using `chalk` for success, warnings, and errors.
- Exits gracefully with proper error messages when operations fail.Options

- `<desc>`: Short description of the change (mandatory).
- `--type <type>`: Commit type (default: `feat`).
- `--scope <scope>`: Optional scope for commit message.
- `--genie`: Enable AI commit message generation using Google Gemini.
- `--no-branch`: Skip interactive branch selection and commit directly to the main branch.
- `--push-to-main`: Automatically merge current branch to main and push.
- `--remote <url>`: Add remote origin if the repository is new.**Manual commit messages by default** - Uses conventional commit format: `type(scope): description`
- **Optional AI-generated commit messages** using **Google Gemini** when `--genie` flag is used
- Uses the model `gemini-1.5-flash` to generate professional Conventional Commit messages based on code diff analysis
- AI analyzes code changes and suggests appropriate commit types, scopes, and descriptions
- Fallback to manual commit message when `--genie` is used but Gemini API fails or API key is missing
- Commit messages follow Conventional Commit style, e.g., `feat(auth): add OAuth2 integration`
- Manual format: `type(scope): description` using provided --type and --scope optionsOverview

**Git genie** is an intelligent command-line interface (CLI) tool designed to simplify and automate Git workflows. It handles common Git operations like committing, branch management, staging, and pushing, while optionally integrating AI-generated commit messages using Google Gemini. This comprehensive documentation details all features, configurations, and functionality implemented to date.

## 📁 Complete Project Structure

```
d:\my\GUNJAN\Git genie\
├── .env                    # Environment variables (API keys)
├── .git/                  # Git repository data
├── .gitignore            # Git ignore rules
├── index.js              # Main application logic (350 lines)
├── node_modules/         # Dependencies
├── package.json          # Project configuration & dependencies
├── package-lock.json     # Locked dependency versions
├── README.md             # This comprehensive documentation
├── test.txt              # Test file with random content
└── test2.txt             # Another test file with simple content
```

---

## Features Implemented

### 1. Git Repository Initialization

- Automatically detects if the current directory is a Git repository.
- Initializes a Git repository if none exists (`git init`).
- Sets the default branch to `main` for new repositories.
- Optionally adds a remote origin if a URL is provided using `--remote <url>`.
- Displays clear console messages and spinner feedback during the initialization process.

### 2. Branch Management

- **Interactive branch selection:** When committing, users are prompted to choose between the current branch or creating a new branch.
- **Auto-suggested branch names:** Suggested branch names follow the format:

```
<commit-type>/<commit-description>-<YYYY-MM-DD>
```

- Users can edit the suggested name when creating a new branch.
- Supports committing directly to the main branch using the `--no-branch` flag.
- Ensures that existing branches are not overwritten.
- Clear messages indicate whether switching to an existing branch or creating a new one.

### 3. File Staging

- Automatically detects unstaged changes.
- Stages all files if no staged changes are found (`git add ./*`).
- Provides spinner feedback for staging progress.
- Error handling if staging fails.

### 4. Commit Message Generation

- Supports AI-generated commit messages using **Google Gemini** (requires `GEMINI_API_KEY`).
- Uses the model `gemini-1.5-flash` to generate a professional Conventional Commit message based on the code diff.
- Fallback to a manual commit message when `--no-ai` is used or if Gemini API fails.
- Commit messages follow Conventional Commit style, e.g., `feat(commit-generation): Improve branch handling`.
- Includes details like features added, fixes, improvements, and other contextual information automatically if AI is enabled.

### 5. Commit Execution

- Commits the staged files with the generated commit message.
- Supports both AI-generated and manual messages.
- Provides console confirmation of the commit.
- Handles first commit scenarios properly.

### 6. Push Logic

- Pushes the current branch to the remote (`origin`) after committing.
- Includes retry logic for network failures (up to 2 retries).
- Interactive confirmation prompt before pushing (`Do you want to push branch ...?`).
- Provides clear feedback and error handling for push failures.

### 7. CLI Arguments & Options

- `<desc>`: Short description of the change (mandatory).
- `--type <type>`: Commit type (default: `feat`).
- `--scope <scope>`: Optional scope for commit message.
- `--genie`: Enable AI commit message generation.
- `--no-branch`: Skip interactive branch selection and commit directly to the main branch.
- `--remote <url>`: Add remote origin if the repository is new.

### 8. Error Handling & Feedback

- Validates Git repository existence.
- Checks for staged changes; automatically stages if missing.
- Handles Gemini API errors and falls back gracefully.
- Provides spinner feedback for staging, commit generation, and pushing.
- Clear console messages using `chalk` for success, warnings, and errors.
- Exits gracefully with proper error messages when operations fail.

### 9. Dependencies & Technology Stack

#### Core Dependencies:

- **`@google/generative-ai`** (v0.24.1) - Google Gemini AI integration for intelligent commit messages
- **`commander`** (v14.0.0) - CLI argument parsing and command structure
- **`simple-git`** (v3.28.0) - Git operations and repository management
- **`inquirer`** (v12.9.2) - Interactive command line prompts and user input
- **`chalk`** (v5.5.0) - Colored terminal output for better UX
- **`ora`** (v8.2.0) - Terminal spinners and progress indicators
- **`dotenv`** (v17.2.1) - Environment variable loading for API keys
- **`axios`** (v1.11.0) - HTTP client (available for future use)
- **`execa`** (v9.6.0) - Process execution (available for future use)

#### Project Configuration:

- **Name:** `git-genie`
- **Version:** `1.0.0`
- **Type:** `module` (ES6 modules)
- **Binary:** `gauto` command available globally after installation
- **Main Entry:** `index.js`

#### Environment Configuration (`.env`):

```properties
GEMINI_API_KEY=your_gemini_api_key_here  # Optional: Required only for --genie flag
GROK_API_KEY=your_grok_api_key_here      # Available for future features
```

```properties
GEMINI_API_KEY=your_gemini_api_key_here  # Required for AI commit messages
GROK_API_KEY=your_grok_api_key_here      # Available for future features
```

### 10. Example Usage & Sample Commands

#### Basic Usage:

```powershell
# Navigate to project directory
cd "d:\my\GUNJAN\Git genie"

# Install dependencies (if needed)
npm install

# Basic commit with manual message (default behavior)
node index.js "add new feature"

# Commit with AI-generated message using Gemini
node index.js "fix authentication bug" --genie

# Commit with specific type and scope
node index.js "fix authentication bug" --type fix --scope auth

# Commit with AI, specific type and scope
node index.js "optimize database queries" --type perf --scope db --genie

# Commit directly to main branch (no AI)
node index.js "update documentation" --no-branch

# Automatically merge to main and push
node index.js "add user dashboard" --type feat --push-to-main

# Initialize new repo with remote
node index.js "initial commit" --remote https://github.com/username/repo.git --no-branch
```

#### Interactive Workflow Example:

```powershell
# Run with interactive prompts
node index.js "implement user management"

# The tool will ask:
# 1. Current branch is "main". Where do you want to commit?
#    - Commit to current branch (main)
#    - Create a new branch
#
# 2. If creating new branch:
#    Enter new branch name: feat/implement-user-management-2025-09-01
#
# 3. After commit:
#    Do you want to push branch "feat/implement-user-management-2025-09-01" to remote? (Y/n)
```

#### Advanced Usage Scenarios:

```powershell
# Testing the CLI tool functionality with AI
node index.js "test file modifications" --type test --scope cli --genie

# Bug fix with specific scope (manual commit)
node index.js "resolve merge conflicts" --type fix --scope git

# Feature addition with AI-generated commit message
node index.js "add interactive branch selection" --type feat --scope branch --genie

# Documentation update directly to main
node index.js "update README with examples" --type docs --no-branch

# Performance improvement with AI and auto-merge to main
node index.js "optimize database queries" --type perf --scope db --genie --push-to-main
```

#### Legacy Examples:

```bash
# First commit to a new repo, main branch, manual commit
node index.js "initial commit" --no-branch --remote https://github.com/username/git-genie.git

# Commit to existing repo, interactive branch selection & AI commit
node index.js "add interactive branch selection" --type feat --scope commit --genie

# Commit to current branch directly with manual message
node index.js "fix typo in README" --no-branch
```

### 11. Current Workflow Summary

1. CLI parses user input and options.
2. Initializes Git repository if none exists.
3. Adds remote origin if provided.
4. Checks for existing commits.
5. Prompts the user to choose the branch (interactive) or commits directly to main if `--no-branch`.
6. Stages all files if needed.
7. Generates commit message (AI with `--genie` flag or manual by default).
8. Commits the changes.
9. Handles push logic based on `--push-to-main` flag or interactive prompts.
10. Optionally merges to main branch and pushes with retry logic.
11. Provides detailed console feedback for every step.

---

## 🛠 How Git genie Works (Detailed Step-by-Step)

1. **Repository Check**: Verifies if current directory is a Git repo, initializes if not
2. **Remote Setup**: Adds remote origin if provided via `--remote` flag
3. **Commit History Check**: Determines if repository has existing commits
4. **Branch Decision**:
   - If `--no-branch` or no commits: commits to main
   - Otherwise: interactive prompt to choose current branch or create new one
5. **File Staging**: Checks for staged changes, auto-stages all files if none found
6. **Commit Message Generation**:
   - Uses Gemini AI to analyze diff and generate commit message
   - Falls back to manual format if AI disabled or fails
7. **Commit Execution**: Commits staged files with generated message
8. **Push Confirmation**: Asks user if they want to push to remote
9. **Push with Retry**: Attempts to push with retry logic for network failures

## 🎯 Key Features & Benefits

✅ **Automated Git Workflows** - Reduces manual Git command typing  
✅ **AI-Generated Commit Messages** - Professional, contextual commit messages  
✅ **Interactive Branch Management** - User-friendly branch creation and switching  
✅ **Smart Error Handling** - Graceful fallbacks and retry mechanisms  
✅ **Professional Formatting** - Conventional Commit standards  
✅ **Colored Output** - Clear visual feedback with chalk  
✅ **Spinner Feedback** - Real-time progress indicators  
✅ **Flexible Configuration** - Multiple CLI options for different workflows

## 🧪 Testing Commands

```powershell
# Test basic functionality
node index.js "test basic functionality" --no-ai --no-branch

# Test AI commit generation
node index.js "test AI commit generation" --type test

# Test branch creation
node index.js "test branch creation" --type feat --scope testing

# Test error handling (no changes)
node index.js "test no changes scenario" --no-branch

# Test with different commit types
node index.js "test documentation" --type docs
node index.js "test bug fix" --type fix
node index.js "test refactoring" --type refactor
```

## 📋 Current Project Status

- **Repository:** `git-genie` by `gunjanghate`
- **Current Branch:** `change/text2`
- **Default Branch:** `main`
- **Status:** Active development with test files for functionality validation

---

## Notes & Future Considerations

- Can implement **last-used branch suggestion** for faster workflow.
- Optional integration with other AI models for commit suggestions.
- Ability to include commit templates for faster conventional commit adherence.
- Extend CLI with commands like `git-genie status`, `git-genie log`, etc.
- Add support for conventional commit scopes validation.
- Implement configuration file for default settings.
- Add git hooks integration for automated workflows.

---

This document captures the current state of **Git genie CLI**, including all features, functionality, CLI behavior, project structure, and comprehensive usage examples. It serves as a complete reference for users and developers working with or extending the tool.
