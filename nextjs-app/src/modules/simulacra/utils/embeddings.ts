import type { IdeaDNA, Trait } from '@/modules/simulacra/types';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'in', 'of', 'for', 'with', 'on', 'at', 'is', 'are', 'be', 'as', 'that',
  'this', 'it', 'by', 'from', 'into', 'through', 'within', 'across', 'idea', 'system', 'build', 'create',
]);

const DOMAIN_DICTIONARY: Record<string, string[]> = {
  ai: ['ai', 'agent', 'model', 'llm', 'neural', 'inference', 'embedding', 'semantic'],
  product: ['workflow', 'roadmap', 'user', 'market', 'launch', 'growth', 'feature', 'retention'],
  biology: ['evolution', 'genetic', 'mutation', 'fitness', 'organism', 'dna', 'cell', 'ecosystem'],
  engineering: ['api', 'service', 'database', 'schema', 'performance', 'architecture', 'module'],
  design: ['ui', 'ux', 'visual', 'canvas', 'interaction', 'layout', 'prototype'],
};

export function tokenize(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function extractKeywords(content: string, max = 8): string[] {
  const frequency = new Map<string, number>();
  tokenize(content).forEach((token) => {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

export function inferDomains(tokens: string[]): string[] {
  const domains: string[] = [];
  Object.entries(DOMAIN_DICTIONARY).forEach(([domain, terms]) => {
    if (terms.some((term) => tokens.includes(term))) {
      domains.push(domain);
    }
  });
  return domains.length > 0 ? domains : ['general'];
}

export function pseudoEmbedding(content: string, dimensions = 24): number[] {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(content);

  tokens.forEach((token, tokenIndex) => {
    let hash = 0;
    for (let index = 0; index < token.length; index += 1) {
      hash = (hash << 5) - hash + token.charCodeAt(index);
      hash |= 0;
    }

    const normalized = ((hash % 997) + 997) % 997;
    const position = normalized % dimensions;
    const signedValue = ((normalized % 101) / 100) * (tokenIndex % 2 === 0 ? 1 : -1);
    vector[position] += signedValue;
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(5)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}

export function buildDefaultTraits(keywords: string[]): Trait[] {
  const novelty = Math.min(1, keywords.length / 10);
  const adaptability = keywords.some((keyword) => keyword.includes('adapt') || keyword.includes('evol')) ? 0.85 : 0.55;
  const focus = keywords.length > 5 ? 0.7 : 0.45;

  return [
    { name: 'novelty', value: Number(novelty.toFixed(2)), heritability: 0.7 },
    { name: 'adaptability', value: Number(adaptability.toFixed(2)), heritability: 0.65 },
    { name: 'focus', value: Number(focus.toFixed(2)), heritability: 0.6 },
  ];
}

export function buildIdeaDNA(content: string): IdeaDNA {
  const keywords = extractKeywords(content);
  const tokens = tokenize(content);
  const sentimentAnchor = tokens.filter((token) => ['improve', 'grow', 'optimize', 'collaborative', 'novel'].includes(token)).length;
  const frictionAnchor = tokens.filter((token) => ['risk', 'constraint', 'fail', 'contradiction', 'cost'].includes(token)).length;
  const sentiment = Number(((sentimentAnchor - frictionAnchor) / Math.max(tokens.length, 1)).toFixed(2));

  return {
    embedding: pseudoEmbedding(content),
    keywords,
    sentiment,
    complexity: Number(Math.min(1, (tokens.length + keywords.length * 2) / 24).toFixed(2)),
    domain: inferDomains(tokens),
    traits: buildDefaultTraits(keywords),
  };
}
