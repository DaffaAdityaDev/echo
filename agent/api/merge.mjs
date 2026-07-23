import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modulesDir = join(__dirname, "modules");
const outputPath = join(__dirname, "openapi.json");

function readJSON(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === "paths" || key === "schemas") {
      target[key] = { ...(target[key] || {}), ...source[key] };
    } else if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

if (!existsSync(modulesDir)) {
  console.error("Error: api/modules/ directory not found");
  process.exit(1);
}

const files = readdirSync(modulesDir).filter(
  (f) => f.endsWith(".json") && f !== "_base.json"
);
files.sort();

const base = readJSON(join(modulesDir, "_base.json"));
let result = JSON.parse(JSON.stringify(base));

for (const file of files) {
  const mod = readJSON(join(modulesDir, file));
  const label = file.replace(/\.json$/, "");
  const pathCount = Object.keys(mod.paths || {}).length;
  const schemaCount = Object.keys(mod.components?.schemas || {}).length;
  merge(result, mod);
  console.log(`  ${label}: ${pathCount} paths, ${schemaCount} schemas`);
}

writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\nWrote ${outputPath}`);
console.log(`Total: ${Object.keys(result.paths).length} paths`);
