#!/usr/bin/env node

import { Command } from 'commander';
import simpleGit from 'simple-git';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execaCommand } from 'execa';
import path from 'path';
import { createDefaultProviderFactory } from './ai/providerFactory.js';
import {
  getProvidersStatus,
  readConfig,
  readCloudApiKey,
  readLocalProviderConfig,
  saveCloudApiKey,
  saveLocalProviderConfig,
  setActiveProvider,
} from './ai/configStore.js';
import { getActiveProviderInstance } from './ai/getActiveProviderInstance.js';
const { openCommandPalette } = await import(
  new URL('./helpers/commandPalette.js', import.meta.url)
);

const { detectCommitType } = await import(
  new URL('./helpers/detectCommitType.js', import.meta.url)
);


dotenv.config({ debug: false });
const git = simpleGit();

const providerFactory = createDefaultProviderFactory();

const program = new Command();

// Banner and logo for help output (copied exactly from postinstall.js)
const banner = `
    ${chalk.cyan("🔮")} ${chalk.magentaBright("Git")}${chalk.yellow("Genie")} ${chalk.cyan("🔮")}
    ${chalk.gray("┌─────────────────┐")}
    ${chalk.gray("│")} ${chalk.green("✨ AI-Powered Git ✨")}
    ${chalk.gray("│")} ${chalk.blue("Smart Commit Magic")} 
    ${chalk.gray("└─────────────────┘")}
       ${chalk.yellow("⚡")} ${chalk.red("Ready to code!")} ${chalk.yellow("⚡")}
`;
const logo = `
   $$$$$$\   $$$$$$\  
  $$  __$$\ $$  __$$\ 
  $$ /  \__|$$ /  \__|
  $$ |$$$$\ $$ |$$$$\ 
  $$ | \_$$ $$ | \_$$|
  $$ |  $$ $$ |  $$|
   $$$$$$  \$$$$$$  |
    \______/  \______/  
`;

// Show banner/logo on help output
program.configureHelp({
  formatHelp: (cmd, helper) => {
    // Format options
    const options = helper.visibleOptions(cmd)
      .map(opt => `  ${opt.flags}  ${opt.description}`)
      .join('\n');

    // Format arguments (only once)
    const args = helper.visibleArguments(cmd)
      .map(arg => `  <${arg.name}>  ${arg.description || ''}`)
      .join('\n');

    // Format subcommands
    const subcommands = helper.visibleCommands(cmd)
      .map(sub => `  ${sub.name()}  ${sub.description()}`)
      .join('\n');

    // Onboarding instructions (copied from postinstall.js)
    const onboarding = `\n${chalk.green.bold(" Welcome to GitGenie!")}
${logo}
${banner}
` +
      chalk.green("Genie powers already unlocked!") +
      '\nTry your first AI-powered commit:\n' +
      chalk.magenta('   gg "your changes" --genie\n') +
      chalk.yellow("⚡ Unlock Genie powers:") +
      '\n   gg config <your_api_key>\n' +
      chalk.cyan("Or just get started with a manual commit:") +
      '\n' + chalk.magenta('   gg "your commit message"\n') +
      chalk.blue("📖 Docs & guide: https://gitgenie.vercel.app/\n");

    return (
      onboarding +
      '\nUsage:\n  ' + helper.commandUsage(cmd) +
      '\n\nDescription:\n  ' + helper.commandDescription(cmd) +
      (options ? '\n\nOptions:\n' + options : '') +
      (args ? '\n\nArguments:\n' + args : '') +
      (subcommands ? '\n\nCommands:\n' + subcommands : '')
    );
  }
});

function isCloudProvider(name) {
  return !providerFactory.isLocalProvider(name);
}

async function resolveLocalSettings(providerName, options) {
  const current = await readLocalProviderConfig(providerName);
  const baseUrl = options.url || current.baseUrl;
  let model = options.model || current.model;

  const provider = providerFactory.createProvider(providerName, { baseUrl, model });

  if (options.discoverModel && typeof provider.discoverModels === 'function') {
    const discovered = await provider.discoverModels();
    if (discovered.length > 0 && !model) {
      model = discovered[0];
    }
  }

  return {
    baseUrl,
    model,
  };
}

program
  .command('config [value]')
  .description('Configure AI provider credentials or local provider settings')
  .option('--provider <provider>', 'Provider name (gemini, mistral, groq, ollama, lmstudio)')
  .option('--api-key <apiKey>', 'Cloud provider API key')
  .option('--url <baseUrl>', 'Local provider base URL')
  .option('--model <model>', 'Provider model')
  .option('--discover-model', 'Try to auto-discover model for local providers')
  .action(async (value, options) => {
    const supported = providerFactory.getSupportedProviders();

    let providerName = options.provider;
    if (!providerName) {
      const cfg = await readConfig();
      providerName = cfg.activeProvider || 'gemini';
    }

    providerName = String(providerName).toLowerCase();

    if (!supported.includes(providerName)) {
      console.error(chalk.red(`Unknown provider "${providerName}".`));
      console.error(chalk.yellow(`Supported providers: ${supported.join(', ')}`));
      process.exit(1);
    }

    try {
      if (!options.provider && value && !options.apiKey && isCloudProvider('gemini')) {
        const result = await saveCloudApiKey('gemini', value);
        await setActiveProvider('gemini');
        console.log(chalk.green('✨ Gemini API key saved successfully!'));
        console.log(chalk.gray(`Storage: ${result.secureStorage}`));
        process.exit(0);
      }

      if (providerFactory.isLocalProvider(providerName)) {
        const localSettings = await resolveLocalSettings(providerName, options);
        await saveLocalProviderConfig(providerName, localSettings);
        await setActiveProvider(providerName);

        console.log(chalk.green(` ${providerName} configured and set active.`));
        console.log(chalk.gray(`Base URL: ${localSettings.baseUrl}`));
        console.log(chalk.gray(`Model: ${localSettings.model || '(not set)'}`));
        if (!localSettings.model) {
          console.log(chalk.yellow('⚠ No model configured. Use --model or --discover-model.'));
        }
        process.exit(0);
      }

      const apiKey = options.apiKey || value;
      if (!apiKey) {
        console.error(chalk.red('API key is required for cloud providers.'));
        console.error(chalk.cyan(`Example: gg config --provider ${providerName} --api-key <key>`));
        process.exit(1);
      }

      const provider = providerFactory.createProvider(providerName, { model: options.model });
      const valid = await provider.validateApiKey(apiKey);
      if (!valid) {
        console.error(chalk.red(`API key validation failed for ${providerName}.`));
        process.exit(1);
      }

      const result = await saveCloudApiKey(providerName, apiKey);
      await setActiveProvider(providerName);
      console.log(chalk.green(` ${providerName} API key saved and set active.`));
      console.log(chalk.gray(`Storage: ${result.secureStorage}`));
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('Failed to save provider configuration.'));
      console.error(chalk.yellow(error.message));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show provider configuration status')
  .action(async () => {
    const statuses = await getProvidersStatus(providerFactory);
    const active = statuses.find((s) => s.active);

    console.log(chalk.cyan('AI Provider Status'));
    if (active) {
      console.log(chalk.green(`Active provider: ${active.provider}`));
    }

    for (const status of statuses) {
      const icon = status.configured ? chalk.green('configured') : chalk.yellow('not configured');
      const label = status.active ? chalk.magenta(' (active)') : '';
      if (status.type === 'local') {
        console.log(`- ${status.provider}: ${icon}${label} | url=${status.baseUrl || '-'} | model=${status.model || '-'}`);
      } else {
        console.log(`- ${status.provider}: ${icon}${label}`);
      }
    }
  });

program
  .command('use <provider>')
  .description('Switch active AI provider')
  .action(async (provider) => {
    const supported = providerFactory.getSupportedProviders();
    const providerName = String(provider || '').toLowerCase();

    if (!supported.includes(providerName)) {
      console.error(chalk.red(`Unknown provider "${providerName}".`));
      console.error(chalk.yellow(`Supported providers: ${supported.join(', ')}`));
      process.exit(1);
    }

    await setActiveProvider(providerName);
    console.log(chalk.green(` Active provider set to ${providerName}`));

    if (providerFactory.isLocalProvider(providerName)) {
      const local = await readLocalProviderConfig(providerName);
      if (!local.model) {
        console.log(chalk.yellow(`⚠ ${providerName} has no model set yet.`));
      }
      return;
    }

    const apiKey = await readCloudApiKey(providerName);
    if (!apiKey) {
      console.log(chalk.yellow(`⚠ ${providerName} has no API key configured.`));
      console.log(chalk.cyan(`Configure it with: gg config --provider ${providerName} --api-key <key>`));
    }
  });

program.command('cl')
  .argument('<url>')
  .argument('[dir]')
  .description('Clone repository')
  .action(async (url, dir) => {
    const spinner = ora('📥 Cloning repository...').start();
    try {
      await git.clone(url, dir);

      // Determine the target directory name for helpful next steps
      const repoNameFromUrl = (() => {
        try {
          const parts = url.split('/').filter(Boolean);
          const last = parts[parts.length - 1] || '';
          return (last || 'repo').replace(/\.git$/i, '');
        } catch {
          return dir || 'repo';
        }
      })();

      const targetDir = dir || repoNameFromUrl;
      spinner.succeed(` Repository cloned to "${targetDir}"`);

      // Helpful next steps
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray(`  cd ${targetDir}`));
      console.log(chalk.gray('  code .'));

      // Try to automatically open the repo in VS Code
      try {
        await execaCommand('code .', { cwd: path.resolve(process.cwd(), targetDir) });
        console.log(chalk.green(` Opened "${targetDir}" in VS Code`));
      } catch (openErr) {
        console.log(chalk.yellow('⚠ Could not open VS Code automatically.'));
        console.log(chalk.cyan('Tip: Ensure the "code" command is on your PATH. In VS Code, use: Command Palette → Shell Command: Install "code" command in PATH.'));
      }
    } catch (err) {
      spinner.fail('❌ Failed to clone repository.');
      console.log(chalk.red(err.message));
      console.log(chalk.cyan('Tip: Ensure the URL is correct and you have access (SSH/HTTPS).'));
    }
  });
// Register branch helper shortcuts
program.command('b')
  .argument('<branchName>')
  .description('Create & switch to new branch')
  .action(async (branchName) => {
    try {
      await git.checkoutLocalBranch(branchName);
      console.log(chalk.green(`Created & switched to "${branchName}"`));
    } catch (e) {
      console.log(chalk.red(e.message));
    }
  });

program.command('s')
  .argument('<branch>')
  .description('Switch to a branch')
  .action(async (branch) => {
    await git.checkout(branch);
    console.log(chalk.green(`Switched to "${branch}"`));
  });

program.command('wt')
  .argument('[arg1]')
  .argument('[arg2]')
  .description('Worktree helper: create, list, or remove')
  .action(async (arg1, arg2) => {
    try {
      // gg wt ls  OR  gg wt
      if (!arg1 || arg1 === 'ls') {
        const spinner = ora('📂 Reading worktrees...').start();
        const output = await git.raw(['worktree', 'list']);
        spinner.stop();

        if (!output.trim()) {
          console.log(chalk.yellow('No worktrees found.'));
          console.log(chalk.cyan('Tip: Create one with: gg wt <branch> [dir]'));
          return;
        }

        console.log(chalk.magenta('📂 Worktrees:'));
        const lines = output.trim().split('\n');
        for (const line of lines) {
          const branchMatch = line.match(/\[(.+?)\]/);
          const branch = branchMatch ? branchMatch[1] : 'detached or main';
          const pathPart = line.split(' ')[0];
          console.log(`${chalk.green(branch)} ${chalk.gray('→')} ${chalk.cyan(pathPart)}`);
        }
        return;
      }

      // gg wt rm <branchName>
      if (arg1 === 'rm') {
        const branchName = arg2;
        if (!branchName) {
          console.log(chalk.red('❌ Please provide a branch name to remove its worktree.'));
          console.log(chalk.cyan('Usage: gg wt rm <branchName>'));
          return;
        }

        const output = await git.raw(['worktree', 'list']);
        const lines = output.trim().split('\n').filter(Boolean);

        const match = lines.map(line => ({
          line,
          branch: (line.match(/\[(.+?)\]/) || [null, null])[1],
          path: line.split(' ')[0]
        })).find(entry => entry.branch === branchName);

        if (!match) {
          console.log(chalk.red(`❌ No worktree found for branch "${branchName}".`));
          console.log(chalk.cyan('Tip: List existing worktrees with: gg wt ls'));
          return;
        }

        const spinner = ora(`🧹 Removing worktree at "${match.path}"...`).start();
        try {
          await git.raw(['worktree', 'remove', match.path]);
          spinner.succeed(`🧹 Worktree for ${branchName} removed`);
        } catch (err) {
          spinner.fail('Failed to remove worktree.');
          if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
          console.log(chalk.cyan('Tip: Make sure no files are in use and the path exists.'));
        }
        return;
      }

      // Default: gg wt <branch> [dir]  → create worktree
      const branch = arg1;
      const dir = arg2;
      if (!branch) {
        console.log(chalk.red('❌ Branch name is required to create a worktree.'));
        console.log(chalk.cyan('Usage: gg wt <branch> [dir]'));
        return;
      }

      const loc = dir || branch;
      const spinner = ora(`🌿 Creating worktree for "${branch}" at "${loc}"...`).start();
      try {
        const branchSummary = await git.branchLocal();
        const exists = !!branchSummary.branches?.[branch];
        if (exists) {
          await git.raw(['worktree', 'add', loc, branch]);
        } else {
          const startPoint = branchSummary.current || 'main';
          await git.raw(['worktree', 'add', '-b', branch, loc, startPoint]);
        }
        spinner.succeed(chalk.green(`Worktree created at "${loc}"`));
      } catch (err) {
        spinner.fail('Failed to create worktree.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Ensure the base branch exists and the target path does not already contain a worktree.'));
      }
    } catch (err) {
      console.log(chalk.red('❌ Worktree command failed.'));
      if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
    }
  });

// ------------------------------ SETUP SHORTCUT COMMAND ------------------------------
program
  .command('setup <upstreamUrl> <branchName>')
  .description('Configure upstream, sync main, and create a feature branch')
  .action(async (upstreamUrl, branchName) => {
    try {
      // Ensure we are in a git repository (init if needed)
      let isRepo = await git.checkIsRepo();
      if (!isRepo) {
        const spinnerInit = ora('📁 Initializing git repository...').start();
        try {
          await git.init();
          spinnerInit.succeed('Git repository initialized.');
        } catch (err) {
          spinnerInit.fail('Failed to initialize git repository.');
          if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
          console.log(chalk.cyan('Tip: You can run "git init" manually and try again.'));
          return;
        }
      }

      // 1️⃣ Configure upstream remote
      const spinnerUpstream = ora('🔗 Configuring upstream remote...').start();
      try {
        const remotes = await git.getRemotes(true);
        const hasUpstream = remotes.some(r => r.name === 'upstream');

        if (hasUpstream) {
          spinnerUpstream.warn('Upstream remote already exists. Using existing "upstream".');
        } else {
          await git.raw(['remote', 'add', 'upstream', upstreamUrl]);
          spinnerUpstream.succeed('🔗 Upstream remote added');
        }
      } catch (err) {
        spinnerUpstream.fail('Failed to configure upstream remote.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Ensure you are inside a git repository and the URL is valid.'));
        return;
      }

      // 2️⃣ Switch to main branch
      const spinnerCheckout = ora('🔄 Switching to main branch...').start();
      try {
        await git.checkout('main');
        spinnerCheckout.succeed('Switched to main branch');
      } catch (err) {
        spinnerCheckout.fail('Failed to switch to main branch.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Make sure a "main" branch exists, or create one from your default branch.'));
        return;
      }

      // 3️⃣ Pull latest from upstream/main
      const spinnerPull = ora('📥 Pulling latest from upstream/main...').start();
      let pulled = false;
      try {
        await git.pull('upstream', 'main');
        spinnerPull.succeed('🔄 Fork synced with upstream main');
        pulled = true;
      } catch (err) {
        spinnerPull.fail('Failed to pull from upstream/main.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Ensure upstream points to the original repository and you have access.'));
      }

      // 4️⃣ Push updated main to origin if it exists
      const remotesAfter = await git.getRemotes(true);
      const hasOrigin = remotesAfter.some(r => r.name === 'origin');
      if (!hasOrigin) {
        console.log(chalk.yellow('⚠ No origin remote found. Skipping push to origin.'));
        console.log(chalk.cyan('Tip: Add origin with: git remote add origin <your-fork-url>'));
      } else {
        const spinnerPush = ora('🚀 Pushing main to origin...').start();
        try {
          if (pulled) {
            await git.push('origin', 'main');
          } else {
            // Even if pull failed, try to push local main if user wants latest local only
            await git.push('origin', 'main');
          }
          spinnerPush.succeed('Main branch pushed to origin.');
        } catch (err) {
          spinnerPush.fail('Failed to push main to origin.');
          if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
          console.log(chalk.cyan('Tip: Ensure origin is configured and you have push permissions.'));
        }
      }

      // 5️⃣ Create and switch to feature branch
      const spinnerBranch = ora(`🌿 Creating branch "${branchName}" from main...`).start();
      try {
        await git.checkoutLocalBranch(branchName);
        spinnerBranch.succeed(`🌿 Branch ${branchName} created & switched`);
      } catch (err) {
        spinnerBranch.fail('Failed to create or switch to the new branch.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Make sure the branch name is valid and not already in use.'));
        return;
      }

      console.log(chalk.green(`✨ Repository ready. You are now on branch ${branchName}`));
      console.log(chalk.cyan('Ready to start contributing!'));
    } catch (err) {
      console.log(chalk.red('❌ Setup command failed.'));
      if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
    }
  });

// ------------------------------ UPSTREAM REMOTE COMMANDS ------------------------------
const us = program
  .command('us')
  .description('Upstream remote helpers');

us
  .command('add <url>')
  .description('Add upstream remote pointing to original repo')
  .action(async (url) => {
    try {
      const remotes = await git.getRemotes(true);
      const hasUpstream = remotes.some(r => r.name === 'upstream');

      if (hasUpstream) {
        console.log(chalk.yellow('⚠ Upstream remote already exists.'));
        console.log(chalk.cyan('Tip: To inspect remotes, run: git remote -v'));
        return;
      }

      await git.raw(['remote', 'add', 'upstream', url]);
      console.log(chalk.green(` Upstream remote added: ${url}`));
    } catch (err) {
      console.log(chalk.red('❌ Failed to add upstream remote.'));
      if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
      console.log(chalk.cyan('Tip: Ensure you are inside a git repository and the URL is valid.'));
    }
  });

us
  .command('sync')
  .description('Sync local main with upstream main')
  .action(async () => {
    try {
      const remotes = await git.getRemotes(true);
      const hasUpstream = remotes.some(r => r.name === 'upstream');
      if (!hasUpstream) {
        console.log(chalk.red('❌ No upstream remote found. Run: gg us add <repo-url>'));
        return;
      }

      const spinnerCheckout = ora('🔄 Switching to main branch...').start();
      try {
        await git.checkout('main');
        spinnerCheckout.succeed('Switched to main branch');
      } catch (err) {
        spinnerCheckout.fail('Failed to switch to main branch.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Make sure a "main" branch exists locally.'));
        return;
      }

      const spinnerPull = ora('📥 Pulling latest changes from upstream/main...').start();
      let pulled = false;
      try {
        await git.pull('upstream', 'main');
        spinnerPull.succeed('Upstream main fetched and merged.');
        pulled = true;
      } catch (err) {
        spinnerPull.fail('Failed to pull from upstream/main.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Ensure upstream points to the original repository and you have access.'));
      }

      if (!pulled) return;

      const { pushOrigin } = await inquirer.prompt([{
        type: 'confirm',
        name: 'pushOrigin',
        message: 'Do you want to push updated main to origin?',
        default: true
      }]);

      if (!pushOrigin) {
        console.log(chalk.yellow('Skipping push to origin.'));
        console.log(chalk.cyan('You can push manually with: git push origin main'));
        return;
      }

      const spinnerPush = ora('🚀 Pushing main to origin...').start();
      try {
        await git.push('origin', 'main');
        spinnerPush.succeed(' Fork is now up to date (origin/main).');
      } catch (err) {
        spinnerPush.fail('Failed to push main to origin.');
        if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
        console.log(chalk.cyan('Tip: Ensure origin is configured and you have push permissions.'));
      }
    } catch (err) {
      console.log(chalk.red('❌ Upstream sync failed.'));
      if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
      console.log(chalk.cyan('Tip: Make sure you are inside a git repository.'));
    }
  });

// ------------------------------ QUICK WORKTREE NAVIGATION ------------------------------
program
  .command('goto <branchName>')
  .description('Show path (and optionally open) worktree for a branch')
  .action(async (branchName) => {
    try {
      const output = await git.raw(['worktree', 'list']);
      const lines = output.trim().split('\n').filter(Boolean);

      const match = lines.map(line => ({
        branch: (line.match(/\[(.+?)\]/) || [null, null])[1],
        path: line.split(' ')[0]
      })).find(entry => entry.branch === branchName);

      if (!match) {
        console.log(chalk.red(`❌ No worktree found for branch "${branchName}".`));
        console.log(chalk.cyan('Tip: List worktrees with: gg wt ls'));
        return;
      }

      console.log(chalk.magenta('📂 Run:'));
      console.log(chalk.gray(`  cd ${match.path}`));
      console.log(chalk.gray(`  code ${match.path}`));

      try {
        await execaCommand('code -n .', { cwd: match.path });
        console.log(chalk.green(' Opened worktree in a new VS Code window.'));
      } catch {
        console.log(chalk.yellow('⚠ Could not open VS Code automatically. Make sure the "code" command is on your PATH.'));
      }
    } catch (err) {
      console.log(chalk.red('❌ Failed to locate worktrees.'));
      if (err?.message) console.log(chalk.gray(`Details: ${err.message}`));
      console.log(chalk.cyan('Tip: Ensure you are inside a git repository.'));
    }
  });


// ------------------------------ MAIN COMMIT COMMAND ------------------------------
program
  .command("commit <desc>")
  .description("Commit changes with AI & smart options")
  .option('--type <type>', 'Commit type')
  .option('--scope <scope>', 'Commit scope', '')
  .option('--genie', 'AI commit message')
  .option('--osc', 'Open-source branch mode')
  .option('--no-branch', 'Commit on current branch (skip prompt)')
  .option('--push-to-main', 'Merge & push to main')
  .option('--remote <url>', 'Set remote origin')
  .action(async (desc, opts) => {
    await runMainFlow(desc, opts);
  });

// Register legacy shorthand commit logic rewritten
program
  .argument('[desc]')
  .option('--type <type>', 'Commit type')
  .option('--scope <scope>', 'Commit scope', '')
  .option('--genie', 'AI mode')
  .option('--osc', 'OSS branch mode')
  .option('--no-branch', 'Skip branch prompt')
  .option('--push-to-main', 'Push to main after commit')
  .option('--remote <url>')
  .action(async (desc, opts) => {
    const first = process.argv[2];

    // 🚫 If first arg is a known subcommand, do nothing here
    if (['commit', 'b', 's', 'wt', 'cl', 'config', 'status', 'use', 'setup', 'us', 'goto'].includes(first)) return;

    // No args → open menu
    if (!desc) {
      await openCommandPalette(program);
      process.exit(0);
    }

    // Run direct commit (only desc input)
    await runMainFlow(desc, opts);
  });

// No-args = open palette
if (!process.argv.slice(2).length) {
  await openCommandPalette(program);
  process.exit(0);
}

program.parse(process.argv);


/** Generate commit message */
async function generateCommitMessage(diff, opts, desc) {
  const type = opts.type || 'chore';
  const fallback = `${type}${opts.scope ? `(${opts.scope})` : ''}: ${desc}`;
  if (!opts.genie) return fallback;

  const context = await getProviderContext();
  if (!context) {
    console.warn(chalk.yellow('⚠ AI provider unavailable. Falling back to manual commit message.'));
    return fallback;
  }

  const spinner = ora(`🧞 Generating commit message with ${context.activeProvider}...`).start();
  try {
    const message = await context.provider.generateCommitMessage({
      apiKey: context.apiKey,
      diff,
      desc,
      type,
      scope: opts.scope,
    });
    spinner.succeed(` Commit message generated by ${context.activeProvider}`);
    return message || fallback;
  } catch (err) {
    spinner.fail('AI commit message generation failed. Using manual message instead.');
    console.error(chalk.yellow(`Tip: ${err.message}`));
    return fallback;
  }
}

async function generatePRTitle(diff, opts, desc) {
  const type = opts.type || 'chore';
  const fallback = `${type}${opts.scope ? `(${opts.scope})` : ''}: ${desc}`;
  if (!opts.genie) return fallback;

  const context = await getProviderContext();
  if (!context) {
    console.warn(chalk.yellow('⚠ AI provider unavailable. Falling back to manual PR title.'));
    return fallback;
  }

  const spinner = ora(`🧞 Generating PR title with ${context.activeProvider}...`).start();
  try {
    const title = await context.provider.generatePRTitle({
      apiKey: context.apiKey,
      diff,
      desc,
      type,
      scope: opts.scope,
    });
    spinner.succeed(` PR title generated by ${context.activeProvider}`);
    return title || fallback;
  } catch (err) {
    spinner.fail('AI PR title generation failed. Using manual title instead.');
    console.error(chalk.yellow(`Tip: ${err.message}`));
    return fallback;
  }
}

async function generateBranchName(diff, opts, desc) {
  const type = opts.type || 'chore';
  const fallback = `${type}/${desc.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
  if (!opts.genie) return fallback;

  const context = await getProviderContext();
  if (!context) return fallback;

  const spinner = ora(`🧞 Generating branch name with ${context.activeProvider}...`).start();
  try {
    const name = await context.provider.generateBranchName({
      apiKey: context.apiKey,
      diff,
      desc,
      type,
    });
    spinner.succeed(` Branch name generated by ${context.activeProvider}`);
    return name || fallback;
  } catch (err) {
    spinner.fail('AI branch name generation failed. Using manual name instead.');
    console.error(chalk.yellow(`Tip: ${err.message}`));
    return fallback;
  }
}

async function getProviderContext() {
  const config = await readConfig();
  const activeProvider = (config.activeProvider || 'gemini').toLowerCase();
  const provider = await getActiveProviderInstance({ silent: false });
  if (!provider) {
    return null;
  }

  if (providerFactory.isLocalProvider(activeProvider)) {
    return { provider, activeProvider, apiKey: null };
  }

  const apiKey = await readCloudApiKey(activeProvider);
  if (!apiKey) {
    return null;
  }

  return { provider, activeProvider, apiKey };
}

/** Stage all files */
async function stageAllFiles() {
  const spinner = ora('📂 Staging all files...').start();
  try {
    await git.add('./*');
    spinner.succeed(' All files staged');
  } catch (err) {
    spinner.fail('Failed to stage files.');
    console.error(chalk.red('Tip: Make sure you have changes to stage and your repository is not empty.'));
    console.error(chalk.cyan('To check status: git status'));
    throw err;
  }
}

/** Push branch with retry */
async function pushBranch(branchName) {
  const spinner = ora(`🚀 Pushing branch "${branchName}"...`).start();
  const maxRetries = 2;
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      // Use -u to set upstream on first push as well
      await git.push(['-u', 'origin', branchName]);
      spinner.succeed(`Successfully pushed branch "${branchName}"`);
      return;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        spinner.fail(`Failed to push branch "${branchName}" after ${maxRetries + 1} attempts.`);
        console.error(chalk.red('Tip: Check your remote URL and network connection.'));
        console.error(chalk.cyan('To set remote: git remote add origin <url>'));
        console.error(chalk.gray('Example: git remote add origin https://github.com/username/repo.git'));
        throw err;
      } else {
        spinner.warn(`Push failed. Retrying... (${attempt}/${maxRetries})`);
      }
    }
  }
}

/** Ensure a remote origin exists, optionally prompt user to add one */
async function ensureRemoteOriginInteractive() {
  try {
    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some(r => r.name === 'origin');
    if (hasOrigin) return true;

    console.log(chalk.yellow('ℹ No remote "origin" configured.'));
    const { wantRemote } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'wantRemote',
        message: 'Would you like to add a remote origin now?',
        default: true
      }
    ]);

    if (!wantRemote) return false;

    const { remoteUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'remoteUrl',
        message: 'Enter remote origin URL (e.g. https://github.com/user/repo.git):',
        validate: (v) => v && v.startsWith('http') || v.startsWith('git@') ? true : 'Please enter a valid Git remote URL'
      }
    ]);

    try {
      await git.remote(['add', 'origin', remoteUrl]);
      console.log(chalk.green(` Remote origin set to ${remoteUrl}`));
      return true;
    } catch {
      console.log(chalk.red('❌ Failed to add remote origin.'));
      return false;
    }
  } catch {
    return false;
  }
}

/** Merge current branch to main and push */
async function mergeToMainAndPush(currentBranch) {
  try {
    console.log(chalk.blue(`ℹ Starting merge process from "${currentBranch}" to main...`));

    const spinner1 = ora('🔄 Switching to main branch...').start();
    await git.checkout('main');
    spinner1.succeed('Switched to main branch');

    const spinner2 = ora('📥 Pulling latest changes from main...').start();
    try {
      await git.pull('origin', 'main');
      spinner2.succeed('Main branch updated');
    } catch {
      spinner2.warn('Could not pull latest changes. Main might not exist on remote yet.');
      console.error(chalk.yellow('Tip: Make sure your remote is set and main branch exists.'));
      console.error(chalk.cyan('To set remote: git remote add origin <url>'));
    }

    const spinner3 = ora(`🔀 Merging "${currentBranch}" into main...`).start();
    await git.merge([currentBranch]);
    spinner3.succeed(`Successfully merged "${currentBranch}" into main`);

    // Ensure remote before pushing
    const hasRemote = await ensureRemoteOriginInteractive();
    const spinner4 = ora('🚀 Pushing main branch to remote...').start();
    if (!hasRemote) {
      spinner4.warn('No remote configured. Skipping push of main.');
    } else {
      await git.push(['-u', 'origin', 'main']);
      spinner4.succeed('Successfully pushed main branch');
    }

    const { cleanupBranch } = await inquirer.prompt([{
      type: 'confirm',
      name: 'cleanupBranch',
      message: `Do you want to delete the feature branch "${currentBranch}"?`,
      default: true
    }]);

    if (cleanupBranch && currentBranch !== 'main') {
      const spinner5 = ora(`🧹 Cleaning up feature branch "${currentBranch}"...`).start();
      try {
        await git.deleteLocalBranch(currentBranch);
        spinner5.succeed(`Deleted local branch "${currentBranch}"`);

        try {
          await git.push('origin', `:${currentBranch}`);
          console.log(chalk.green(`Deleted remote branch "${currentBranch}"`));
        } catch {
          console.log(chalk.yellow(`Remote branch "${currentBranch}" may not exist.`));
          console.error(chalk.cyan('To check remote branches: git branch -r'));
        }
      } catch (err) {
        spinner5.fail(`Failed to delete branch "${currentBranch}".`);
        console.error(chalk.red('Tip: Make sure the branch exists and is not checked out.'));
        console.error(chalk.cyan('To delete branch: git branch -d <branch>'));
        console.error(chalk.gray('Example: git branch -d feature/my-branch'));
      }
    }

    console.log(chalk.green('🎉 Successfully merged to main and pushed!'));
  } catch (err) {
    console.error(chalk.red('Merge process failed: ' + err.message));
    console.error(chalk.yellow('Tip: Resolve any merge conflicts and try again.'));
    console.error(chalk.cyan('To resolve conflicts: git status && git merge --abort'));
    throw err;
  }
}

// Main flow function
async function runMainFlow(desc, opts) {
  try {
    // 1️⃣ Initialize repo if none exists
    let isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log(chalk.blue('No git repository found. Initializing...'));
      await git.init();
      console.log(chalk.green('Git repository initialized.'));
      console.log(chalk.cyan('Tip: To add a remote, run: git remote add origin <url>'));
      console.log(chalk.gray('Example: git remote add origin https://github.com/username/repo.git'));
    }

    // 2️⃣ Add or update remote if provided
    if (opts.remote) {
      try {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');

        if (!origin) {
          await git.remote(['add', 'origin', opts.remote]);
          console.log(chalk.green(`Remote origin set to ${opts.remote}`));
        } else {
          await git.remote(['set-url', 'origin', opts.remote]);
          console.log(chalk.green(`Remote origin updated to ${opts.remote}`));
        }
      } catch (err) {
        console.log(chalk.red('❌ Failed to configure remote origin automatically.'));
        console.log(chalk.yellow('Tip: You can set it manually with:'));
        console.log(chalk.cyan('  git remote set-url origin <url>'));
        if (err?.message) {
          console.log(chalk.gray(`Details: ${err.message}`));
        }
      }
    }

    // 3️⃣ Check if repo has commits
    let hasCommits = true;
    try {
      await git.revparse(['--verify', 'HEAD']);
    } catch (e) {
      hasCommits = false;
    }

    // 4️⃣ Determine branch interactively
    let branchName = 'main';
    const branchInfo = await git.branch();
    const currentBranch = branchInfo.current || 'main';

    if (opts.branch == false || !hasCommits) {
      branchName = 'main';
      await git.checkout(['-B', branchName]);
      console.log(chalk.green(`Committing directly to branch: ${branchName}`));
    } else {
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
        let suggestedBranch;
        let shortTitle = desc;
        // Open source contribution flow
        if (opts.osc) {
          // Prompt for issue number
          const { issueNumber } = await inquirer.prompt([{
            type: 'input',
            name: 'issueNumber',
            message: 'Enter issue number (e.g. 123):',
            validate: input => /^\d+$/.test(input) ? true : 'Issue number must be numeric'
          }]);
          // Generate short title
          if (opts.genie) {
            // Use Gemini to generate short title
            const unstagedDiff = await git.diff() || desc;
            shortTitle = await generateBranchName(unstagedDiff, opts, desc);
            // Only use the last part after slash for short title
            if (shortTitle.includes('/')) shortTitle = shortTitle.split('/')[1];
          } else {
            shortTitle = desc.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
          }
          suggestedBranch = `${opts.type}/#${issueNumber}-${shortTitle}`;
        } else {
          // Non-OSC flow
          if (opts.genie) {
            const unstagedDiff = await git.diff() || desc;
            suggestedBranch = await generateBranchName(unstagedDiff, opts, desc);
          } else {
            suggestedBranch = `${opts.type}/${desc.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
          }
        }

        const { newBranchName } = await inquirer.prompt([{
          type: 'input',
          name: 'newBranchName',
          message: 'Enter new branch name:',
          default: suggestedBranch,
          validate: input => input ? true : 'Branch name cannot be empty'
        }]);

        branchName = newBranchName;
        await git.checkoutLocalBranch(branchName);
        console.log(chalk.blue(`Created and switched to new branch: ${branchName}`));
        console.log(chalk.cyan('Tip: To list branches, run: git branch'));
      } else {
        branchName = currentBranch;
        await git.checkout(branchName);
        console.log(chalk.blue(`Committing to current branch: ${branchName}`));
      }
    }

    // 5️⃣ Stage files
    let diff = await git.diff(['--cached']);
    if (!diff) {
      console.log(chalk.yellow('No staged changes found. Staging all files...'));
      await stageAllFiles();
      diff = await git.diff(['--cached']);
      if (!diff) {
        console.error(chalk.red('No changes detected to commit even after staging.'));
        console.error(chalk.cyan('Tip: Make sure you have modified files. To check: git status'));
        process.exit(1);
      }
    }

    // 6️⃣ Generate commit message
    // Auto detect commit type if user didn't pass one and not using AI
    // console.log("Before commit message generation, opts:", opts);
    if (!opts.type && !opts.genie) {
      // console.log("Detecting commit type...");
      opts.type = await detectCommitType();
      console.log(`🧠 Auto-detected commit type: ${opts.type}`);
    }
    // console.log("After commit type detection, opts:", opts);
    const commitMessage = await generateCommitMessage(diff, opts, desc);

    // 7️⃣ Commit
    await git.commit(commitMessage);
    console.log(chalk.green(`Committed changes with message: "${commitMessage}"`));

    // 8️⃣ Push logic
    if (opts.pushToMain) {
      // If user asked to push to main automatically
      if (branchName === 'main') {
        // Already on main → just push
        const hasRemote = await ensureRemoteOriginInteractive();
        if (!hasRemote) {
          console.log(chalk.yellow('⚠ No remote configured. Skipping push.'));
        } else {
          const spinner = ora(`🚀 Pushing main branch...`).start();
          try {
            await git.push(['-u', 'origin', 'main']);
            spinner.succeed(` Pushed main successfully`);
          } catch (err) {
            spinner.fail(`❌ Failed to push main`);
            throw err;
          }
        }
      } else {
        // On feature branch → merge to main & push
        await mergeToMainAndPush(branchName);
      }

    } else {
      // 🧠 Interactive mode (normal flow)
      const { confirmPush } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirmPush',
        message: `Do you want to push branch "${branchName}" to remote?`,
        default: true
      }]);

      if (confirmPush) {
        const hasRemote = await ensureRemoteOriginInteractive();
        if (!hasRemote) {
          console.log(chalk.yellow('⚠ Skipping push because no remote is configured.'));
        } else {
          await pushBranch(branchName);
        }

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
        console.log(chalk.cyan(`To push manually: git push origin ${branchName}`));
      }
    }

  } catch (err) {
    console.error(chalk.red('Error: ' + err.message));
    console.error(chalk.yellow('Tip: Review the error above and try the suggested command.'));
    console.error(chalk.cyan('To get help: gg --help'));
    process.exit(1);
  }
}
