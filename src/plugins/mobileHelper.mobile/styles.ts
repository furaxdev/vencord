/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const STYLE_ID = "vc-mobile-helper";

const CSS = `
/* Safe area: push content away from Android status bar and nav bar */
#app-mount {
    padding-top: var(--status-bar-height, env(safe-area-inset-top, 0px)) !important;
    padding-bottom: env(safe-area-inset-bottom, 0px) !important;
}

/* Prevent the user panel (profile) from hiding behind the system nav */
[class*="panels-"] {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4px) !important;
}

/* Push the top sidebar/toolbar below the status bar */
[class*="sidebar-"],
[class*="guilds-"],
[class*="base-"] > [class*="content-"] {
    margin-top: 0 !important;
}

/* Friends/DM tab bar: scrollable so nothing is clipped on the right */
[class*="privateChannels-"] [class*="header"],
[class*="friendsTableHead"],
[class*="tabBar-"] {
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
}

/* Hide the horizontal scrollbar while keeping scrollability */
[class*="tabBar-"]::-webkit-scrollbar {
    display: none;
}

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
