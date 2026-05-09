import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content");
const dataDir = path.join(rootDir, "data");

const CONTENT_TYPES = ["characters", "clans", "towns", "mesas", "regions"];

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }

  const [, frontmatterBlock, markdownBody] = match;
  const meta = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      meta[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    if (rawValue.includes(",")) {
      meta[key] = rawValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      continue;
    }

    meta[key] = rawValue;
  }

  return {
    meta,
    body: markdownBody.trim(),
  };
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length === 0) {
      return;
    }

    html.push("<ul>");
    for (const item of listBuffer) {
      html.push(`<li>${inlineMarkdown(item)}</li>`);
    }
    html.push("</ul>");
    listBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();

    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${inlineMarkdown(trimmed.slice(4))}</h3>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdown(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      html.push(`<h1>${inlineMarkdown(trimmed.slice(2))}</h1>`);
      continue;
    }

    html.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  flushList();
  return html.join("\n");
}

async function buildType(type) {
  const dir = path.join(contentDir, type);
  const entries = await readdir(dir, { withFileTypes: true });

  const records = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(dir, entry.name);
    const raw = await readFile(filePath, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const slug = meta.slug || entry.name.replace(/\.md$/i, "");

    records.push({
      ...meta,
      slug,
      category: type,
      body,
      bodyHtml: markdownToHtml(body),
    });
  }

  records.sort((a, b) => (a.name || a.title || a.slug).localeCompare(b.name || b.title || b.slug));

  await writeFile(path.join(dataDir, `${type}.json`), `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return records;
}

async function main() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    counts: {},
  };

  for (const type of CONTENT_TYPES) {
    const records = await buildType(type);
    manifest.counts[type] = records.length;
  }

  await writeFile(path.join(dataDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log("Content build complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
