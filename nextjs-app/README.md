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
