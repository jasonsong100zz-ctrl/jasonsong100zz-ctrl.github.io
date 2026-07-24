import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(
  projectRoot,
  process.argv[2] || "pages-dist",
);
const sourceDirectory = resolve(projectRoot, "dist", "client");
const workerFile = resolve(projectRoot, "dist", "server", "index.js");
const siteUrl =
  process.env.PAGES_SITE_URL || "https://jasonsong100zz-ctrl.github.io/";

if (
  outputDirectory === projectRoot ||
  !outputDirectory.startsWith(`${projectRoot}\\`) &&
    !outputDirectory.startsWith(`${projectRoot}/`)
) {
  throw new Error("The Pages output directory must stay inside the project.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, { recursive: true });

const workerUrl = pathToFileURL(workerFile);
workerUrl.searchParams.set("export", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request(siteUrl, {
    headers: { accept: "text/html" },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(`Static render failed with HTTP ${response.status}.`);
}

const html = (await response.text()).replaceAll(
  "http://localhost/",
  siteUrl,
);
await writeFile(resolve(outputDirectory, "index.html"), html, "utf8");
await writeFile(resolve(outputDirectory, ".nojekyll"), "", "utf8");

console.log(`Exported GitHub Pages site to ${outputDirectory}`);
