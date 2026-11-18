# notes

Dane Wang's personal site, built with [Eleventy (11ty)](https://www.11ty.dev) and deployed to GitHub Pages.

> **Style notice: the design of this site is fully based on [isunjn/serene](https://github.com/isunjn/serene).**
> serene is a blog theme for [Zola](https://www.getzola.org), released under the MIT License, copyright isunjn.
> The CSS, page structure, icons and parts of the scripts here are ported from serene. See [LICENSE-serene](./LICENSE-serene) for the license text.

## Development

```sh
pnpm install
pnpm dev    # preview at http://localhost:8080
pnpm build  # build to dist/
```

## Writing a post

Create a `.md` file in `src/posts/`. The file name becomes the URL.

```yaml
---
title: Post title
description: One-line summary
date: 2026-11-18
# updated: 2026-11-20
tags: [homelab]
# featured: true   # mark the post with an asterisk in lists
# toc: false       # hide the table of contents
# draft: true      # show the post in `pnpm dev` only
---
```

Posts support syntax highlighting, tables, footnotes, `> [!NOTE]` callouts, Mermaid diagrams and math. Put images in `src/assets/img/` and reference them as `/assets/img/<file>`.

Math is rendered by KaTeX at build time:

```latex
Inline: $E = mc^2$

Display:
$$
A = \begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$
```

To write a literal dollar sign before text that could look like math, escape it as `\$`. Inside a table cell, use `\vert` instead of `|`.

The site name, time zone, navigation and social links are in `src/_data/site.js`. Colors and fonts are at the top of `src/assets/main.css`.

## Deployment

Every push to `main` builds and publishes the site through `.github/workflows/deploy.yml`. Before the first deployment, go to the repository's Settings → Pages and set Source to **GitHub Actions**.

With the repository named `notes`, the site is served at `https://danewalters.github.io/notes/`. The workflow adapts the paths automatically for another repository name or a custom domain.

## Differences from serene

To keep the project small, the collections page, image lightbox, comments, emoji reactions, outdated-post alert and link prerendering are not ported. Syntax highlighting uses Prism with the GitHub Light and GitHub Dark palettes. Mermaid is loaded from jsDelivr, only on pages that contain a diagram.

All styles are plain CSS with native nesting, which requires Chrome 120, Safari 17.2, Firefox 117 or newer.

## License

The code derived from serene is under the MIT License. See [LICENSE-serene](./LICENSE-serene).
