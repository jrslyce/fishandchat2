# Fish and Chat - Game Design Document

## 1. Overview
**Fish and Chat** is a stream-integrated fishing game designed as a Twitch Extension (Video Overlay). Viewers can passively or actively fish directly on the stream video player. The game features an engaging core loop of casting, catching, selling, and crafting, with persistent progression and leaderboards.

## 2. Core Mechanics

### 2.1 The Fishing Loop
- **Casting**: Players initiate a cast using the action button. A "Cast Gauge" slider appears, requiring the player to lock in the timing for optimal cast precision.
- **Waiting for a Bite**: The bobber sits in the water. The wait time is determined by the bait equipped and active upgrades (e.g., LED Bobber).
- **The Bite**: A "BITE!" indicator flashes, and the player must react quickly to hook the fish. Reaction windows are influenced by player skill level and rod upgrades.
- **Catching**: A catch is drawn from a randomized loot table based on the player's effective skill level.

### 2.2 Catch Categories & Skill Tiers
Items are categorized by rarity:
1. **Trash** (Salvageable for crafting materials)
2. **Common**
3. **Uncommon**
4. **Rare**
5. **Epic**
6. **Legendary**

Catch probabilities shift as the player levels up and acquires better gear (e.g., Sonar Scanner reduces trash and increases higher-tier catches).

### 2.3 Bait & Shop
Players purchase bait using in-game credits (🪙). Better bait reduces bite wait times and temporarily boosts the player's effective skill level for the cast.
- **Pleb Bait** (Free): Standard rate.
- **Marshmallows** (25 🪙): Faster bites, +15 Skill.
- **Nightcrawlers** (100 🪙): -25% wait time, +25 Skill.
- **Neon Super Lure** (500 🪙): -50% wait time, +50 Skill.
- **Fishbots**: Auto-fishers (Mk I and Mk II) that catch fish autonomously while the viewer watches the stream, depositing them into a claimable hopper.

### 2.4 Market & Negotiation
Players carry catches in a **Basket** (limited capacity). To earn credits, they must sell fish to Monger Barnaby at the Market.
- **Sell Now**: Standard market value.
- **Haggle**: Risk a "Patience Bone" for +20% value.
- **Desperate**: High risk for +50% value.
If the Monger loses all patience (bones run out), the deal is rejected, or the value plummets.

### 2.5 Crafting & Recycling
"Trash" items (boots, cans, driftwood, etc.) are converted into specific crafting materials. Players use these materials along with credits to craft permanent upgrades at the Crafting Bench:
- **Carbon Rod**: Increases reaction timing windows.
- **LED Bobber**: Reduces bite wait times.
- **Turbo Bot Chip**: Overclocks auto-fishers for faster reactions.
- **Heavy Duty Basket & Tackle Apron**: Expands basket capacity.
- **Salvage Magnet**: Chance to double recycled materials.
- **Insulated Cooler**: Permanent +15% boost to market sale values.
- **Sonar Scanner**: Increases chances of catching Rare, Epic, and Legendary fish.

---

## 3. UI / UX Design

### 3.1 Visual Theme
The game utilizes a pixel-art / retro aesthetic with modern glassmorphism UI elements (`glass-ui`, `glass-panel`). The environment theme dynamically changes based on the player's rank (e.g., `forest-pond-theme` for beginners, `ocean-trench-theme` for intermediate, `cosmic-lake-theme` for masters).

### 3.2 Layout & Components
- **Extension Control Bar**: Allows users to adjust the opacity (so it doesn't block stream action) and snap the UI to different sizes (Small, Medium, Large). The UI can be dragged around the screen.
- **Compact HUD Row**: Displays player avatar, level, XP progress bar, credit balance, and current bait. Contains quick-access icons for the Shop, Market, Crafting Bench, and Leaderboards.
- **Water Zone**: The primary interaction area. Features animated CSS waves, bobber placement, bite indicators, and splash particle effects. Contains a floating action button (FAB) for casting.
- **Footer Row**: Shows player name, rank badge, and the last item caught.
- **Modals**: Detailed screens for the Shop, Market, Crafting, and Leaderboards overlay the water zone when opened.
- **Catch Celebration Card**: A pop-up modal featuring the fish's sprite, rarity glow, weight, and description when a successful catch occurs.

---

## 4. Muxy Tech Integration

The extension utilizes the **Muxy Twitch Extension SDK** for persistent state and leaderboards.

### 4.1 How it Works (Current Implementation)
- **SDK Initialization**: The game checks for `window.Muxy.SDK`. If present, it initializes the real SDK (`new window.Muxy.SDK()`). If not (e.g., local development), it falls back to a mock wrapper utilizing `localStorage`.
- **State Storage**: Uses `sdk.getStore("player_state", ...)` and `sdk.setStore("player_state", ...)` to save the player's inventory, credits, XP, and upgrades.
- **Leaderboards**: Submits cumulative catch weight using `sdk.submitLeaderboardScore("total_weight", ...)` and retrieves rankings via `sdk.getLeaderboard()`.

### 4.2 Missing Elements & Requirements for Correct Operation

To ensure the Muxy integration works correctly in a live Twitch environment, the following must be addressed:

1. **Muxy Setup Call (`Muxy.setup()`)**: 
   - The SDK *must* be initialized correctly before use. The code expects `window.Muxy.setupCalled` to be true. Ensure that `Muxy.setup({ extensionID: 'YOUR_EXT_ID' })` is explicitly called in the entry point before the game loop initializes.

2. **Twitch Developer Console Configuration**:
   - **Leaderboards**: The leaderboard `total_weight` must be explicitly created and configured in the Twitch/Muxy Developer Portal. If it is not configured on the backend, `submitLeaderboardScore` will fail silently.
   - **Configuration Service**: If streamer-specific settings (like custom fish names or streamer-triggered events) are desired, the Muxy Configuration Service needs to be implemented.

3. **Content Security Policy (CSP) & Packaging**:
   - Twitch has extremely strict CSPs. The `build-extension.cjs` script handles this by inlining CSS and packaging `muxy.js` locally. 
   - **DO NOT** attempt to load external fonts (like Google Fonts) or images from external CDNs directly in the HTML if the Twitch CSP restricts it. (Currently, Google Fonts are linked in `index.html`; this may need to be bundled locally or whitelisted in the Twitch Dev Console).

4. **Authentication State Handling**:
   - The SDK requires the user to grant identity access to store persistent data cross-session on the leaderboard. The UI has an `auth-screen`, but the logic must correctly tie `sdk.twitch.listen('onAuthorized')` to update the player's opaque ID or real Twitch username.

5. **Rate Limiting**:
   - Muxy and Twitch strictly rate-limit state saves (`setStore`). The game currently saves state frequently (e.g., on every catch or purchase). This needs to be debounced (e.g., save every 10 seconds or only on significant events) to prevent exceeding the pub/sub rate limits.
