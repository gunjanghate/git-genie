import chalk from 'chalk';
import { createDefaultProviderFactory } from './providerFactory.js';
import {
    getActiveProviderName,
    readCloudApiKey,
    readLocalProviderConfig,
} from './configStore.js';

export async function getActiveProviderInstance(options = {}) {
    const { silent = false } = options;
    const factory = createDefaultProviderFactory();

    const activeProvider = (await getActiveProviderName()) || 'gemini';
    const isLocal = factory.isLocalProvider(activeProvider);

    try {
        if (isLocal) {
            const localConfig = await readLocalProviderConfig(activeProvider);
            const provider = factory.createProvider(activeProvider, localConfig);

            try {
                if (typeof provider.healthCheck === 'function') {
                    await provider.healthCheck();
                }
            } catch (healthError) {
                if (!silent) {
                    console.warn(chalk.yellow(`⚠ Active local provider "${activeProvider}" is unreachable.`));
                    console.warn(chalk.gray(`Details: ${healthError.message}`));
                    console.warn(chalk.cyan(`Tip: start your local server and verify URL: ${localConfig.baseUrl || 'default'}`));
                }
                return null;
            }

            if (!localConfig.model) {
                if (!silent) {
                    console.warn(chalk.yellow(`⚠ Active local provider "${activeProvider}" has no model configured.`));
                    console.warn(chalk.cyan(`Tip: configure model with: gg config --provider ${activeProvider} --model <model>`));
                }
                return null;
            }

            return provider;
        }

        const apiKey = await readCloudApiKey(activeProvider);
        if (!apiKey) {
            if (!silent) {
                console.warn(chalk.yellow(`⚠ Active cloud provider "${activeProvider}" is not configured.`));
                console.warn(chalk.cyan(`Tip: configure key with: gg config --provider ${activeProvider} --api-key <key>`));
            }
            return null;
        }

        return factory.createProvider(activeProvider, { apiKey });
    } catch (error) {
        if (!silent) {
            console.warn(chalk.yellow(`⚠ Could not initialize provider "${activeProvider}".`));
            console.warn(chalk.gray(`Details: ${error.message}`));
        }
        return null;
    }
}
