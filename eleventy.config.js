import { readdirSync, readFileSync } from "node:fs";
import { HtmlBasePlugin } from "@11ty/eleventy";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import katex from "katex";
import footnote from "markdown-it-footnote";
import site from "./src/_data/site.js";

const POSTS_GLOB = "src/posts/*.md";
const DAY_MS = 86_400_000;

// Ids used by the page templates, which headings must not reuse.
const TEMPLATE_IDS = readdirSync("src/_includes").flatMap((file) =>
  [...readFileSync(`src/_includes/${file}`, "utf8").matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]),
);

// Keeps CJK characters, unlike Eleventy's built-in slugify filter.
const slugify = (text) =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

// Spells out symbols, so that "C++", "C#" and "C" get separate tag pages.
const TAG_SYMBOLS = { "+": "plus", "#": "sharp", "&": "and", "@": "at", ".": "dot" };
const tagSlug = (name) =>
  slugify(
    String(name).replace(
      /[^\p{L}\p{M}\p{N}\s_-]/gu,
      (symbol) => ` ${TAG_SYMBOLS[symbol] ?? `u${symbol.codePointAt(0).toString(16)}`} `,
    ),
  ) || "tag";

// Adds an id and a hover "#" link to every heading.
function headingAnchors(md) {
  md.core.ruler.push("heading_anchors", (state) => {
    const used = new Set(TEMPLATE_IDS);
    state.tokens.forEach((token, i) => {
      if (token.type !== "heading_open") return;
      const inline = state.tokens[i + 1];
      const text = inline.children
        .map((child) => {
          if (child.type === "math_inline") return `${child.markup}${child.content}${child.markup}`;
          return child.type === "text" || child.type === "code_inline" ? child.content : "";
        })
        .join("");
      const base = slugify(text) || "section";
      let id = base;
      for (let count = 1; used.has(id); count++) id = `${base}-${count}`;
      used.add(id);
      token.attrSet("id", id);
      // Rendered math can't be reduced to plain text, so keep the source for the table of contents.
      if (inline.children.some((child) => child.type === "math_inline")) {
        token.attrSet("data-toc", text);
      }
      const anchor = new state.Token("html_inline", "", 0);
      anchor.content = `<a class="heading-anchor" href="#${id}" aria-label="Anchor link for: ${id}"></a>`;
      inline.children.push(anchor);
    });
  });
}

// GitHub-style alerts: "> [!NOTE]" on the first line of a blockquote.
function githubAlerts(md) {
  md.core.ruler.push("github_alerts", (state) => {
    const { tokens } = state;
    for (let i = tokens.length - 3; i >= 0; i--) {
      if (tokens[i].type !== "blockquote_open" || tokens[i + 1].type !== "paragraph_open") continue;
      const children = tokens[i + 2].children;
      const match = children[0]?.type === "text"
        && children[0].content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
      if (!match) continue;
      tokens[i].attrJoin("class", `markdown-alert-${match[1].toLowerCase()}`);
      const hasLineBreak = children[1]?.type === "softbreak" || children[1]?.type === "hardbreak";
      children.splice(0, hasLineBreak ? 2 : 1);
      if (!children.length) tokens.splice(i + 1, 3);
    }
  });
}

// Renders footnotes with the markup serene's styles expect.
// The ":" in their ids keeps them apart from heading ids, which never contain one.
function sereneFootnotes(md) {
  md.use(footnote);
  const { rules } = md.renderer;
  const name = (tokens, idx, options, env, self) =>
    rules.footnote_anchor_name(tokens, idx, options, env, self);
  rules.footnote_ref = (tokens, idx, options, env, self) => {
    const id = name(tokens, idx, options, env, self);
    return `<sup class="footnote-reference"><a href="#fn:${id}">${tokens[idx].meta.id + 1}</a></sup>`;
  };
  rules.footnote_open = (tokens, idx, options, env, self) => {
    const id = name(tokens, idx, options, env, self);
    return `<div class="footnote-definition" id="fn:${id}"><sup class="footnote-definition-label">${tokens[idx].meta.id + 1}</sup>`;
  };
  rules.footnote_close = () => "</div>";
  rules.footnote_block_open = () => "";
  rules.footnote_block_close = () => "";
  rules.footnote_anchor = () => "";
}

// Renders Mermaid diagrams, and escapes "text" and unknown languages,
// which the highlight plugin would otherwise return as raw HTML.
function codeFences(md) {
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    if (tokens[idx].info.trim() === "mermaid") {
      return `<pre class="mermaid">${md.utils.escapeHtml(tokens[idx].content)}</pre>\n`;
    }
    const highlight = (code, lang, attrs) => {
      // Prism escapes "<" in the languages it supports; the fallback leaves it as is.
      const isSupported = options.highlight("<", lang, attrs).includes("&lt;");
      return options.highlight(isSupported ? code : md.utils.escapeHtml(code), lang, attrs);
    };
    return fence(tokens, idx, { ...options, highlight }, env, self);
  };
}

// Lets wide tables scroll sideways on small screens.
function scrollableTables(md) {
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";
}

// Math: $inline$ and $$display$$, rendered to HTML at build time.
// Parsed before Markdown so that "\\", "_" and "*" reach KaTeX untouched.
function math(md) {
  const render = (tex, displayMode) =>
    katex.renderToString(tex, { displayMode, throwOnError: false, strict: false });

  md.inline.ruler.before("escape", "math_inline", (state, silent) => {
    const { src, pos, posMax } = state;
    if (src[pos] !== "$") return false;
    const delimiter = src[pos + 1] === "$" ? "$$" : "$";
    const start = pos + delimiter.length;
    let end = start;
    while (end < posMax && !src.startsWith(delimiter, end)) end += src[end] === "\\" ? 2 : 1;
    if (end >= posMax || end === start) return false;
    // Keeps prices and shell text such as "US$100", "$HOME:${PATH}" and "echo $$ and $$" plain.
    if (
      /\s/.test(src[start]) ||
      /\s/.test(src[end - 1]) ||
      /[A-Za-z$]/.test(src[pos - 1] ?? "") ||
      /[A-Za-z0-9_({$]/.test(src[end + delimiter.length] ?? "") ||
      src.slice(start, end).includes("`")
    ) {
      return false;
    }
    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = src.slice(start, end);
      token.markup = delimiter;
    }
    state.pos = end + delimiter.length;
    return true;
  });

  md.block.ruler.before(
    "fence",
    "math_block",
    (state, startLine, endLine, silent) => {
      const lineText = (line) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
      const first = lineText(startLine).trimEnd();
      if (state.sCount[startLine] - state.blkIndent >= 4 || !first.startsWith("$$")) return false;

      const opening = first.slice(2);
      const endsWithOnlyDelimiter = (text) => text.indexOf("$$") === text.length - 2;
      let closeLine = startLine;
      let parts;
      if (opening.includes("$$")) {
        // "$$a$$ and $$b$$" or "$$a$$ text" is inline math inside a paragraph.
        if (!endsWithOnlyDelimiter(opening)) return false;
        parts = [opening.slice(0, -2)];
      } else {
        // A formula can't span a blank line, so an unclosed "$$" never swallows later paragraphs.
        for (closeLine = startLine + 1; closeLine < endLine; closeLine++) {
          if (state.isEmpty(closeLine) || state.sCount[closeLine] < state.blkIndent) return false;
          const text = lineText(closeLine).trimEnd();
          if (!text.includes("$$")) continue;
          if (!endsWithOnlyDelimiter(text)) return false;
          break;
        }
        if (closeLine >= endLine) return false;
        parts = [
          opening,
          state.getLines(startLine + 1, closeLine, state.sCount[startLine], false),
          lineText(closeLine).trimEnd().slice(0, -2),
        ];
      }
      const content = parts.filter((part) => part.trim()).join("\n");
      if (!content) return false;
      if (silent) return true;

      const token = state.push("math_block", "math", 0);
      token.block = true;
      token.content = content;
      token.markup = "$$";
      token.map = [startLine, closeLine + 1];
      state.line = closeLine + 1;
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] },
  );

  md.renderer.rules.math_inline = (tokens, idx) =>
    render(tokens[idx].content, tokens[idx].markup === "$$");
  md.renderer.rules.math_block = (tokens, idx) => `${render(tokens[idx].content, true)}\n`;
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.amendLibrary("md", (md) => {
    md.use(math)
      .use(sereneFootnotes)
      .use(githubAlerts)
      .use(headingAnchors)
      .use(codeFences)
      .use(scrollableTables);
  });

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "node_modules/katex/dist/katex.min.css": "assets/katex/katex.min.css",
    "node_modules/katex/dist/fonts/*.woff2": "assets/katex/fonts",
  });

  // Posts with `draft: true` show up in `pnpm dev` but not in `pnpm build`.
  eleventyConfig.addPreprocessor("drafts", "md", (data) => {
    if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
  });

  const newestFirst = (api) => api.getFilteredByGlob(POSTS_GLOB).reverse();

  eleventyConfig.addCollection("posts", newestFirst);
  eleventyConfig.addCollection("tagList", (api) => {
    const tags = new Map();
    for (const post of newestFirst(api)) {
      for (const name of post.data.tags ?? []) {
        const slug = tagSlug(name);
        if (!tags.has(slug)) tags.set(slug, { name, slug, posts: [] });
        tags.get(slug).posts.push(post);
      }
    }
    return [...tags.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  });

  eleventyConfig.addFilter("tagSlug", tagSlug);
  eleventyConfig.addFilter("icon", (name) =>
    readFileSync(`src/assets/icon/${name}.svg`, "utf8").trim(),
  );
  eleventyConfig.addFilter("readableDate", (date) => {
    const value = new Date(date);
    // A date without a time is parsed as midnight UTC and has no time zone of its own.
    const isDateOnly = value.getTime() % DAY_MS === 0;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: isDateOnly ? "UTC" : site.timeZone,
    }).format(value);
  });
  eleventyConfig.addFilter("isoDate", (date) => new Date(date).toISOString());
  eleventyConfig.addFilter("latestUpdate", (posts) =>
    new Date(Math.max(...posts.map((post) => new Date(post.data.updated ?? post.date).getTime()))),
  );
  eleventyConfig.addFilter("hasMermaid", (html) => String(html).includes('<pre class="mermaid">'));
  eleventyConfig.addFilter("hasMath", (html) => String(html).includes('<span class="katex'));
  eleventyConfig.addFilter("absoluteUrls", (html, siteUrl) =>
    String(html).replace(/(href|src)="\/(?!\/)/g, `$1="${siteUrl}/`),
  );

  // Table of contents: the two shallowest heading levels used in the post.
  eleventyConfig.addFilter("headings", (html) => {
    const pattern = /<h([1-6]) id="([^"]+)"(?: data-toc="([^"]*)")?[^>]*>(.*?)<\/h\1>/gs;
    const found = [...String(html).matchAll(pattern)].map((m) => ({
      level: Number(m[1]),
      id: m[2],
      title: m[3] ?? m[4].replace(/<[^>]+>/g, "").trim(),
    }));
    const top = Math.min(...found.map((heading) => heading.level));
    return found
      .filter((heading) => heading.level <= top + 1)
      .map((heading) => ({ ...heading, className: heading.level === top ? "h2" : "h3" }));
  });
}

export const config = {
  dir: { input: "src", output: "dist" },
  // Set by the deploy workflow, so the site also works from a project URL.
  pathPrefix: process.env.PATH_PREFIX || "/",
  markdownTemplateEngine: false,
  htmlTemplateEngine: "njk",
};
