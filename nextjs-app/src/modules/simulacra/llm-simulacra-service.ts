import type { OpenClawPluginApi } from "../../../../../src/plugins/types.js";

// Load the embedded PI agent runner (same as llm-task extension)
type RunEmbeddedPiAgentFn = (params: Record<string, unknown>) => Promise<unknown>;

async function loadRunEmbeddedPiAgent(): Promise<RunEmbeddedPiAgentFn> {
  try {
    const mod = await import("../../../../../src/agents/pi-embedded-runner.js");
    // oxlint-disable-next-line typescript/no-explicit-any
    if (typeof (mod as any).runEmbeddedPiAgent === "function") {
      // oxlint-disable-next-line typescript/no-explicit-any
      return (mod as any).runEmbeddedPiAgent;
    }
  } catch {
    // ignore
  }

  const mod = await import("../../../../../src/agents/pi-embedded-runner.js");
  if (typeof mod.runEmbeddedPiAgent !== "function") {
    throw new Error("Internal error: runEmbeddedPiAgent not available");
  }
  return mod.runEmbeddedPiAgent as RunEmbeddedPiAgentFn;
}

function collectText(payloads: Array<{ text?: string; isError?: boolean }> | undefined): string {
  const texts = (payloads ?? [])
    .filter((p) => !p.isError && typeof p.text === "string")
    .map((p) => p.text ?? "");
  return texts.join("\n").trim();
}

// Simplified connection types (no strength, no activation counts)
export type SimpleConnectionType = "extends" | "contradicts" | "inspires" | "related";

export interface SimpleConnection {
  sourceId: string;
  targetId: string;
  type: SimpleConnectionType;
  insight: string;
}

// Simple idea node (no DNA, no energy decay)
export interface SimpleIdeaNode {
  id: string;
  content: string;
  state: "seed" | "growing" | "mature" | "dormant";
  attention: number;
  lastActive: string;
  parentIds: string[];
  keywords: string[];
  domain: string;
}

// LLM-based Simulacra service
export class LlmSimulacraService {
  private api: OpenClawPluginApi;
  private runEmbeddedPiAgent: RunEmbeddedPiAgentFn;

  constructor(api: OpenClawPluginApi) {
    this.api = api;
    // Will be loaded on first use
    this.runEmbeddedPiAgent = null as unknown as RunEmbeddedPiAgentFn;
  }

  private async ensureRunnerLoaded() {
    if (!this.runEmbeddedPiAgent) {
      this.runEmbeddedPiAgent = await loadRunEmbeddedPiAgent();
    }
  }

  private async runLlmPrompt(
    prompt: string,
    system: string = "You are a helpful assistant.",
  ): Promise<string> {
    await this.ensureRunnerLoaded();

    const primary = this.api.config?.agents?.defaults?.model?.primary;
    const primaryProvider = typeof primary === "string" ? primary.split("/")[0] : undefined;
    const primaryModel = typeof primary === "string" ? primary.split("/").slice(1).join("/") : undefined;

    const result = await this.runEmbeddedPiAgent({
      sessionId: `simulacra-${Date.now()}`,
      sessionFile: `/tmp/simulacra-session-${Date.now()}.json`,
      workspaceDir: this.api.config?.agents?.defaults?.workspace ?? process.cwd(),
      config: this.api.config,
      prompt: `${system}\n\n${prompt}`,
      timeoutMs: 15000,
      runId: `simulacra-${Date.now()}`,
      provider: primaryProvider,
      model: primaryModel,
      authProfileId: undefined,
      authProfileIdSource: "auto",
      streamParams: { temperature: 0.7, maxTokens: 300 },
      disableTools: true,
    });

    // oxlint-disable-next-line typescript/no-explicit-any
    const text = collectText((result as any).payloads);
    if (!text) {
      throw new Error("LLM returned empty output");
    }

    return text;
  }

  /**
   * Find connections between two ideas using LLM
   * Returns null if no meaningful connection found
   */
  async findConnection(ideaA: SimpleIdeaNode, ideaB: SimpleIdeaNode): Promise<SimpleConnection | null> {
    const prompt = `Compare these two ideas:

IDEA A: ${ideaA.content}
IDEA B: ${ideaB.content}

Are they related? If so, how?

Respond in JSON format:
{
  "related": true/false,
  "type": "extends" | "contradicts" | "inspires" | "related" | null,
  "insight": "brief explanation of the relationship" (if related)
}

If not related, return {"related": false, "type": null, "insight": ""}`;

    const system = "You analyze relationships between ideas. Be precise and concise.";
    const response = await this.runLlmPrompt(prompt, system);

    try {
      const parsed = JSON.parse(response);
      if (!parsed.related || !parsed.type) {
        return null;
      }

      return {
        sourceId: ideaA.id,
        targetId: ideaB.id,
        type: parsed.type,
        insight: parsed.insight || `${parsed.type} relationship detected`,
      };
    } catch {
      return null;
    }
  }

  /**
   * Synthesize two ideas into a new offspring idea
   */
  async synthesize(ideaA: SimpleIdeaNode, ideaB: SimpleIdeaNode): Promise<string> {
    const prompt = `Combine these two ideas into a new, synthesized idea:

IDEA A: ${ideaA.content}
IDEA B: ${ideaB.content}

Create a new idea that:
- Incorporates the best aspects of both parents
- Introduces something novel
- Is clear and concise (1-2 sentences)

Respond with ONLY the synthesized idea text (no explanation, no JSON):`;

    const system = "You are a creative synthesizer of ideas. Create novel combinations.";
    return await this.runLlmPrompt(prompt, system);
  }

  /**
   * Classify an idea to extract keywords and domain
   */
  async classifyIdea(content: string): Promise<{ keywords: string[]; domain: string }> {
    const prompt = `Analyze this idea:

${content}

Respond in JSON format:
{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "domain": "primary domain (e.g., 'design', 'engineering', 'business', 'philosophy')"
}`;

    const system = "You classify ideas by extracting key concepts and domains.";
    const response = await this.runLlmPrompt(prompt, system);

    try {
      const parsed = JSON.parse(response);
      return {
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
        domain: parsed.domain || "general",
      };
    } catch {
      return { keywords: [], domain: "general" };
    }
  }

  /**
   * Generate a new idea based on context (agent reasoning)
   */
  async generateIdea(context: string[], topic?: string): Promise<string> {
    const contextText = context.join("\n");
    const prompt = `Generate a new, interesting idea based on the following context:

CONTEXT:
${contextText}

${topic ? `TOPIC FOCUS: ${topic}` : ""}

The idea should be:
- Novel and creative
- Relevant to the context
- Clear and concise (1-2 sentences)
- Not already mentioned in the context

Respond with ONLY the idea text (no explanation, no JSON):`;

    const system = "You are an explorer of ideas. Generate novel, relevant concepts.";
    return await this.runLlmPrompt(prompt, system);
  }

  /**
   * Agent decision-making: what action to take next?
   */
  async decideAction(
    nodes: SimpleIdeaNode[],
    connections: SimpleConnection[],
    agentRole: "explorer" | "synthesizer",
  ): Promise<"spawn" | "connect" | "synthesize" | "wait"> {
    const nodeSummary = nodes.map((n) => `[${n.id.slice(0, 6)}] ${n.content.slice(0, 40)}...`).join("\n");
    const connectionSummary = connections.map((c) => `${c.sourceId.slice(0, 6)} → ${c.targetId.slice(0, 6)} (${c.type})`).join("\n");

    const prompt = `You are a ${agentRole} agent in an idea evolution system.

CURRENT STATE (${nodes.length} nodes, ${connections.length} connections):

NODES:
${nodeSummary}

CONNECTIONS:
${connectionSummary}

What action should you take?

EXPLORER AGENT: Finds connections between related ideas
SYNTHESIZER AGENT: Creates offspring from promising pairs

Consider:
- Are there disconnected ideas that might be related?
- Are there mature ideas that could produce interesting offspring?
- Has it been a while since the last activity?

Respond with ONLY one word: "spawn", "connect", "synthesize", or "wait"`;

    const system = "You are an autonomous agent deciding what action to take in an idea ecosystem.";
    const response = await this.runLlmPrompt(prompt, system).then((r) => r.toLowerCase().trim());

    if (["spawn", "connect", "synthesize", "wait"].includes(response)) {
      return response as "spawn" | "connect" | "synthesize" | "wait";
    }

    return "wait";
  }
}
