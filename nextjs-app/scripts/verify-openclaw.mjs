#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');

function parseEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const parsed = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function readConfig() {
  const localEnv = parseEnvLocal(envPath);
  const get = (key) => process.env[key] || localEnv[key] || '';

  const baseUrl = get('NEXT_PUBLIC_OPENCLAWD_BASE_URL').replace(/\/+$/, '');
  const apiKey = get('NEXT_PUBLIC_OPENCLAWD_API_KEY');
  const apiKeyHeader = get('NEXT_PUBLIC_OPENCLAWD_API_KEY_HEADER') || 'x-openclaw-api-key';

  const context = {
    userId: get('NEXT_PUBLIC_OPENCLAWD_USER_ID'),
    workspaceId: get('NEXT_PUBLIC_OPENCLAWD_WORKSPACE_ID'),
    model: get('NEXT_PUBLIC_OPENCLAWD_MODEL'),
    modelProvider: get('NEXT_PUBLIC_OPENCLAWD_MODEL_PROVIDER'),
  };

  const headers = {};
  if (apiKey) headers[apiKeyHeader] = apiKey;
  if (context.userId) headers[get('NEXT_PUBLIC_OPENCLAWD_USER_HEADER') || 'x-openclaw-user-id'] = context.userId;
  if (context.workspaceId) headers[get('NEXT_PUBLIC_OPENCLAWD_WORKSPACE_HEADER') || 'x-openclaw-workspace-id'] = context.workspaceId;
  if (context.model) headers[get('NEXT_PUBLIC_OPENCLAWD_MODEL_HEADER') || 'x-openclaw-model'] = context.model;
  if (context.modelProvider) headers[get('NEXT_PUBLIC_OPENCLAWD_MODEL_PROVIDER_HEADER') || 'x-openclaw-provider'] = context.modelProvider;

  return { baseUrl, headers, context };
}

function buildUrl(baseUrl, endpoint) {
  return `${baseUrl}${endpoint}`;
}

async function requestCheck(name, url, init) {
  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') || '';
    let jsonData = null;
    let payload = '';
    if (contentType.includes('application/json')) {
      jsonData = await response.json();
      payload = JSON.stringify(jsonData);
    } else {
      payload = await response.text();
    }

    const preview = payload.length > 400 ? `${payload.slice(0, 400)}...` : payload;
    return {
      name,
      ok: response.ok,
      status: response.status,
      preview,
      jsonData,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 'NETWORK_ERROR',
      preview: error instanceof Error ? error.message : String(error),
      jsonData: null,
    };
  }
}

async function main() {
  const { baseUrl, headers, context } = readConfig();

  if (!baseUrl) {
    console.error('Missing NEXT_PUBLIC_OPENCLAWD_BASE_URL in .env.local or env vars.');
    process.exit(1);
  }

  const maskedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, key.toLowerCase().includes('key') ? mask(value) : value])
  );

  console.log('OpenClaw verification config:');
  console.log(JSON.stringify({ baseUrl, headers: maskedHeaders, context }, null, 2));

  const checks = [
    requestCheck(
      'GET /api/registry/skills',
      buildUrl(baseUrl, '/api/registry/skills'),
      { method: 'GET', headers }
    ),
    requestCheck(
      'POST /api/evolution/evolve (context in body)',
      buildUrl(baseUrl, '/api/evolution/evolve'),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patchId: 'context-check',
          strategy: 'noop',
          patch: {
            id: 'context-check',
            name: 'CONTEXT_CHECK',
            description: '',
            modules: [],
            connections: [],
            activityLog: [],
            generation: 1,
            evolutionHistory: [],
            fitness: {
              overall: 0,
              components: {
                reliability: 0,
                efficiency: 0,
                utility: 0,
                satisfaction: 0,
                adaptability: 0,
              },
            },
            isRunning: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          context,
        }),
      }
    ),
  ];

  const results = await Promise.all(checks);
  console.log('\nEndpoint results:');
  for (const result of results) {
    console.log(`- ${result.name}: ${result.status}${result.ok ? ' (ok)' : ''}`);
    console.log(`  ${result.preview}`);
  }

  const skillsResult = results[0];
  if (Array.isArray(skillsResult?.jsonData)) {
    const logicIds = skillsResult.jsonData
      .filter((skill) => skill && typeof skill === 'object' && skill.category === 'logic' && typeof skill.id === 'string')
      .map((skill) => skill.id);
    console.log('\nDetected logic skill IDs from registry:');
    console.log(logicIds.length > 0 ? logicIds.join(', ') : '(none)');
  }

  const hasNetworkError = results.some((result) => result.status === 'NETWORK_ERROR');
  if (hasNetworkError) {
    process.exit(1);
  }
}

main();
