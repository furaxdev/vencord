/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import { applyMobileStyles, removeMobileStyles } from "./styles";
import { patchTouchTargets } from "./touch";

export default definePlugin({
    name: "MobileHelper",
    description: "Improves Vencord usability on Android and other mobile devices",
    authors: [Devs.Ven],
    required: true,
    hidden: true,

    start() {
        applyMobileStyles();
        patchTouchTargets();
    },

    stop() {
        removeMobileStyles();
    }
});
