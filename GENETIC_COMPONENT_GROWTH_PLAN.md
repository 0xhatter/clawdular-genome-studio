# Genetic Component Growth Plan

## Goal
Design the genetic component so it visually and behaviorally "grows" like a real gene over time, while staying consistent with the existing Genome Editor and Evolution flows in this repo.

## Current Baseline (What Exists)
- Genome is modeled as 4 chromosomes: `trigger`, `action`, `behavior`, `metadata` (`nextjs-app/src/types/index.ts`).
- Genome UI is mostly static ASCII helix + JSON editor (`nextjs-app/src/components/views/GenomeEditor.tsx`).
- Inspector also shows a static helix and fitness bar (`nextjs-app/src/components/layout/Inspector.tsx`).
- Mutation/evolution events already exist in store (`nextjs-app/src/store/appStore.ts`).

## Design Scheme: Real-Gene Inspired Model

### 1) Visual Metaphor
Represent each module genome as a **Gene Construct** with biological parts:
- `Promoter` (activation/trigger control)
- `5' UTR` (pre-processing hints)
- `Coding Region` split into:
  - `Exons` (active operations)
  - `Introns` (optional/disabled logic or latent behavior)
- `3' UTR` (stability/retry/rate limits)
- `Regulatory Sites` (toggle/select parameters)
- `Epigenetic Marks` (fitness + mutation pressure overlays)

Mapping to current data:
- `trigger` chromosome -> Promoter + 5' UTR.
- `action` chromosome -> Coding Region (exons/introns).
- `behavior` chromosome -> 3' UTR and expression stability.
- `metadata/tags` -> gene identity and lineage annotations.

### 2) Growth Stages (Lifecycle)
Each module genome displays a stage derived from generation, fitness trend, and mutation count:
1. `Seed` (generation 1, low complexity)
2. `Sprout` (basic connectivity established)
3. `Juvenile` (first successful mutations)
4. `Mature` (stable expression + good fitness)
5. `Adaptive` (high-quality response under mutation pressure)
6. `Senescent` (degrading fitness / excessive mutation load)

Stage drives:
- Node size and branch complexity.
- Helix density and number of visible gene parts.
- Animation tempo (expression pulse rate).

### 3) Expression States (Real-Time Behavior)
Show current gene "expression" state:
- `silent`: low/zero trigger activity.
- `primed`: trigger connected, waiting.
- `transcribing`: currently running/executing.
- `translated`: produced successful outputs.
- `stressed`: high retries/errors.
- `mutating`: genome edit in progress.

State sources:
- module `state`, patch execution state, mutation events, retry/rate limit config.

### 4) Gene Parts Rendering Rules
- Promoter block width scales with trigger pattern count.
- Exon count scales with number of action operations.
- Intron markers appear for optional/disabled/rarely used operations.
- 3' UTR heat strip color encodes retry aggressiveness and rate limits.
- Regulatory nodes attach around the gene body for each parameter.
- Epigenetic marks:
  - methylation-like dim bands = suppressed/underperforming components.
  - acetylation-like bright bands = recently improved components.

### 5) Mutation Semantics (Visual + Data)
Map mutation type to visual changes:
- `parameter`: minor nucleotide substitutions (small color/size shifts).
- `behavioral`: regulatory marks and UTR adjustments.
- `structural`: exon/intron insertion/deletion, topology change.
- `spliced`: section replacement with clear seam highlight.
- `bred`: recombination crossover band between parent gene palettes.
- `cloned`: duplicate with slight drift/noise layer.

### 6) Inheritance + Lineage
For bred/spliced genomes:
- Display parent strands left/right of child.
- Crossover points highlighted.
- Tooltip: parent genome IDs, inherited chromosome parts, divergence score.

## Interaction Design

### Genome Editor (Main)
- Replace static ASCII with a **Gene Growth Canvas**:
  - Top: lifecycle stage + expression state.
  - Middle: zoomable gene construct (promoter/exons/introns/UTRs/regulators).
  - Bottom: mutation timeline with branch markers.
- Keep JSON editor as "Raw Sequence" mode toggle.

### Inspector (Compact)
- Show mini gene with:
  - stage icon
  - expression pulse
  - fitness sparkline
  - mutation load indicator

### Evolution View
- Convert timeline cards into lineage snapshots:
  - mini construct thumbnails per generation
  - before/after diff overlays
  - selectable mutation event to animate what changed

## Data Model Extensions

Add derived UI model (do not replace current genome schema initially):
- `GeneStage`: seed/sprout/juvenile/mature/adaptive/senescent
- `ExpressionState`: silent/primed/transcribing/translated/stressed/mutating
- `GenePart[]`: promoter, utr5, exon, intron, utr3, regulator, mark
- `MutationImpact`: changed parts, confidence, severity
- `LineageEdge`: parent -> child with crossover metadata

Implementation note:
- Build this as **derived selectors** from existing `Genome`, `Module`, `Patch`, and mutation history.

## Visual System

### Color/Encoding
- Keep current monochrome terminal aesthetic as base.
- Add constrained accent channels:
  - promoter = cyan tint
  - coding exons = white/bright
  - introns = muted gray
  - stress marks = amber
  - failure/senescent cues = red

### Motion
- Expression pulse every run cycle.
- Gentle growth interpolation on generation increment.
- Mutation animation burst localized to changed parts.
- Respect reduced-motion preference.

## Technical Implementation Plan

## Phase 0: Foundations (1-2 days)
1. Define derived gene-view types in `nextjs-app/src/types/index.ts` (or a new `geneView.ts`).
2. Add selectors/utilities in `nextjs-app/src/lib/geneView.ts`:
   - `deriveGeneStage(module, patch)`
   - `deriveExpressionState(module, patch)`
   - `buildGeneParts(genome)`
   - `buildLineage(module, patch)`
3. Add deterministic color/shape rules for each part and state.

## Phase 1: Inspector Upgrade (1 day)
1. Replace static helix section in `nextjs-app/src/components/layout/Inspector.tsx` with compact `MiniGene`.
2. Keep existing fitness meter; add stage + expression chips.
3. Add safe fallback to current static view if derived model fails.

## Phase 2: Genome Editor Growth Canvas (2-3 days)
1. Create `nextjs-app/src/components/genome/GeneGrowthCanvas.tsx`.
2. Render parts as lane-based SVG:
   - lane 1 promoter/UTR
   - lane 2 coding exons/introns
   - lane 3 regulators/marks
3. Add interactions:
   - hover tooltips
   - click-to-focus part
   - mutation highlight playback
4. Keep current JSON editor as tab: `Visual` / `Raw`.

## Phase 3: Mutation & Evolution Diff Layer (2 days)
1. Add `GenomeDiffPanel` to compare selected generations.
2. Add mutation impact summarization from `genome.mutations`.
3. Show crossover seams for bred genomes and splice seams for spliced genomes.

## Phase 4: Runtime Expression Integration (1-2 days)
1. Feed execution state transitions from store actions:
   - execute start -> `transcribing`
   - execute success -> `translated`
   - failure/retry -> `stressed`
2. Add transient UI event queue for expression pulses and mutation bursts.

## Phase 5: Polish + Accessibility (1 day)
1. Keyboard focus traversal for gene parts.
2. ARIA labels for biological parts and mutation events.
3. Reduced-motion and high-contrast checks.
4. Snapshot tests for deterministic rendering.

## API/Store Alignment
- Keep current OpenClawd integration as source of truth for evolve/mutate/breed.
- Extend response handling (optional) to include:
  - `mutationImpact`
  - `lineage`
  - `expressionSignals`
- If absent, derive locally from current schema.

## Acceptance Criteria
- Gene display changes stage as generation/fitness evolve.
- Mutation visibly affects only impacted gene parts.
- Bred/spliced genomes show clear inheritance seams.
- Inspector and Genome Editor remain consistent for same module.
- No regression in existing actions: mutate, breed, evolve, execute.

## Risks and Mitigations
- Risk: over-complex visuals hurt readability.
  - Mitigation: strict lane layout + progressive disclosure.
- Risk: animation noise.
  - Mitigation: event-driven, short-duration transitions only.
- Risk: schema drift with backend.
  - Mitigation: derive model from existing schema first; optional server enrichments only.

## Milestone Deliverables
1. `MiniGene` in Inspector with stage/state.
2. `GeneGrowthCanvas` in Genome Editor with part-level rendering.
3. Mutation/evolution diff with lineage seams.
4. Test coverage for derivation + rendering stability.

## Suggested File Additions
- `nextjs-app/src/lib/geneView.ts`
- `nextjs-app/src/components/genome/GeneGrowthCanvas.tsx`
- `nextjs-app/src/components/genome/MiniGene.tsx`
- `nextjs-app/src/components/genome/MutationDiff.tsx`
- `nextjs-app/src/components/genome/GeneLegend.tsx`

## Rollout Strategy
1. Ship behind feature flag: `NEXT_PUBLIC_GENE_GROWTH_UI=true`.
2. Enable for internal testing first.
3. Validate usability on 10+ realistic patches.
4. Remove flag after stability + UX signoff.

