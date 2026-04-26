# Multi Provider AI Migration Documentation

## 1. Change Summary

This change refactored AI integration from a single hardcoded provider approach into a provider-agnostic architecture that supports both cloud and local models.

### What was implemented

- Added a base provider contract and standardized provider methods.
- Added cloud providers: Gemini, Mistral, Groq.
- Added local providers: Ollama, LM Studio.
- Added a ProviderFactory with provider registry and case-insensitive lookup.
- Added active provider runtime resolution with health checks and configuration validation.
- Added a multi-provider configuration store with migration from legacy Gemini-only format.
- Added CLI commands to configure providers, inspect status, and switch the active provider.
- Routed AI call sites (commit message, PR title, branch name) through the active provider abstraction.
- Added deterministic fallback behavior for reliability when provider is unavailable.
- Added tests for factory behavior, migration, provider switching, initialization, and fallback paths.

## 2. Feature Value

### New capabilities

- Users can configure multiple providers once and switch at runtime without code changes.
- AI features are executed through one active provider selected by the user.
- Local model workflows are supported without API keys.
- Cloud workflows support provider-specific API keys.
- Local providers support URL and model configuration plus optional model discovery.

### Reliability improvements

- Missing config does not break commit flow; deterministic fallback is used.
- Unreachable local servers return actionable guidance instead of hard failures.
- Non-parseable AI outputs in grouping scenarios are safely handled.
- Unknown providers return a clear error and a supported list.

## 3. Engineering Practices Followed

- Separation of concerns: provider logic, factory logic, runtime resolution, and storage are modularized.
- Contract-first design: all providers implement a shared method contract.
- Backward compatibility: legacy config format and environment variables continue to work.
- Secure-by-default key handling: keytar first, encrypted file fallback.
- Defensive coding: validation, health checks, and deterministic fallbacks.
- Incremental migration: automatic config migration without user intervention.
- Test coverage for critical behavior and edge cases.

## 4. Files Added and Their Responsibility

- ai/providers/BaseAIProvider.js: Abstract provider contract.
- ai/providers/GeminiProvider.js: Gemini implementation.
- ai/providers/OpenAICompatibleCloudProvider.js: Common cloud implementation used by Mistral and Groq.
- ai/providers/OllamaProvider.js: Ollama local implementation.
- ai/providers/LMStudioProvider.js: LM Studio local implementation.
- ai/providers/prompts.js: Shared prompt templates.
- ai/providers/utils.js: Shared deterministic fallback and response sanitization helpers.
- ai/providerFactory.js: Provider registry, lookup, and instance creation.
- ai/configStore.js: Multi-provider storage, migration, key management, and status API.
- ai/getActiveProviderInstance.js: Runtime active-provider resolver and readiness checks.
- test/providerFactory.test.js: Factory behavior tests.
- test/providerConfig.test.js: Config, migration, runtime initialization, and fallback tests.

## 5. Updated Existing Files

- index.js:
  - Removed hardcoded Gemini-only key and provider flow.
  - Added provider-aware config, status, and use commands.
  - Routed AI generation calls via active provider abstraction.
- README.md:
  - Updated documentation for multi-provider setup, switching, and troubleshooting.
- package.json:
  - Updated package description and publish file list to include the new ai directory.

## 6. Function-by-Function Breakdown

### 6.1 Provider contract

Source: ai/providers/BaseAIProvider.js

- constructor(config)
  - Stores provider-specific runtime configuration.
- getName()
  - Must return canonical provider name.
- validateApiKey(apiKey)
  - Cloud providers validate credential usability.
- generateCommitMessage(input)
  - Generates commit message from diff and user intent.
- generatePRTitle(input)
  - Generates PR title from diff and user intent.
- generateBranchName(input)
  - Generates branch name from diff and intent.
- groupFilesWithAI(input)
  - Produces grouped file buckets for split-commit use cases.
- generateCommitMessageForGroup(input)
  - Generates commit message for one grouped change.

All methods throw explicit not-implemented errors in the base class to enforce implementation.

### 6.2 ProviderFactory and registry

Source: ai/providerFactory.js

- class ProviderFactory
  - registerProvider(name, creator, options)
    - Registers provider creators by normalized lowercase name.
    - Can mark providers as local.
  - getSupportedProviders()
    - Returns sorted provider list.
  - isLocalProvider(name)
    - True for providers registered as local.
  - createProvider(name, config)
    - Creates provider instances from normalized name.
    - Throws helpful error for unknown names with supported list.

- createDefaultProviderFactory()
  - Registers Gemini, Mistral, Groq, Ollama, LM Studio.
  - Maps Mistral and Groq to OpenAI-compatible cloud adapter with defaults.

### 6.3 Configuration and migration

Source: ai/configStore.js

Public functions:

- getConfigDir()
  - Returns configuration directory path, supports override with GITGENIE_CONFIG_DIR.
- getConfigFile()
  - Returns full path of configuration file.
- getDefaultConfig()
  - Returns version 2 structure with providers object and activeProvider.
- readConfig()
  - Reads config, runs migration logic, returns defaults on parse failures.
- writeConfig(config)
  - Merges defaults and writes normalized config to disk.
- setActiveProvider(providerName)
  - Persists selected active provider in normalized lowercase form.
- getActiveProviderName()
  - Reads current active provider.
- saveCloudApiKey(providerName, apiKey)
  - Stores key in keytar first, encrypted file fallback.
- readCloudApiKey(providerName)
  - Reads key from env, keytar, legacy keytar account (Gemini), or encrypted config.
- saveLocalProviderConfig(providerName, localConfig)
  - Persists local provider baseUrl and model merged with defaults.
- readLocalProviderConfig(providerName)
  - Reads local provider config merged with defaults.
- getProvidersStatus(factory)
  - Builds status summary for all registered providers.

Private helpers:

- getEncryptionKey()
  - Retrieves stable encryption key from keytar or deterministic fallback derivation.
- encrypt(text)
  - AES-256-CBC encryption for file fallback key storage.
- decrypt(value)
  - Decrypts stored cipher text.
- mergeDefaults(config)
  - Ensures missing provider nodes and defaults are present.
- ensureConfigDir()
  - Creates configuration directory when missing.
- migrateLegacyConfig(rawConfig)
  - Migrates legacy GEMINI_API_KEY format to version 2 providers structure.

### 6.4 Runtime active provider resolver

Source: ai/getActiveProviderInstance.js

- getActiveProviderInstance(options)
  - Reads active provider and builds corresponding instance.
  - For local providers:
    - Applies local config.
    - Runs healthCheck when available.
    - Validates model existence.
    - Returns null with actionable warnings when not ready.
  - For cloud providers:
    - Reads API key.
    - Returns null with guidance when key missing.
  - Returns null on initialization failures instead of throwing to preserve command flow.

### 6.5 Provider implementations

Source: ai/providers/GeminiProvider.js

- getModel() selects configured model or default Gemini model.
- validateApiKey() performs lightweight live call for key validation.
- prompt() wraps Gemini SDK content generation.
- generation methods use shared prompts and deterministic fallback cleaners.

Source: ai/providers/OpenAICompatibleCloudProvider.js

- constructor() receives provider metadata and API endpoint settings.
- buildHeaders() builds auth headers.
- chat() performs OpenAI-compatible request and extracts text.
- generation methods share prompt strategy and fallback handling.

Source: ai/providers/OllamaProvider.js

- healthCheck() validates local server reachability through tags endpoint.
- discoverModels() returns model list from local runtime.
- prompt() calls Ollama generate endpoint and enforces configured model.
- generation methods mirror contract behavior with safe fallback.

Source: ai/providers/LMStudioProvider.js

- healthCheck() validates local server through models endpoint.
- discoverModels() returns available model ids.
- chat() calls LM Studio compatible chat endpoint and enforces model.
- generation methods mirror contract behavior with safe fallback.

### 6.6 Shared prompt and utility modules

Source: ai/providers/prompts.js

- getCommitPrompt(diff, desc, type, scope)
- getPRTitlePrompt(diff, desc)
- getBranchNamePrompt(diff, desc, type)
- getGroupingPrompt(files)
- getGroupCommitPrompt(groupName, groupDiff, type)

These functions centralize prompt text and keep provider classes focused on transport concerns.

Source: ai/providers/utils.js

- deterministicCommitMessage()
- deterministicPRTitle()
- deterministicBranchName()
- safeJsonParse()
- normalizeBranchName()
- cleanTextResponse()

These utilities enforce safe fallback behavior and sanitize model output.

### 6.7 CLI integration functions in index.js

- isCloudProvider(name)
  - Distinguishes cloud versus local provider handling paths.
- resolveLocalSettings(providerName, options)
  - Merges saved local settings with CLI options and optional discovered model.
- config command action
  - Supports legacy shortcut and provider-specific config updates.
- status command action
  - Prints all providers, configured state, and active marker.
- use command action
  - Switches active provider with immediate validation hints.
- generateCommitMessage(diff, opts, desc)
  - Uses active provider when genie is enabled, else deterministic fallback.
- generatePRTitle(diff, opts, desc)
  - Same provider-aware resolution with fallback.
- generateBranchName(diff, opts, desc)
  - Same provider-aware resolution with fallback.
- getProviderContext()
  - Resolves runtime provider instance and API key when required.

## 7. Backward Compatibility Notes

- Legacy command style remains available: gg config YOUR_GEMINI_API_KEY.
- Existing GEMINI_API_KEY environment workflow still works.
- Old config layout with GEMINI_API_KEY is auto-migrated.
- Non-AI paths remain unchanged and should behave as before.

## 8. Test Coverage Added

Source files:

- test/providerFactory.test.js
- test/providerConfig.test.js

Validated scenarios:

- Supported provider list and expected count.
- Case-insensitive provider creation.
- Unknown provider error message quality.
- Active provider switching persistence.
- Legacy config migration behavior.
- Local configuration persistence.
- Cloud and local provider runtime initialization paths.
- Missing config or unreachable provider fallback returning null.

## 9. Known Constraints

- Cloud API key validation requires network connectivity.
- Local provider readiness depends on running server and loaded model.
- Grouping methods are implemented in providers and currently positioned for future split-commit UX expansion.

## 10. Operational Flow Overview

1. User configures one or more providers.
2. User sets active provider.
3. AI call path asks runtime resolver for active provider instance.
4. Resolver validates readiness and returns provider or null.
5. Feature functions call provider methods if available.
6. On failure or missing setup, deterministic fallback output is used.

This design keeps user workflows functional even under provider outages or missing configuration while enabling flexible provider switching.
