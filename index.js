#!/usr/bin/env node

import { Command } from 'commander';
import simpleGit from 'simple-git';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import { GoogleGenerativeAI } from "@google/generative-ai";
import inquirer from 'inquirer';

dotenv.config();
const git = simpleGit();

// Warn if no Gemini key but user wants AI
if (!process.env.GEMINI_API_KEY) {
  // Only warn if user specifically requests AI
  // No warning by default since AI is opt-in now
}

// CLI args
const program = new Command();
program
  .argument('<desc>', 'Short description of the change')
  .option('--type <type>', 'Commit type', 'feat')
  .option('--scope <scope>', 'Commit scope', '')
  .option('--genie', 'Enable AI commit message generation using Gemini')
  .option('--no-branch', 'Skip interactive branch choice and commit to main')
  .option('--push-to-main', 'Automatically merge current branch to main and push')
  .option('--remote <url>', 'Add remote origin if repo is new')
  .parse(process.argv);

const [desc] = program.args;
const opts = program.opts();

/** Generate commit message */
async function generateCommitMessage(diff) {
  // Only use AI if --genie flag is provided AND API key exists
  if (!opts.genie || !process.env.GEMINI_API_KEY) {
    if (opts.genie && !process.env.GEMINI_API_KEY) {
      console.warn(chalk.yellow('Warning: GEMINI_API_KEY not found. Using manual commit message instead.'));
    }
    return `${opts.type}${opts.scope ? `(${opts.scope})` : ''}: ${desc}`;
  }

  const spinner = ora('Generating commit message. Please wait...').start();
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are a senior software engineer at a Fortune 500 company. Generate a professional git commit message following strict industry standards.

    REQUIREMENTS:
    - Follow Conventional Commits specification exactly
    - Format: type(scope): description
    - Description must be under 50 characters
    - Use imperative mood (add, fix, update, not adds, fixes, updates)
    - First letter of description lowercase
    - No period at the end
    - Choose appropriate type: feat, fix, docs, style, refactor, test, chore, ci, build, perf
    - Include scope when relevant (component/module/area affected)

    EXAMPLES OF EXCELLENT COMMITS:
    - feat(auth): add OAuth2 integration
    - fix(api): resolve null pointer exception
    - refactor(utils): extract common validation logic
    - docs(readme): update installation instructions
    - test(user): add integration test coverage
    - perf(query): optimize database index usage

    ANALYSIS GUIDELINES:
    - If adding new functionality → feat
    - If fixing bugs → fix
    - If improving performance → perf
    - If changing code structure without behavior change → refactor
    - If updating documentation → docs
    - If adding/updating tests → test
    - If updating build/CI config → build/ci

    Code diff to analyze:
    ${diff}

    Return ONLY the commit message, no explanations or quotes.`;

    const result = await model.generateContent(prompt);
    spinner.succeed('Commit message generated successfully by Gemini AI');
    return result.response?.text()?.trim() || `${opts.type}: ${desc}`;
  } catch (err) {
    spinner.fail('Gemini AI generation failed. Falling back to manual commit message.');
    console.error(chalk.red(err.message));
    return `${opts.type}${opts.scope ? `(${opts.scope})` : ''}: ${desc}`;
  }
}

/** Stage all files */
async function stageAllFiles() {
  const spinner = ora('Staging all files...').start();
  try {
    await git.add('./*');
    spinner.succeed('All files staged successfully');
  } catch (err) {
    spinner.fail('Failed to stage files');
    throw err;
  }
}

/** Push branch with retry */
async function pushBranch(branchName) {
  const spinner = ora(`Pushing branch "${branchName}" to remote...`).start();
  const maxRetries = 2;
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      await git.push('origin', branchName);
      spinner.succeed(`Successfully pushed branch "${branchName}" to remote`);
      return;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        spinner.fail(`Failed to push branch "${branchName}" after ${maxRetries + 1} attempts`);
        throw err;
      } else {
        spinner.warn(`Push failed. Retrying... (${attempt}/${maxRetries})`);
      }
    }
  }
}

/** Merge current branch to main and push */
async function mergeToMainAndPush(currentBranch) {
  try {
    console.log(chalk.blue(`Starting merge process from "${currentBranch}" to main...`));

    // Switch to main branch
    const spinner1 = ora('Switching to main branch...').start();
    await git.checkout('main');
    spinner1.succeed('Switched to main branch successfully');

    // Pull latest changes from main
    const spinner2 = ora('Pulling latest changes from main...').start();
    try {
      await git.pull('origin', 'main');
      spinner2.succeed('Main branch updated with latest changes');
    } catch (err) {
      spinner2.warn('Pull failed (main might not exist on remote yet)');
    }

    // Merge the feature branch
    const spinner3 = ora(`Merging "${currentBranch}" into main...`).start();
    await git.merge([currentBranch]);
    spinner3.succeed(`Successfully merged "${currentBranch}" into main`);

    // Push main branch
    const spinner4 = ora('Pushing main branch to remote...').start();
    await git.push('origin', 'main');
    spinner4.succeed('Successfully pushed main branch to remote');

    // Optional: Clean up feature branch
    const { cleanupBranch } = await inquirer.prompt([{
      type: 'confirm',
      name: 'cleanupBranch',
      message: `Do you want to delete the feature branch "${currentBranch}"?`,
      default: true
    }]);

    if (cleanupBranch && currentBranch !== 'main') {
      const spinner5 = ora(`Cleaning up feature branch "${currentBranch}"...`).start();
      try {
        await git.deleteLocalBranch(currentBranch);
        spinner5.succeed(`Deleted local branch "${currentBranch}" successfully`);

        // Try to delete remote Branch if it exists
        try {
          await git.push('origin', `:${currentBranch}`);
          console.log(chalk.green(`Deleted remote branch "${currentBranch}" successfully`));
        } catch {
          console.log(chalk.yellow(`Remote branch "${currentBranch}" may not exist or already deleted`));
        }
      } catch (err) {
        spinner5.fail(`Failed to delete branch "${currentBranch}"`);
        console.error(chalk.red(err.message));
      }
    }

    console.log(chalk.green('Successfully merged to main and pushed!'));

  } catch (err) {
    console.error(chalk.red(`Merge process failed: ${err.message}`));
    throw err;
  }
}

(async () => {
  try {
    // 1️⃣ Initialize repo if none exists
    let isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log(chalk.blue('No git repository found. Initializing...'));
      await git.init();
      console.log(chalk.green('Git repository initialized successfully'));
    }

    // 2️⃣ Add remote if provided
    if (opts.remote) {
      try {
        await git.remote(['add', 'origin', opts.remote]);
        console.log(chalk.green(`Remote origin set to ${opts.remote}`));
      } catch {
        console.log(chalk.yellow('Remote origin may already exist.'));
      }
    }

    // 3️⃣ Check if repo has commits
    let hasCommits = true;
    try {
      await git.revparse(['--verify', 'HEAD']);
    } catch {
      hasCommits = false;
    }

    // 4️⃣ Determine branch interactively
    let branchName = 'main';
    const branchInfo = await git.branch();
    const currentBranch = branchInfo.current || 'main';

    if (opts.noBranch || !hasCommits) {
      // Commit directly to main
      branchName = 'main';
      await git.checkout(['-B', branchName]);
      console.log(chalk.green(`Committing directly to branch: ${branchName}`));
    } else {
      // Interactive choice
      const { branchChoice } = await inquirer.prompt([{
        type: 'list',
        name: 'branchChoice',
        message: `Current branch is "${currentBranch}". Where do you want to commit?`,
        choices: [
          { name: `Commit to current branch (${currentBranch})`, value: 'current' },
          { name: 'Create a new branch', value: 'new' },
        ]
      }]);

      if (branchChoice === 'new') {
        // Auto-suggest branch name
        const suggestedBranch = `${opts.type}/${desc.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;

        const { newBranchName } = await inquirer.prompt([{
          type: 'input',
          name: 'newBranchName',
          message: 'Enter new branch name (or edit the suggested):',
          default: suggestedBranch,
          validate: input => input ? true : 'Branch name cannot be empty'
        }]);

        branchName = newBranchName;
        await git.checkoutLocalBranch(branchName);
        console.log(chalk.blue(`Created and switched to new branch: ${branchName}`));
      } else {
        branchName = currentBranch;
        await git.checkout(branchName);
        console.log(chalk.blue(`Committing to current branch: ${branchName}`));
      }
    }

    // 5️⃣ Stage files
    let diff = await git.diff(['--cached']);
    if (!diff) {
      console.log(chalk.yellow('No staged changes found.'));
      await stageAllFiles();
      diff = await git.diff(['--cached']);
      if (!diff) throw new Error('No changes detected to commit even after staging.');
    }

    // 6️⃣ Generate commit message
    const commitMessage = await generateCommitMessage(diff);

    // 7️⃣ Commit
    await git.commit(commitMessage);
    console.log(chalk.green(`Committed changes with message: "${commitMessage}"`));

    // 8️⃣ Handle push logic
    if (opts.pushToMain && branchName !== 'main') {
      // Auto-merge to main and push
      await mergeToMainAndPush(branchName);
    } else {
      // Regular push flow
      const { confirmPush } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmPush',
        message: `Do you want to push branch "${branchName}" to remote?`,
        default: true
      }]);

      if (confirmPush) {
        await pushBranch(branchName);

        // Ask if they want to merge to main after push (for feature branches)
        if (branchName !== 'main') {
          const { mergeToMain } = await inquirer.prompt([{
            type: 'confirm',
            name: 'mergeToMain',
            message: `Do you want to merge "${branchName}" to main branch and push?`,
            default: false
          }]);

          if (mergeToMain) {
            await mergeToMainAndPush(branchName);
          }
        }
      } else {
        console.log(chalk.yellow('Push skipped.'));

        // Still ask about merging to main if it's a feature branch
        if (branchName !== 'main') {
          const { mergeToMain } = await inquirer.prompt([{
            type: 'confirm',
            name: 'mergeToMain',
            message: `Do you want to merge "${branchName}" to main branch and push main?`,
            default: false
          }]);

          if (mergeToMain) {
            await mergeToMainAndPush(branchName);
          }
        }
      }
    }

  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
})();
