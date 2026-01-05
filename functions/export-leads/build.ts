
import { build } from "bun";
import { rm, writeFile, readFile } from "fs/promises";
import { existsSync, mkdirSync } from "fs";

async function bundleFunction() {
    console.log("🚀 Starting Bundled Build...");
    const OUT_DIR = "./dist";
    const ENTRY_POINT = "./src/main.ts";

    // 1. Clean dist
    if (existsSync(OUT_DIR)) {
        await rm(OUT_DIR, { recursive: true, force: true });
    }
    mkdirSync(OUT_DIR);

    // 2. Bundle with Bun
    // We bundle EVERYTHING except 'node-appwrite' because it had issues last time.
    // ExcelJS and all its deep deps (fast-csv, archiver, lodash, streams) will be baked in.
    console.log("📦 Bundling source code...");
    const result = await build({
        entrypoints: [ENTRY_POINT],
        outdir: OUT_DIR,
        target: "node",
        format: "esm",
        minify: false, // keep readable for now
        external: ["node-appwrite", "node-fetch-native-with-agent"], // Externalize Appwrite SDK
    });

    if (!result.success) {
        console.error("❌ Build failed:", result.logs);
        process.exit(1);
    }

    // 3. Create stripped package.json for production
    console.log("📝 Creating production package.json...");
    const pkg = JSON.parse(await readFile("./package.json", "utf-8"));

    // We only keep dependencies that we externalized
    const prodDeps = {
        "node-appwrite": pkg.dependencies["node-appwrite"],
        "node-fetch-native-with-agent": pkg.dependencies["node-fetch-native-with-agent"]
    };

    const prodPkg = {
        name: pkg.name,
        type: "module", // Appwrite expects ESM if we output .js
        version: pkg.version,
        main: "main.js", // The bundled file
        dependencies: prodDeps
    };

    await writeFile(`${OUT_DIR}/package.json`, JSON.stringify(prodPkg, null, 2));

    // 4. Copy definitions if needed (likely baked in, but just in case)
    // Actually bun build bakes local imports too, so no need to copy src/definitions.ts

    console.log("✅ Build complete in ./dist");
    console.log("👉 Next steps:");
    console.log("1. cd dist");
    console.log("2. bun install");
    console.log("3. Deploy the dist folder");
}

bundleFunction();
