# Clawdular Genome Studio - Next.js App

A NASA Terminal Futurismo-styled modular synthesizer for AI skills.

## Features

- **Visual Patch Bay** - Drag and drop modules, connect with cables
- **Genome Editor** - Edit skill DNA, extract, splice, breed, mutate
- **Evolution Timeline** - Track generations and fitness improvements
- **Dashboard** - Manage all your patches

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Zustand (state management)
- D3.js (drag interactions)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## OpenClaw Integration (User + Model Context)

Set these in `nextjs-app/.env.local` when running against your OpenClaw backend:

```bash
# Optional API host override (empty uses same-origin /api/* routes)
NEXT_PUBLIC_OPENCLAWD_BASE_URL=https://your-openclaw-host

# Optional runtime events SSE path
NEXT_PUBLIC_OPENCLAWD_EVENTS_PATH=/api/runtime/events

# Optional auth header
NEXT_PUBLIC_OPENCLAWD_API_KEY=your_api_key
NEXT_PUBLIC_OPENCLAWD_API_KEY_HEADER=x-openclaw-api-key

# Optional user/workspace/model routing context
NEXT_PUBLIC_OPENCLAWD_USER_ID=user_123
NEXT_PUBLIC_OPENCLAWD_WORKSPACE_ID=workspace_abc
NEXT_PUBLIC_OPENCLAWD_MODEL=gpt-4.1
NEXT_PUBLIC_OPENCLAWD_MODEL_PROVIDER=openai

# Optional custom header names for context fields
NEXT_PUBLIC_OPENCLAWD_USER_HEADER=x-openclaw-user-id
NEXT_PUBLIC_OPENCLAWD_WORKSPACE_HEADER=x-openclaw-workspace-id
NEXT_PUBLIC_OPENCLAWD_MODEL_HEADER=x-openclaw-model
NEXT_PUBLIC_OPENCLAWD_MODEL_PROVIDER_HEADER=x-openclaw-provider

# Optional: only show these logic skills from OpenClaw registry
NEXT_PUBLIC_OPENCLAWD_LOGIC_SKILL_IDS=logic.if,logic.switch,logic.router
```

## Rhizome Cortex (Memory Graph Backend)

Rhizome now includes a server-side Cortex inspired memory system exposed under:

- `GET /api/rhizome/health`
- `POST /api/rhizome/ingest`
- `POST /api/rhizome/query`
- `GET /api/rhizome/graph?patchId=...`
- `POST /api/rhizome/migrate-markdown`

Configuration files:

- `rhizome.config.json` (providers, models, memory limits)
- `rhizome.routing.json` (task-to-model chains, retries, fallbacks)

API keys use `env:` references in config, e.g.:

```json
{
  "providers": {
    "openai": {
      "apiKey": "env:OPENAI_API_KEY"
    }
  }
}
```

Environment variables:

```bash
OPENAI_API_KEY=your_key_here
# Optional override paths:
RHIZOME_CONFIG_PATH=/absolute/path/to/rhizome.config.json
RHIZOME_ROUTING_PATH=/absolute/path/to/rhizome.routing.json
```

## Project Structure

```
src/
├── app/              # Next.js app router
├── components/       # React components
│   ├── layout/       # Header, Footer, Sidebar, Inspector
│   ├── patchbay/     # Canvas, ModuleNode, CableLayer
│   └── views/        # Dashboard, GenomeEditor, Evolution
├── store/            # Zustand store
├── types/            # TypeScript types
├── lib/              # Utilities
└── styles/           # Global CSS
```

## Design System

- **Colors**: Monochrome (black, white, grays)
- **Typography**: IBM Plex Mono, Inter
- **Style**: NASA terminal aesthetic - sharp corners, no gradients, functional

## Keyboard Shortcuts

- `Delete` / `Backspace` - Remove selected module
- `Escape` - Cancel connection / deselect

## License

MIT
