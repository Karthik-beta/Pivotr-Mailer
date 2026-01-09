import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

async function buildLambdas() {
    const lambdaDir = join(process.cwd(), 'lambda');

    try {
        const entries = await readdir(lambdaDir);

        for (const entry of entries) {
            const entryPath = join(lambdaDir, entry);
            const stats = await stat(entryPath);

            if (stats.isDirectory()) {
                // Check if it has a package.json
                try {
                    await stat(join(entryPath, 'package.json'));
                    console.log(`Building lambda: ${entry}...`);

                    try {
                        const { stdout, stderr } = await execAsync('bun run build', { cwd: entryPath });
                        if (stdout) console.log(stdout);
                        if (stderr) console.error(stderr);
                        console.log(`✓ Built ${entry}`);
                    } catch (error) {
                        console.error(`✗ Failed to build ${entry}:`, error.message);
                        process.exit(1);
                    }
                } catch (err) {
                    // No package.json, skip
                    if (err.code !== 'ENOENT') {
                        console.warn(`Warning checking ${entry}:`, err.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error reading lambda directory:', error);
        process.exit(1);
    }
}

buildLambdas();
