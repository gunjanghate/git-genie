# Git Butler CLI Documentation

## Project Overview

**Git Butler** is a command-line interface (CLI) tool designed to simplify and automate Git workflows. It handles common Git operations like committing, branch management, staging, and pushing, while optionally integrating AI-generated commit messages using Google Gemini. This documentation details all features, configurations, and functionality implemented to date.

---

## Features Implemented

### 1. Git Repository Initialization

* Automatically detects if the current directory is a Git repository.
* Initializes a Git repository if none exists (`git init`).
* Sets the default branch to `main` for new repositories.
* Optionally adds a remote origin if a URL is provided using `--remote <url>`.
* Displays clear console messages and spinner feedback during the initialization process.

### 2. Branch Management

* **Interactive branch selection:** When committing, users are prompted to choose between the current branch or creating a new branch.
* **Auto-suggested branch names:** Suggested branch names follow the format:

```
<commit-type>/<commit-description>-<YYYY-MM-DD>
```

* Users can edit the suggested name when creating a new branch.
* Supports committing directly to the main branch using the `--no-branch` flag.
* Ensures that existing branches are not overwritten.
* Clear messages indicate whether switching to an existing branch or creating a new one.

### 3. File Staging

* Automatically detects unstaged changes.
* Stages all files if no staged changes are found (`git add ./*`).
* Provides spinner feedback for staging progress.
* Error handling if staging fails.

### 4. Commit Message Generation

* Supports AI-generated commit messages using **Google Gemini** (requires `GEMINI_API_KEY`).
* Uses the model `gemini-1.5-flash` to generate a professional Conventional Commit message based on the code diff.
* Fallback to a manual commit message when `--no-ai` is used or if Gemini API fails.
* Commit messages follow Conventional Commit style, e.g., `feat(commit-generation): Improve branch handling`.
* Includes details like features added, fixes, improvements, and other contextual information automatically if AI is enabled.

### 5. Commit Execution

* Commits the staged files with the generated commit message.
* Supports both AI-generated and manual messages.
* Provides console confirmation of the commit.
* Handles first commit scenarios properly.

### 6. Push Logic

* Pushes the current branch to the remote (`origin`) after committing.
* Includes retry logic for network failures (up to 2 retries).
* Interactive confirmation prompt before pushing (`Do you want to push branch ...?`).
* Provides clear feedback and error handling for push failures.

### 7. CLI Arguments & Options

* `<desc>`: Short description of the change (mandatory).
* `--type <type>`: Commit type (default: `feat`).
* `--scope <scope>`: Optional scope for commit message.
* `--no-ai`: Disable AI commit message generation.
* `--no-branch`: Skip interactive branch selection and commit directly to the main branch.
* `--remote <url>`: Add remote origin if the repository is new.

### 8. Error Handling & Feedback

* Validates Git repository existence.
* Checks for staged changes; automatically stages if missing.
* Handles Gemini API errors and falls back gracefully.
* Provides spinner feedback for staging, commit generation, and pushing.
* Clear console messages using `chalk` for success, warnings, and errors.
* Exits gracefully with proper error messages when operations fail.

### 9. Dependencies

* `commander`: Command-line argument parsing.
* `simple-git`: Git integration.
* `dotenv`: Environment variable loading.
* `chalk`: Colored console messages.
* `ora`: Spinner feedback.
* `@google/generative-ai`: Gemini AI integration for commit messages.
* `inquirer`: Interactive prompts for branch selection and naming.

### 10. Example Usage

```bash
# First commit to a new repo, main branch, no AI
node index.js "initial commit" --no-branch --no-ai --remote https://github.com/username/git-butler.git

# Commit to existing repo, interactive branch selection & AI commit
node index.js "add interactive branch selection" --type feat --scope commit

# Commit to current branch directly
node index.js "fix typo in README" --no-branch
```

### 11. Current Workflow Summary

1. CLI parses user input and options.
2. Initializes Git repository if none exists.
3. Adds remote origin if provided.
4. Checks for existing commits.
5. Prompts the user to choose the branch (interactive) or commits directly to main if `--no-branch`.
6. Stages all files if needed.
7. Generates commit message (AI or manual).
8. Commits the changes.
9. Asks the user to confirm pushing the branch to remote.
10. Pushes branch with retry logic.
11. Provides detailed console feedback for every step.

---

## Notes & Future Considerations

* Can implement **last-used branch suggestion** for faster workflow.
* Optional integration with other AI models for commit suggestions.
* Ability to include commit templates for faster conventional commit adherence.
* Extend CLI with commands like `git-butler status`, `git-butler log`, etc.

---

This document captures the current state of **Git Butler CLI**, including all features, functionality, and CLI behavior. It can be used as a reference before implementing new features or extending the tool.

