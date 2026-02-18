/**
 * Cleanup script for development environment.
 * Kills all SAM processes, Docker containers, and removes lock files.
 */
import { spawnSync } from "child_process";
import { existsSync, unlinkSync } from "fs";

console.log("Cleaning up development environment...");

// Delete PM2 processes
try {
    spawnSync("pm2", ["delete", "ecosystem.config.cjs"], { stdio: "ignore" });
} catch {
    // Ignore errors
}

// Kill SAM processes
try {
    spawnSync("taskkill", ["/F", "/IM", "sam.exe"], { stdio: "ignore" });
} catch {
    // Ignore errors
}

// Kill Docker containers
try {
    spawnSync("cmd", [
        "/c",
        'docker ps -q --filter "ancestor=samcli/lambda-nodejs*" | xargs docker kill 2>nul'
    ], { shell: true, stdio: "ignore" });
} catch {
    // Ignore errors
}

// Remove Docker containers
try {
    spawnSync("cmd", [
        "/c",
        'docker ps -aq --filter "ancestor=samcli/lambda-nodejs*" | xargs docker rm 2>nul'
    ], { shell: true, stdio: "ignore" });
} catch {
    // Ignore errors
}

// Remove lock file
const LOCK_FILE = ".dev-api.lock";
if (existsSync(LOCK_FILE)) {
    try {
        unlinkSync(LOCK_FILE);
        console.log("Removed lock file.");
    } catch {
        // Ignore errors
    }
}

console.log("Cleanup complete.");
