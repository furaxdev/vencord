#!/usr/bin/env node
/*
 * Vencord4Mobile – Discord APK patcher
 * Injects the Vencord mobile bundle into Discord's React-Native JS bundle.
 *
 * Usage:
 *   node scripts/patchApk.mjs <path-to-decoded-apk-dir>
 *
 * The script:
 *  1. Finds index.android.bundle inside the decoded APK directory
 *  2. Prepends a loader shim that bootstraps Vencord inside React Native
 *  3. Writes the patched bundle back in place
 *
 * The Vencord mobile bundle (dist/Vencord.mobile.user.js) must already exist.
 * Run `pnpm buildWeb` first.
 */

// @ts-check
import { readFile, writeFile, readdir } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";

const [, , apkDir] = process.argv;
if (!apkDir) {
    console.error("Usage: node scripts/patchApk.mjs <decoded-apk-dir>");
    process.exit(1);
}

// ── Find the RN bundle ─────────────────────────────────────────────────────
async function findBundle(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = await findBundle(full);
            if (found) return found;
        } else if (entry.name === "index.android.bundle") {
            return full;
        }
    }
    return null;
}

const bundlePath = await findBundle(resolve(apkDir));
if (!bundlePath) {
    console.error("index.android.bundle not found in", apkDir);
    process.exit(1);
}
console.log("Found bundle:", bundlePath);

// ── Load Vencord JS ────────────────────────────────────────────────────────
const vencordPath = resolve("dist/Vencord.mobile.user.js");
if (!existsSync(vencordPath)) {
    console.error("dist/Vencord.mobile.user.js not found – run `pnpm buildWeb` first");
    process.exit(1);
}
const vencordJs = await readFile(vencordPath, "utf-8");

// ── Build the shim ─────────────────────────────────────────────────────────
// Discord's RN bundle exposes __r (require) and __d (define) globally.
// We hook in very early so Vencord can set up its patches before modules load.
// The shim wraps Vencord in a try/catch so a broken Vencord never crashes Discord.
const shim = `
// ===== Vencord4Mobile injection shim =====
(function() {
    "use strict";
    try {
        // Provide a minimal stub for things Vencord expects in a browser context
        // that don't exist in React Native.
        if (typeof window === "undefined") { global.window = global; }
        if (typeof document === "undefined") {
            global.document = {
                createElement: function(tag) {
                    return { style: {}, setAttribute: function() {}, appendChild: function() {} };
                },
                head: { appendChild: function() {} },
                body: { appendChild: function() {} },
                getElementById: function() { return null; },
                querySelector: function() { return null; },
                querySelectorAll: function() { return []; },
                addEventListener: function() {},
                removeEventListener: function() {},
            };
        }
        if (typeof navigator === "undefined") {
            global.navigator = { userAgent: "VencordMobile/1.0 Mobi", platform: "Android" };
        }

        // ── Vencord bundle ───────────────────────────────────────────────
${vencordJs}
        // ── End Vencord bundle ───────────────────────────────────────────

        console.log("[Vencord4Mobile] Injected successfully");
    } catch (e) {
        console.error("[Vencord4Mobile] Injection failed:", e && e.message);
    }
})();
// ===== End Vencord4Mobile injection shim =====

`;

// ── Patch ──────────────────────────────────────────────────────────────────
const original = await readFile(bundlePath, "utf-8");

if (original.includes("Vencord4Mobile injection shim")) {
    console.log("Bundle already patched – skipping");
    process.exit(0);
}

await writeFile(bundlePath, shim + original, "utf-8");
console.log("Bundle patched successfully:", bundlePath);
