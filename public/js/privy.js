// =============================================
// TEMPORARY STUB — replace with your real Privy integration
// =============================================
// This file was imported by chain.js and game.js but was missing from
// the project (its own <script> tag was commented out in index.html).
// That caused the whole module graph to fail to load, which is why the
// game never got past the loading/splash screen.
//
// This stub keeps the game fully playable in "guest mode" (no wallet,
// no on-chain runs) until you drop your real privy.js back in.
// Swap this file out and nothing else needs to change, as long as you
// keep the same exported function names/signatures.

let authenticated = false;

async function isAuthenticated() {
    return authenticated;
}

async function loginWithPrivy() {
    console.warn("[privy-stub] loginWithPrivy() called — no real Privy integration wired up yet.");
    authenticated = false;
    return null;
}

async function getWalletAddress() {
    return null;
}

async function getWalletPrivateKey() {
    return null;
}

async function checkSeasonPass() {
    return false;
}

async function activateSeasonPass() {
    console.warn("[privy-stub] activateSeasonPass() called — no real Privy integration wired up yet.");
    return { ok: false, reason: "privy-not-configured" };
}

export {
    isAuthenticated,
    loginWithPrivy,
    getWalletAddress,
    getWalletPrivateKey,
    checkSeasonPass,
    activateSeasonPass,
};
