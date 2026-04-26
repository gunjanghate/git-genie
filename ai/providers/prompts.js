export function getCommitPrompt(diff, desc, type = 'chore', scope = '') {
    return `You are a senior software engineer at a Fortune 500 company. Generate a professional git commit message following strict industry standards.

REQUIREMENTS:
- Follow Conventional Commits specification exactly
- Format: type(scope): description
- Description must be under 50 characters
- Use imperative mood (add, fix, update, not adds, fixes, updates)
- First letter of description lowercase
- No period at the end
- Choose appropriate type: feat, fix, docs, style, refactor, test, chore, ci, build, perf
- Include scope when relevant (component/module/area affected)
- Prefer the user intent when provided

User intent:
${type}${scope ? `(${scope})` : ''}: ${desc}

Code diff to analyze:
${diff}

Return ONLY the commit message, no explanations or quotes.`;
}

export function getPRTitlePrompt(diff, desc) {
    return `You are a senior software engineer at a Fortune 500 company. Generate a professional Pull Request title following industry best practices.

REQUIREMENTS:
- Clear, descriptive title that summarizes the changes
- Start with action verb (Add, Fix, Update, Implement, etc.)
- Keep under 72 characters
- Use sentence case
- Focus on the what and why of the change
- No period at the end
- Be specific about the feature/fix being introduced

Description provided: ${desc}

Code diff to analyze:
${diff}

Return ONLY the PR title, no explanations or quotes.`;
}

export function getBranchNamePrompt(diff, desc, type = 'feature') {
    return `You are a senior software engineer. Generate a professional git branch name following industry best practices.

REQUIREMENTS:
- Follow git branch naming conventions
- Format: type/short-descriptive-name
- Use kebab-case
- Keep under 40 characters total when possible
- Use type from: feature, fix, hotfix, chore, docs, style, refactor, test
- No special characters except dashes and forward slash

Type hint: ${type}
Description: ${desc}

Code diff to analyze:
${diff}

Return ONLY the branch name, no explanations or quotes.
Example format: feature/user-authentication`;
}

export function getGroupingPrompt(files) {
    return `Group these files into logical commits and return strict JSON only.

Return format:
{
  "groups": [
    { "name": "group-name", "files": ["path1", "path2"] }
  ]
}

Rules:
- Every input file must appear in exactly one group
- 1-6 groups max
- Keep groups cohesive
- Output must be valid JSON only

Files:
${files.join('\n')}`;
}

export function getGroupCommitPrompt(groupName, groupDiff, type = 'chore') {
    return `Generate a Conventional Commit message for this grouped change.

Group name: ${groupName}
Type hint: ${type}
Diff:
${groupDiff}

Return only: type(scope): description`;
}
