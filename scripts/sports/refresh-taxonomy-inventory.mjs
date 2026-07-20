import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT = "src/features/sports/i18n/taxonomyInventory.json";
const ALLOWED_NODE_TYPES = new Set(["sport", "league"]);

function parseArgs(argv) {
  const options = { output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith("--base-url=")) {
      options.baseUrl = argument.slice("--base-url=".length);
      continue;
    }
    if (argument === "--base-url") {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--output=")) {
      options.output = argument.slice("--output=".length);
      continue;
    }
    if (argument === "--output") {
      options.output = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.baseUrl) throw new Error("--base-url is required");
  return options;
}

async function fetchTaxonomy(baseUrl, section) {
  const url = new URL(`/api/v1/${section}/taxonomy`, baseUrl);
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

function flattenSection(response, expectedSection) {
  const sections = response?.sections;
  if (!Array.isArray(sections)) {
    throw new Error(`${expectedSection} response is missing sections`);
  }
  const section = sections.find((item) => item?.section === expectedSection);
  if (!section || !Array.isArray(section.children)) {
    throw new Error(`${expectedSection} response is missing its taxonomy tree`);
  }

  const rows = [];
  const visit = (node, parentSlug = null) => {
    const resolvedSection = node?.section || expectedSection;
    if (resolvedSection !== expectedSection) {
      throw new Error(
        `Node ${String(node?.slug)} belongs to unexpected section ${resolvedSection}`,
      );
    }
    if (!ALLOWED_NODE_TYPES.has(node?.node_type)) {
      throw new Error(
        `Node ${String(node?.slug)} has unsupported node_type ${String(node?.node_type)}`,
      );
    }
    if (typeof node?.slug !== "string" || node.slug.trim() === "") {
      throw new Error("Taxonomy node has an empty slug");
    }
    if (node.slug.includes(".") || node.slug.includes(":")) {
      throw new Error(`Node ${node.slug} contains an i18next key separator`);
    }
    if (typeof node?.label !== "string" || node.label.trim() === "") {
      throw new Error(`Node ${node.slug} has an empty label`);
    }
    rows.push({
      section: resolvedSection,
      node_type: node.node_type,
      slug: node.slug,
      label: node.label,
      parent_slug: parentSlug,
    });
    for (const child of node.children ?? []) visit(child, node.slug);
  };

  for (const child of section.children) visit(child);
  return rows;
}

function compareRows(previous, next) {
  const keyOf = (row) => `${row.section}:${row.node_type}:${row.slug}`;
  const before = new Map(previous.map((row) => [keyOf(row), row]));
  const after = new Map(next.map((row) => [keyOf(row), row]));
  const added = [...after.keys()].filter((key) => !before.has(key));
  const removed = [...before.keys()].filter((key) => !after.has(key));
  const changed = [...after.keys()].filter((key) => {
    const oldRow = before.get(key);
    const newRow = after.get(key);
    return (
      oldRow &&
      (oldRow.label !== newRow.label ||
        oldRow.parent_slug !== newRow.parent_slug)
    );
  });
  return { added, removed, changed };
}

async function readPrevious(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = resolve(options.output);
  const baseUrl = options.baseUrl.endsWith("/")
    ? options.baseUrl
    : `${options.baseUrl}/`;
  const [sports, esports] = await Promise.all([
    fetchTaxonomy(baseUrl, "sports"),
    fetchTaxonomy(baseUrl, "esports"),
  ]);
  const nodes = [
    ...flattenSection(sports, "sports"),
    ...flattenSection(esports, "esports"),
  ].sort((left, right) =>
    [left.section, left.node_type, left.slug]
      .join(":")
      .localeCompare([right.section, right.node_type, right.slug].join(":")),
  );

  const identities = new Set();
  for (const node of nodes) {
    const identity = `${node.section}:${node.node_type}:${node.slug}`;
    if (identities.has(identity)) {
      throw new Error(`Duplicate taxonomy identity: ${identity}`);
    }
    identities.add(identity);
  }

  const previous = await readPrevious(outputPath);
  const changes = compareRows(previous, nodes);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ version: 1, nodes }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `${JSON.stringify({ output: outputPath, nodes: nodes.length, ...changes }, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
