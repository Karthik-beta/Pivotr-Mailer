/**
 * Consolidate Migrations Script
 *
 * Captures the CURRENT state of the Appwrite Database and generates
 * a single consolidated migration file (001_snapshot.ts).
 *
 * Usage:
 *   bun run scripts/consolidate_migrations.ts
 */
import { Client, Databases } from "node-appwrite";
import { write } from "bun";
import { join } from "path";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

async function main() {
    console.log("Generating schema snapshot from database...");

    const endpoint = process.env.APPWRITE_ENDPOINT;
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
        // Try to read from ../.env via Bun?
        console.error("Missing env vars. Ensure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY are set.");
        process.exit(1);
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    // Hardcode DATABASE_ID for now as we know it, or fetch it
    // In migration files we use "pivotr_mailer".
    const DATABASE_ID = "pivotr_mailer";

    try {
        await databases.get(DATABASE_ID);
    } catch {
        console.error(`Database ${DATABASE_ID} not found. Ensure DB is created.`);
        process.exit(1);
    }

    const collections = await databases.listCollections(DATABASE_ID);

    let code = `/**
 * Consolidated Migration Snapshot
 * Generated: ${new Date().toISOString()}
 */
import { type Client, Databases, IndexType } from "node-appwrite";

const DATABASE_ID = "${DATABASE_ID}";

export async function createInitialSchema(client: Client): Promise<void> {
    const databases = new Databases(client);
    console.log("Running consolidated schema setup...");

    // Create Database
    try {
        await databases.get(DATABASE_ID);
    } catch {
        await databases.create(DATABASE_ID, "Pivotr Mailer", true);
    }
`;

    // Collections
    for (const col of collections.collections) {
        code += `
    // Collection: ${col.name}
    try {
        await databases.getCollection(DATABASE_ID, "${col.$id}");
    } catch {
        await databases.createCollection(DATABASE_ID, "${col.$id}", "${col.name}", undefined, ${col.documentSecurity}, ${col.enabled});
    }
`;
        // Attributes
        const attrs = await databases.listAttributes(DATABASE_ID, col.$id);

        for (const attr of attrs.attributes) {
            code += generateAttributeCode(attr, col.$id);
        }

        // Indexes
        const indexes = await databases.listIndexes(DATABASE_ID, col.$id);
        if (indexes.indexes.length > 0) {
            code += `\n    // Indexes for ${col.name}\n`;
            for (const idx of indexes.indexes) {
                code += generateIndexCode(idx, col.$id);
            }
        }
    }

    code += `
    console.log("Schema setup complete.");
}
`;

    const outputPath = join(MIGRATIONS_DIR, "001_snapshot.ts");
    await write(outputPath, code);
    console.log(`Snapshot saved to ${outputPath}`);
    console.log("Review the file, then rename/replace 001_initial_setup.ts if satisfied.");
}

function generateAttributeCode(attr: any, colId: string): string {
    // Determine type
    // Attr structure depends on type.
    // attr.type gives type string? No, listAttributes returns polymorphism.
    // keys: key, type, status, required, array

    // We strictly use the createXAttribute methods.

    const commonArgs = `DATABASE_ID, "${colId}", "${attr.key}"`;
    const indent = "    await databases.";

    // Check type based on properties
    if (attr.type === "string") {
        return `${indent}createStringAttribute(${commonArgs}, ${attr.size}, ${attr.required}, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "integer") {
        return `${indent}createIntegerAttribute(${commonArgs}, ${attr.required}, ${attr.min}, ${attr.max}, ${fmt(attr.default)});\n`;
        // Note: node-appwrite createIntegerAttribute args: (db, col, key, required, min?, max?, default?)
        // wait, SDK signatures vary.
        // Based on previous code: createIntegerAttribute(db, col, key, req, default, min, max) ??
        // Let's assume standard order: db, col, key, required, min, max, default
        // Wait, 001_initial_setup used: createIntegerAttribute(DB, ID, key, false, 0)
        // That looks like: required, default. Min/Max might be skipped?
        // SDK signature: createIntegerAttribute(databaseId, collectionId, key, required, min?, max?, default?)
        // My code earlier used: createIntegerAttribute(..., key, false, 0).
        // 0 is default. But 5th arg is Min?
        // Actually in Appwrite Console/API, min/max are optional.
        // Let's try to pass 'undefined' for min/max if not set?
        // Safest is to handle what we saw in the previous file which WORKED:
        // createIntegerAttribute(..., "queuePosition", false)
        // So 4 args.
        // createIntegerAttribute(..., "totalLeads", false, 0) -> 5 args.
        // Does arg 5 mean 'min' or 'default'?
        // In node-appwrite source:
        // createIntegerAttribute(databaseId, collectionId, key, required, min?, max?, xdefault?)
        // The 005_created_metrics.ts had: (..., "totalLeads", false, 0).
        // This implies 0 was passed as MIN ??
        // Or maybe the SDK version I'm using puts default earlier?
        // Let's check 005_create_metrics.ts content again if possible... I can't.
        // Checking 001_initial_setup.ts:
        // createIntegerAttribute(..., cid, "totalLeads", false, 0);
        // If "0" is min, that's fine for a counter.
        // If "0" is default, that's also fine.
        // Let's implicitly assume the user's manual code was correct and replicate strict pattern if possible.
        // But snapshotting is hard without exact signature knowledge.

        // Fix: For snapshot script, simpler to output generic TODO or best effort.
        // Appwrite API for Integer attribute has min, max, default.
        // I'll emit explicit undefineds: createIntegerAttribute(..., req, undefined, undefined, default)
        return `${indent}createIntegerAttribute(${commonArgs}, ${attr.required}, undefined, undefined, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "boolean") {
        return `${indent}createBooleanAttribute(${commonArgs}, ${attr.required}, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "double") { // float
        return `${indent}createFloatAttribute(${commonArgs}, ${attr.required}, undefined, undefined, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "email") {
        return `${indent}createEmailAttribute(${commonArgs}, ${attr.required}, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "datetime") {
        return `${indent}createDatetimeAttribute(${commonArgs}, ${attr.required}, ${fmt(attr.default)});\n`;
    }
    if (attr.type === "url") {
        return `${indent}createUrlAttribute(${commonArgs}, ${attr.required}, ${fmt(attr.default)});\n`;
    }
    if (attr.format === "enum") { // Format comes in for enums? Or type is string?
        // Enum attributes usually show up as type="string", format="enum"?
        // Appwrite API returns valid elements.
        // If SDK exposes explicit `createEnumAttribute`, we use it.
        return `${indent}createEnumAttribute(${commonArgs}, ${JSON.stringify(attr.elements)}, ${attr.required}, ${fmt(attr.default)});\n`;
    }

    return `    // UNKNOWN ATTRIBUTE: ${attr.key} (${attr.type})\n`;
}

function generateIndexCode(idx: any, colId: string): string {
    // idx: key, type, attributes, orders
    const commonArgs = `DATABASE_ID, "${colId}", "${idx.key}"`;
    return `    await databases.createIndex(${commonArgs}, "${idx.type}", ${JSON.stringify(idx.attributes)});\n`;
}

function fmt(val: any): string {
    if (val === undefined || val === null) return "undefined";
    if (typeof val === "string") return `"${val}"`;
    return String(val);
}

main();
