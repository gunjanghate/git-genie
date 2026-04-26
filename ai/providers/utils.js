export function deterministicCommitMessage({ type = 'chore', scope = '', desc = 'update code' }) {
    return `${type}${scope ? `(${scope})` : ''}: ${desc}`;
}

export function deterministicPRTitle({ type = 'chore', scope = '', desc = 'Update code' }) {
    return `${type}${scope ? `(${scope})` : ''}: ${desc}`;
}

export function deterministicBranchName({ type = 'chore', desc = 'update-code' }) {
    const sanitized = String(desc)
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'update';
    const date = new Date().toISOString().split('T')[0];
    return `${type}/${sanitized}-${date}`;
}

export function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export function normalizeBranchName(name, fallback) {
    if (!name || typeof name !== 'string') return fallback;
    const cleaned = name.trim().replace(/^"|"$/g, '').replace(/\s+/g, '-').toLowerCase();
    if (!cleaned.includes('/')) return fallback;
    return cleaned.slice(0, 60);
}

export function cleanTextResponse(text, fallback) {
    if (!text || typeof text !== 'string') return fallback;
    const value = text.trim().replace(/^"|"$/g, '').split('\n')[0];
    return value || fallback;
}
