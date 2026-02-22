import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import type { RhizomeConfig, RhizomeRoutingConfig } from '@/server/rhizome/types';

const DEFAULT_CONFIG: RhizomeConfig = {
  providers: {
    openai: {
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'env:OPENAI_API_KEY',
      timeoutMs: 15000,
    },
  },
  models: {
    fast_chat: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.2,
      maxTokens: 600,
      kind: 'chat',
    },
    embed_small: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      kind: 'embedding',
    },
  },
  memory: {
    maxEntitiesPerPatch: 600,
    maxRelationsPerPatch: 1200,
    maxEpisodesPerPatch: 1600,
  },
};

const DEFAULT_ROUTING: RhizomeRoutingConfig = {
  tasks: {
    extract: { chain: ['fast_chat'] },
    summarize: { chain: ['fast_chat'] },
    embed: { chain: ['embed_small'] },
  },
  retry: {
    maxRetries: 2,
    backoffMs: 250,
  },
};

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T> | null): T {
  if (!override) return base;
  const output = { ...base } as T;
  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    const baseValue = output[key];
    if (
      baseValue &&
      overrideValue &&
      typeof baseValue === 'object' &&
      typeof overrideValue === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      output[key] = deepMerge(baseValue as Record<string, any>, overrideValue as Record<string, any>) as T[keyof T];
      continue;
    }
    output[key] = overrideValue as T[keyof T];
  }
  return output;
}

function resolveKeyRef(value: string): string {
  if (!value.startsWith('env:')) return value;
  const envName = value.slice(4).trim();
  return process.env[envName] || '';
}

function sanitizeProviders(config: RhizomeConfig): RhizomeConfig {
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([providerId, provider]) => [
      providerId,
      {
        ...provider,
        apiKey: resolveKeyRef(provider.apiKey),
      },
    ])
  );
  return {
    ...config,
    providers,
  };
}

function projectRoot(): string {
  return process.cwd();
}

let configCache: RhizomeConfig | null = null;
let routingCache: RhizomeRoutingConfig | null = null;

export function loadRhizomeConfig(): RhizomeConfig {
  if (configCache) return configCache;
  const root = projectRoot();
  const configPath = process.env.RHIZOME_CONFIG_PATH || path.join(root, 'rhizome.config.json');
  const fileConfig = readJsonFile<Partial<RhizomeConfig>>(configPath);
  configCache = sanitizeProviders(deepMerge(DEFAULT_CONFIG, fileConfig));
  return configCache;
}

export function loadRhizomeRouting(): RhizomeRoutingConfig {
  if (routingCache) return routingCache;
  const root = projectRoot();
  const routingPath = process.env.RHIZOME_ROUTING_PATH || path.join(root, 'rhizome.routing.json');
  const fileRouting = readJsonFile<Partial<RhizomeRoutingConfig>>(routingPath);
  routingCache = deepMerge(DEFAULT_ROUTING, fileRouting);
  return routingCache;
}

export function describeRhizomeConfig() {
  const config = loadRhizomeConfig();
  const routing = loadRhizomeRouting();
  return {
    providers: Object.fromEntries(
      Object.entries(config.providers).map(([id, provider]) => [
        id,
        {
          ...provider,
          apiKey: provider.apiKey ? '***' : '',
        },
      ])
    ),
    models: config.models,
    routing,
  };
}
