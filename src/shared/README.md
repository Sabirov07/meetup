# shared

Pure logic that both sides run, with no database and no DOM imports — which is
what makes it safe to use in a Server Component and in the browser alike.

| Folder    | What it holds                                                      |
| --------- | ------------------------------------------------------------------ |
| `domain/` | Types, priority scoring, filters, statistics, labels, recommendations |
| `doc/`    | The document format: Markdown parsing and the editor's text transforms |

It lives apart from `backend/` and `frontend/` because filing it under either
one would be a lie about who depends on it: the task list scores priorities in
the browser with the same function the server uses.
