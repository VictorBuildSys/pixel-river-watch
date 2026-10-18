<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Deploy

## API and navigation

- GlobalSat uses a separate typed server-function proxy and pure notification normalization; validate XML with fast-xml-parser and accept JSON too, because the external service negotiates both formats.
- Keep the dashboard and GlobalSat as separate leaf routes and reuse AppNavigation in their headers, because dashboard-specific controls must remain on the dashboard.

- The external deploy target is pinned in `vite.config.ts` (`nitro.preset`) and `netlify.toml` must keep its `publish` directory matching that preset's static output. Why: Lovable's own build pins its target and output layout on its own, so these two files are the only description of the external host.
