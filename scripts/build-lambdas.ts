/**
 * Build All Lambdas Script
 *
 * Recursively finds and builds all Lambda functions that have a package.json with a build script.
 * Works on Windows, macOS, and Linux.
 *
 * Searches lambda dir and lambda/api dir for buildable functions.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface BuildResult {
    name: string;
    success: boolean;
    error?: string;
}

async function hasPackageJson(dir: string): Promise<boolean> {
    try {
        await stat(join(dir, "package.json"));
        return true;
    } catch {
        return false;
    }
}

async function buildLambda(name: string, path: string): Promise<BuildResult> {
    console.log(`Building: ${name}...`);
    try {
        const { stdout, stderr } = await execAsync("bun run build", { cwd: path });
        if (stdout) console.log(stdout.trim());
        if (stderr && !stderr.includes("warning")) console.error(stderr.trim());
        console.log(`✓ Built ${name}`);
        return { name, success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`✗ Failed to build ${name}: ${message}`);
        return { name, success: false, error: message };
    }
}

async function findLambdaDirs(baseDir: string): Promise<{ name: string; path: string }[]> {
    const lambdas: { name: string; path: string }[] = [];

    try {
        const entries = await readdir(baseDir);

        for (const entry of entries) {
            // Skip non-buildable directories
            if (entry === "shared" || entry === "node_modules" || entry.startsWith(".")) {
                continue;
            }

            const entryPath = join(baseDir, entry);
            const stats = await stat(entryPath);

            if (!stats.isDirectory()) continue;

            // Check if this directory is a Lambda (has package.json)
            if (await hasPackageJson(entryPath)) {
                lambdas.push({ name: entry, path: entryPath });
            }

            // Check subdirectories (for lambda/api/* structure)
            if (entry === "api") {
                const apiEntries = await readdir(entryPath);
                for (const apiEntry of apiEntries) {
                    const apiEntryPath = join(entryPath, apiEntry);
                    const apiStats = await stat(apiEntryPath);
                    if (apiStats.isDirectory() && (await hasPackageJson(apiEntryPath))) {
                        lambdas.push({ name: `api/${apiEntry}`, path: apiEntryPath });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error scanning lambda directory:", error);
    }

    return lambdas;
}

async function main() {
    const lambdaDir = join(process.cwd(), "lambda");
    console.log("🔍 Scanning for Lambda functions...\n");

    const lambdas = await findLambdaDirs(lambdaDir);

    if (lambdas.length === 0) {
        console.log("No Lambda functions found to build.");
        return;
    }

    console.log(`Found ${lambdas.length} Lambda functions to build:\n`);

    const results: BuildResult[] = [];

    for (const lambda of lambdas) {
        const result = await buildLambda(lambda.name, lambda.path);
        results.push(result);
        console.log(""); // Blank line between builds
    }

    // Summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    console.log("─".repeat(50));
    console.log(`\n✅ Built ${succeeded}/${results.length} Lambda functions`);

    if (failed.length > 0) {
        console.log(`\n❌ Failed builds:`);
        for (const f of failed) {
            console.log(`   - ${f.name}: ${f.error}`);
        }
        process.exit(1);
    }
}

main();
