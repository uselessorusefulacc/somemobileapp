import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const distDir = join(fileURLToPath(new URL("..", import.meta.url)), "dist");

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith(".js")) {
      fixFile(fullPath);
    }
  }
}

function fixFile(filePath) {
  let content = readFileSync(filePath, "utf-8");
  const original = content;
  content = content.replace(
    /(from\s+['"])(\.[^'"]+?)(['"])/g,
    (match, prefix, importPath, suffix) => {
      if (importPath.endsWith(".js")) return match;
      return prefix + importPath + ".js" + suffix;
    }
  );
  if (content !== original) {
    writeFileSync(filePath, content, "utf-8");
  }
}

walk(distDir);
console.log("[fix-extensions] Done fixing .js extensions in dist/");
