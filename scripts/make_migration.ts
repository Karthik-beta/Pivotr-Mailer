/**
 * Make Migration Script
 *
 * Scaffolds a new migration file with the next sequence number.
 *
 * Usage:
 *   bun run scripts/make_migration.ts "migration_name"
 */
import { write } from "bun";
import { readdir } from "node:fs/promises";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");
const INDEX_FILE = join(MIGRATIONS_DIR, "index.ts");
const RUN_FILE = join(MIGRATIONS_DIR, "run.ts");

async function main() {
    const args = process.argv.slice(2);
    const name = args[0];

    if (!name) {
        console.error("Usage: bun run scripts/make_migration.ts <migration_name>");
        process.exit(1);
    }

    // sanitize name
    const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    // Find next sequence number
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFiles = files.filter((f: string) => /^\d{3}_.*\.ts$/.test(f));

    let maxSeq = 0;
    for (const file of migrationFiles) {
        const match = file.match(/^(\d{3})_/);
        if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSeq) maxSeq = seq;
        }
    }

    const nextSeq = (maxSeq + 1).toString().padStart(3, "0");
    const fileName = `${nextSeq}_${safeName}.ts`;
    const filePath = join(MIGRATIONS_DIR, fileName);

    const functionName = safeName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

    const content = `/**
 * Migration ${nextSeq}: ${name}
 */
import { type Client, Databases } from "node-appwrite";
import { DATABASE_ID } from "../shared/constants/collection.constants";

export async function ${functionName}(client: Client): Promise<void> {
    const databases = new Databases(client);
    console.log("Running migration ${nextSeq}: ${name}");

    // TODO: Implement migration logic
    // await databases.createCollection(DATABASE_ID, "new_collection", "New Collection");
}
`;

    await write(filePath, content);
    console.log(`Created migration: ${fileName}`);

    // Update index.ts
    const indexContent = await Bun.file(INDEX_FILE).text();
    const exportStatement = `export * from "./${nextSeq}_${safeName}";`;
    if (!indexContent.includes(exportStatement)) {
        await write(INDEX_FILE, indexContent + "\n" + exportStatement);
        console.log("Updated index.ts");
    }

    // Update run.ts (Append import and call)
    // This is a naive update, looking for the last direct call or list end
    let runContent = await Bun.file(RUN_FILE).text();

    // Add import
    const importLine = `import { ${functionName} } from "./${nextSeq}_${safeName}";`;
    const lastImportRegex = /import .* from "\.\/\d{3}_.*";/g;
    const matchImport = [...runContent.matchAll(lastImportRegex)].pop();

    if (matchImport) {
        // Insert after last migration import
        const insertPos = matchImport.index! + matchImport[0].length;
        runContent = runContent.slice(0, insertPos) + "\n" + importLine + runContent.slice(insertPos);
    } else {
        // Fallback: insert after imports section (heuristic)
        runContent = importLine + "\n" + runContent;
    }

    // Add execution call
    // We look for the point before the final success message or end of function
    const executionCall = `
		console.log("─────────────────────────────────────────────────────────────────");
		console.log("Step ${maxSeq + 1}: ${name}...");
		await ${functionName}(client);`;

    const successMsgRegex = /console\.log\("✓ ALL MIGRATIONS COMPLETED SUCCESSFULLY"\);/;
    const successMatch = runContent.match(successMsgRegex);

    if (successMatch) {
        // Insert before the divider before success message
        // We search for the pattern usage
        const insertPos = successMatch.index!;
        // Backtrack to find a safe spot or just insert
        const safeInsertPos = runContent.lastIndexOf("console.log(\"════", insertPos);
        if (safeInsertPos !== -1) {
            runContent = runContent.slice(0, safeInsertPos) + executionCall + "\n\n\t\t" + runContent.slice(safeInsertPos);
            console.log("Updated run.ts");
        } else {
            console.warn("Could not simplify update run.ts. Please update manually.");
        }
    } else {
        console.warn("Could not find success message in run.ts. Please update manually.");
    }

    await write(RUN_FILE, runContent);
}

main();
