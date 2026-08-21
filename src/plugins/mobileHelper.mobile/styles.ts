/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const STYLE_ID = "vc-mobile-helper";

const CSS = `
/* Make Vencord settings accessible on mobile (larger tap targets) */
[class*="titleBar"] button,
[class*="toolbar"] button {
    min-width: 44px;
    min-height: 44px;
}

/* Prevent unwanted text selection during touch interactions */
[class*="message"]:not(input):not(textarea) {
    -webkit-user-select: none;
    user-select: none;
}

/* Settings modal scrollable on mobile */
[class*="layerContainer"] [class*="contentRegion"] {
    -webkit-overflow-scrolling: touch;
}

/* Ensure Vencord plugin cards don't overflow on narrow screens */
.vc-settings-plugin-grid > * {
    min-width: 0;
}

/* Make modal close buttons easier to tap */
[class*="closeButton"] {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Vencord toolbox button: larger tap target */
.vc-toolbox-btn {
    min-width: 44px !important;
    min-height: 44px !important;
}
`;

export function applyMobileStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

export function removeMobileStyles() {
    document.getElementById(STYLE_ID)?.remove();
}
