/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// On mobile, Discord's context menus are triggered by long-press.
// Some Vencord UI elements only react to right-click, so we simulate
// a contextmenu event on long-press for those elements.

const LONG_PRESS_MS = 500;

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let pressTarget: EventTarget | null = null;

function onTouchStart(e: TouchEvent) {
    pressTarget = e.target;
    pressTimer = setTimeout(() => {
        if (!pressTarget) return;
        const touch = e.touches[0];
        const ctx = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: touch.clientX,
            clientY: touch.clientY,
        });
        (pressTarget as Element).dispatchEvent(ctx);
        pressTarget = null;
    }, LONG_PRESS_MS);
}

function cancelPress() {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    pressTarget = null;
}

export function patchTouchTargets() {
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", cancelPress, { passive: true });
    document.addEventListener("touchend", cancelPress, { passive: true });
}

export function unpatchTouchTargets() {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", cancelPress);
    document.removeEventListener("touchend", cancelPress);
}
