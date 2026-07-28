# Contributing to Exoskeleton

Contributions are welcome. Before opening a pull request, please read the short
licensing note below — it exists for a specific structural reason, not as
boilerplate.

## Licensing of contributions

Exoskeleton is released under the **GNU Affero General Public License v3.0**
(see [LICENSE](LICENSE)), and is *also* offered under separate commercial terms
to organizations that want to build on it without AGPL obligations. That second
arrangement only works if one person holds the rights to the whole codebase.

So, by submitting a contribution, you agree that:

1. You wrote it, or otherwise have the right to submit it.
2. You license your contribution to the project under the AGPL-3.0, **and**
3. You grant Harold Tajchman a perpetual, worldwide, irrevocable, royalty-free
   right to use, modify, and sublicense your contribution under other terms,
   including commercial licenses.

You keep the copyright in what you wrote. This grant is what allows the project
to stay open source *and* fund itself; without it, a single merged pull request
would permanently block commercial licensing of that file.

If you'd rather not grant that, say so in the pull request — an idea, a bug
report, or a reproduction case is genuinely valuable on its own and carries no
such requirement.

*(This is a plain-language contributor agreement, not a lawyer-drafted CLA. If
the project grows to the point where that matters, it will be replaced with a
proper one.)*

## Practical notes

- **Read [CLAUDE.md](CLAUDE.md) and [docs/AGENTS-FAQ.md](docs/AGENTS-FAQ.md)
  first.** Most recurring design questions are already answered there, in
  test-case shape. Don't re-derive an answer that exists.
- **Panels come from the component library.** New panels are usually developed
  in `exoskeleton-component-library` against the `PanelManifest` contract in
  [src/panel-manifest.ts](src/panel-manifest.ts) rather than added directly here.
- **Don't break the invariants.** Several odd-looking constraints — never
  calling `addPanel` without a `position`, wrapping rather than replacing
  Dockview's default tab, keeping `dragDropEnabled: false` — each fix a real
  bug. [docs/ship-plan.md](docs/ship-plan.md) lists them with the reasons.
- **Run `npm run build && npm test`** before opening a pull request.
- **One coherent change per pull request.** Drive-by reformatting makes review
  disproportionately expensive.
</content>
