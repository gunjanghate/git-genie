import inquirer from "inquirer";
import chalk from "chalk";
import { spawn } from "node:child_process";

// A simpler palette that synthesizes a commit wizard and prompts args for known commands
export async function openCommandPalette(program) {
    // Exclude any built-in/unknown and any conflicting 'commit' command so we control the UX
    const realCommands = program.commands.filter(c => c._name !== '*' && c._name !== 'commit');
    const choices = [
        { name: 'commit — Commit changes with optional AI support', value: '__commit__' },
        ...realCommands.map(c => ({ name: `${c._name} — ${c._description || ''}`.trim(), value: c._name }))
    ];

    let { selected } = await inquirer.prompt([
        { type: 'list', name: 'selected', message: chalk.magenta('✨ What would you like to do?'), pageSize: 12, choices }
    ]);

    // If a real command named 'commit' exists and gets selected, route it to our wizard
    if (selected === 'commit') selected = '__commit__';

    const node = process.execPath;
    const entry = process.argv[1];
    const run = async (args) => {
        // Pretty-print the exact command that will run
        const q = (s) => (s.includes(' ') ? `"${s.replace(/"/g, '\\"')}"` : s);
        const printable = ['gg', ...args].map(q).join(' ');
        console.log(chalk.gray(`→ Running: ${printable}`));

        const child = spawn(node, [entry, ...args], {
            stdio: 'inherit',
            cwd: process.cwd(),
            env: process.env
        });
        await new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('exit', (code) => resolve(code));
        });
    };

    if (selected === '__commit__') {
        const answers = await inquirer.prompt([
            { type: 'input', name: 'desc', message: 'Enter commit message:', validate: v => !!v || 'Commit message is required' },
            { type: 'confirm', name: 'genie', message: 'Use AI commit message?', default: false },
            { type: 'input', name: 'type', message: 'Commit type (feat, fix, docs...)', default: 'feat' },
            { type: 'input', name: 'scope', message: 'Commit scope (optional)' },
            { type: 'confirm', name: 'osc', message: 'Open-source issue mode?', default: false },
         ]);
        const args = [answers.desc];
        if (answers.type) args.push('--type', answers.type);
        if (answers.scope) args.push('--scope', answers.scope);
        if (answers.genie) args.push('--genie');
        if (answers.osc) args.push('--osc');
        if (answers.noBranch) args.push('--no-branch');
        if (answers.pushToMain) args.push('--push-to-main');
        if (answers.remote) args.push('--remote', answers.remote);
        await run(args);
        return;
    }

    // Subcommand-specific prompting
    if (selected === 'cl') {
        const { repoUrl, directory } = await inquirer.prompt([
            { type: 'input', name: 'repoUrl', message: 'Repository URL to clone:', validate: v => /^https?:\/\//.test(v) || v.startsWith('git@') || 'Enter a valid repo URL' },
            { type: 'input', name: 'directory', message: 'Optional directory name (blank for default)', default: '' }
        ]);
        const args = ['cl', repoUrl];
        if (directory) args.push(directory);
        await run(args);
        return;
    }
    if (selected === 'b') {
        const { branchName } = await inquirer.prompt([{ type: 'input', name: 'branchName', message: 'New branch name:', validate: v => !!v || 'Branch name is required' }]);
        await run(['b', branchName]);
        return;
    }
    if (selected === 's') {
        const { branchName } = await inquirer.prompt([{ type: 'input', name: 'branchName', message: 'Switch to branch:', validate: v => !!v || 'Branch name is required' }]);
        await run(['s', branchName]);
        return;
    }
    if (selected === 'wt') {
        const { branchName, wtPath } = await inquirer.prompt([
            { type: 'input', name: 'branchName', message: 'Branch for worktree:', validate: v => !!v || 'Branch name is required' },
            { type: 'input', name: 'wtPath', message: 'Worktree path (blank for default)', default: '' }
        ]);
        const args = ['wt', branchName];
        if (wtPath) args.push(wtPath);
        await run(args);
        return;
    }

    // Default: just execute the chosen subcommand
    await run([selected]);
}
