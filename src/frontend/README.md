# frontend

Everything the browser gets: components, their client-side state, and styling.

| Folder        | What it holds                                                 |
| ------------- | ------------------------------------------------------------- |
| `components/` | `ui/` primitives, then one folder per surface (tasks, meetings, doc, shell, …) |
| `lib/`        | Formatting and class-name helpers used only by components      |
| `styles/`     | `globals.css` — the design tokens every component resolves through |

Components call the server through the Server Functions in `src/backend/actions/`.
That import direction is the network boundary, not a layering violation: the
function body never ships to the browser, only a reference to it does.

No component writes a raw colour. Everything resolves through a token in
`styles/globals.css`.
