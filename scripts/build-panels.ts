import { mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = resolve(import.meta.dirname, "..");
const panelsDir = resolve(root, "src/ui/panels");
const outDir = resolve(root, "dist/ui/panels");

mkdirSync(outDir, { recursive: true });

const htmlFiles = readdirSync(panelsDir).filter((f) => f.endsWith(".html"));

for (const file of htmlFiles) {
	await build({
		plugins: [viteSingleFile()],
		root: panelsDir,
		build: {
			outDir,
			emptyOutDir: false,
			rollupOptions: { input: resolve(panelsDir, file) },
			minify: true,
			cssMinify: true,
		},
		logLevel: "warn",
	});
}

console.log(`Built ${htmlFiles.length} panels → dist/ui/panels/`);
