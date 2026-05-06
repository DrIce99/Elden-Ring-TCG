// ============================================================
// CARD EFFECTS — Full effect system for Elden Ring TCG
// ============================================================
// Load order: card_effects.js → turn-manager.js → game_rules.js → table.js
// ============================================================

// ============================================================
// GAME EVENTS
// ============================================================
window.EVENTS = Object.freeze({
    TURN_START:       'turn_start',
    DRAW:             'draw',
    SUMMON:           'summon',
    BEFORE_ACTION:    'before_action',
    AFTER_ACTION:     'after_action',
    DAMAGE:           'damage',
    UNIT_DEATH:       'unit_death',
    DIRECT_DAMAGE:    'direct_damage',
    TURN_END:         'turn_end',
    RESOLUTION_START: 'resolution_start',
    RESOLUTION_END:   'resolution_end',
    EQUIP:            'equip',
    SUPPORT_ENTER:    'support_enter',
    RUNE_CHANGE:      'rune_change',
    BLOOD_LOSS:       'blood_loss',
});

// ============================================================
// STATUS ICONS & COLORS (for visual badges)
// ============================================================
const STATUS_ICONS = {
    bleed:      '🩸', stun:      '💫', burn:       '🔥',
    freeze:     '❄️', poison:    '☠️', shield:     '🛡️',
    regen:      '💚', cursed:    '💀', empowered:  '⚡',
    atk_up:     '⬆️', fire_atk:  '🔥',
};
const STATUS_COLORS = {
    bleed:     '#b03030', stun:     '#8060d0', burn:      '#c06010',
    freeze:    '#4090c0', poison:   '#508040', shield:    '#4070a0',
    regen:     '#30a060', cursed:   '#601060', empowered: '#c0a020',
    atk_up:    '#d09020', fire_atk: '#c05010',
};

// ============================================================
// EFFECT REGISTRY — card id → effect definition
// Each entry has:
//   trigger:   EVENTS key (when passive) | 'phase3' (active, player-prompted)
//   phase:     3 | null
//   auto:      true = triggers without confirmation (support passives)
//   label:     UI label shown in confirmation modal
//   icon:      emoji prefix
//   execute:   async (ctx) => void  — the actual effect
//   condition: (ctx) => bool        — optional, default true
// ============================================================
const EFFECT_REGISTRY = {

    // ----------------------------------------------------------
    // 210 — Flask of Crimson Tears
    // Equipped or used from hand during planning:
    // Send to Erdtree → Heal a chosen ally unit
    // ----------------------------------------------------------
    '210': {
        trigger: 'phase3',
        label:   'Flask of Crimson Tears',
        icon:    '🧪',
        desc:    'Send to Erdtree. Restore HP of a chosen ally unit.',
        execute: async (ctx) => {
            const slot = await _pickUnitSlot('player', 'Choose a unit to heal');
            if (!slot) return;
            const key   = _slotKey('player', slot);
            const state = window.GameState.unitStates[key];
            if (!state) return;
            const heal  = Math.round(state.maxHp * 0.30); // 30% max HP
            state.hp    = Math.min(state.maxHp, state.hp + heal);
            window._showHPBadge?.(slot, state.hp);
            _spawnFloatingText(slot, `+${heal} HP`, '#44ee88');
            _sendToErdtree(ctx.card, ctx.owner);
            ctx.removeFromSource();
        },
    },

    // ----------------------------------------------------------
    // 310 — Flask of Cerulean Tears
    // Send to Erdtree → Restore FP of a chosen ally unit
    // ----------------------------------------------------------
    '310': {
        trigger: 'phase3',
        label:   'Flask of Cerulean Tears',
        icon:    '💧',
        desc:    'Send to Erdtree. Restore FP of a chosen ally unit.',
        execute: async (ctx) => {
            const slot = await _pickUnitSlot('player', 'Choose a unit to restore FP');
            if (!slot) return;
            const key   = _slotKey('player', slot);
            const state = window.GameState.unitStates[key];
            if (!state || !state.maxFp) return;
            const restore  = Math.round(state.maxFp * 0.40); // 40% max FP
            state.fp       = Math.min(state.maxFp, (state.fp || 0) + restore);
            _spawnFloatingText(slot, `+${restore} FP`, '#44aaff');
            _sendToErdtree(ctx.card, ctx.owner);
            ctx.removeFromSource();
        },
    },

    // ----------------------------------------------------------
    // 410 — Throwing Dagger
    // Send to Erdtree → Deal damage to a chosen enemy unit
    // ----------------------------------------------------------
    '410': {
        trigger: 'phase3',
        label:   'Throwing Dagger',
        icon:    '🗡️',
        desc:    'Send to Erdtree. Deal damage to a chosen enemy unit.',
        execute: async (ctx) => {
            const slot = await _pickUnitSlot('opponent', 'Choose an enemy to hit');
            if (!slot) return;
            const key   = _slotKey('opponent', slot);
            const state = window.GameState.unitStates[key];
            if (!state) return;
            const dmg   = 30; // flat — small blade, no scaling class
            state.hp    = Math.max(0, state.hp - dmg);
            _spawnFloatingText(slot, `-${dmg}`, '#ff4444');
            window._showHPBadge?.(slot, state.hp);
            if (state.hp <= 0) _destroyUnitByKey(key);
            _sendToErdtree(ctx.card, ctx.owner);
            ctx.removeFromSource();
        },
    },

    // ----------------------------------------------------------
    // 510 — Telescope
    // Send to Erdtree → Peek 2 cards from opponent's hand
    // ----------------------------------------------------------
    '510': {
        trigger: 'phase3',
        label:   'Telescope',
        icon:    '🔭',
        desc:    "Send to Erdtree. Peek 2 cards from the opponent's hand.",
        execute: async (ctx) => {
            const gs   = window.GameState;
            const hand = gs.opponentHand;
            if (!hand.length) {
                _toast("Opponent's hand is empty.");
                return;
            }
            const toShow = hand.slice(0, Math.min(2, hand.length));
            await _showPeekModal(toShow, "Opponent's Hand (Telescope)");
            _sendToErdtree(ctx.card, ctx.owner);
            ctx.removeFromSource();
        },
    },

    // ----------------------------------------------------------
    // 110 — Memory of Grace
    // Lose all runes (and opponent gains them)
    // ----------------------------------------------------------
    '110': {
        trigger: 'phase3',
        label:   'Memory of Grace',
        icon:    '🕯️',
        desc:    'Lose all your runes. Opponent gains them.',
        execute: async (ctx) => {
            const gs  = window.GameState;
            const lost = gs.playerRunes;
            gs.opponentRunes += lost;
            gs.playerRunes    = 0;
            window.updatePhaseDisplay?.();
            _spawnFloatingText(
                document.querySelector('.player-area.player') || document.body,
                `−${lost} Runes`, '#ff4444'
            );
            _sendToErdtree(ctx.card, ctx.owner);
            ctx.removeFromSource();
        },
    },

    // ----------------------------------------------------------
    // 113 — White Mask Varré (NPC, non-support)
    // Phase 3 auto-prompt: choose a Mohgwyn unit from deck → hand
    // ----------------------------------------------------------
    '113': {
        trigger: 'phase3',
        auto:    false,  // player must confirm
        label:   "White Mask Varré",
        icon:    '🩸',
        desc:    'Choose a unit from the Mohgwyn banner in your deck and add it to your hand.',
        source:  'field',  // effect comes from the field (NPC card on battlefield)
        execute: async (ctx) => {
            const gs       = window.GameState;
            const mohgwyn  = gs.playerDeck.filter(c =>
                (c.banner || '').toLowerCase().includes('mohgwyn') ||
                (c.desc   || '').toLowerCase().includes('mohgwyn')
            );
            if (!mohgwyn.length) {
                _toast('No Mohgwyn units found in deck.');
                return;
            }
            const chosen = await _pickFromList(mohgwyn, "Choose a Mohgwyn unit");
            if (!chosen) return;
            const idx = gs.playerDeck.indexOf(chosen);
            if (idx !== -1) gs.playerDeck.splice(idx, 1);
            gs.playerHand.push(chosen);
            window.renderHand?.('player');
            _toast(`${chosen.name} added to hand.`);
        },
    },

    // ----------------------------------------------------------
    // 213 — Merchant Kale (Support NPC)
    // Auto-triggers at start of Phase 3: choose any card from deck → hand, then shuffle
    // ----------------------------------------------------------
    '213': {
        trigger: 'phase3',
        auto:    true,  // always triggers without confirmation prompt
        label:   'Merchant Kale',
        icon:    '🧑‍🌾',
        desc:    'Choose any card from your deck to add to hand. Then shuffle the deck.',
        source:  'support', // from the support slot
        execute: async (ctx) => {
            const gs = window.GameState;
            if (!gs.playerDeck.length) { _toast('Deck is empty.'); return; }
            const chosen = await _pickFromList(gs.playerDeck, 'Choose a card to draw (Kale)');
            if (!chosen) return;
            const idx = gs.playerDeck.indexOf(chosen);
            if (idx !== -1) gs.playerDeck.splice(idx, 1);
            gs.playerHand.push(chosen);
            // Shuffle remaining deck
            for (let i = gs.playerDeck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [gs.playerDeck[i], gs.playerDeck[j]] = [gs.playerDeck[j], gs.playerDeck[i]];
            }
            window.renderDeck?.(gs.playerDeck, '#player-deck');
            window.renderHand?.('player');
            _toast(`${chosen.name} drawn. Deck shuffled.`);
        },
    },

    // ----------------------------------------------------------
    // 109 — Catch Flame (Incantation, equipped)
    // During Phase 3: unit can perform a free fire attack (no action consumed)
    // ----------------------------------------------------------
    '109': {
        trigger: 'phase3',
        auto:    false,
        label:   'Catch Flame',
        icon:    '🔥',
        desc:    "Free fire attack — doesn't consume the unit's action this turn.",
        source:  'equip',  // comes from an equipped incantation
        execute: async (ctx) => {
            // Mark this unit as having a free fire attack available
            // The action menu will pick this up and add it
            const gs  = window.GameState;
            const key = ctx.unitKey;
            if (!gs.unitStates[key]) return;
            gs.unitStates[key].catchFlameReady = true;
            _glowSlot(ctx.slotEl, true);
            _toast('Catch Flame ready! Open the unit\'s action menu to use it.');
        },
    },

    // ----------------------------------------------------------
    // 108 — White Mask (Helmet, passive)
    // Triggered by BLOOD_LOSS event: +10% atk for 2 turns
    // ----------------------------------------------------------
    '108': {
        trigger:   EVENTS_PASSIVE,  // passive — registered on EffectBus
        event:     'blood_loss',
        label:     'White Mask',
        icon:      '🎭',
        condition: (ctx) => {
            // Triggers if blood loss happens on the same side or adjacent
            return true;
        },
        execute: (ctx) => {
            const key   = ctx.unitKey;
            const state = window.GameState.unitStates[key];
            if (!state) return;
            const boost = Math.round((state.lightAtk || 0) * 0.10);
            state.lightAtk = (state.lightAtk || 0) + boost;
            state.heavyAtk = (state.heavyAtk || 0) + Math.round(boost * 1.5);
            state._whiteMaskTurns = 2;
            _glowSlot(ctx.slotEl, true);
            _spawnFloatingText(ctx.slotEl, `ATK +${boost}`, '#ffd700');
            _applyStatusBadge(ctx.slotEl, 'atk_up', '⬆️ ATK', 2);
            console.log(`[White Mask] ATK +${boost} for 2 turns`);
        },
    },
};

// Sentinel so passive entries are clearly typed
const EVENTS_PASSIVE = '__passive__';

// ============================================================
// EFFECT BUS (passive event-driven effects)
// ============================================================
class CardEffectBus {
    constructor() { this._listeners = new Map(); }

    register(cardId, slotEl, { trigger, condition, effect }) {
        if (!trigger || typeof effect !== 'function') return;
        if (!this._listeners.has(trigger)) this._listeners.set(trigger, []);
        this._listeners.get(trigger).push({ cardId, slotEl, condition, effect });
    }

    unregister(cardId) {
        for (const list of this._listeners.values()) {
            list.splice(0, list.length, ...list.filter(e => e.cardId !== cardId));
        }
    }

    emit(event, extra = {}) {
        const handlers = this._listeners.get(event) ?? [];
        handlers.forEach(({ cardId, slotEl, condition, effect }) => {
            try {
                const ctx = { event, cardId, slotEl, ...extra, gameState: window.GameState };
                if (!condition || condition(ctx)) effect(ctx);
            } catch (err) {
                console.error(`[EffectBus] ${cardId}@${event}:`, err);
            }
        });
    }

    registerCard(card, slotEl, unitKey) {
        const def = EFFECT_REGISTRY[String(card.id)];
        if (!def || def.trigger !== EVENTS_PASSIVE) return;
        this.register(card.id, slotEl, {
            trigger:   def.event,
            condition: def.condition,
            effect:    (ctx) => def.execute({ ...ctx, unitKey }),
        });
        console.log(`[EffectBus] Passive registered: ${card.name} → ${def.event}`);
    }
}
window.EffectBus = new CardEffectBus();

// ============================================================
// TURN-END HOOK — White Mask duration countdown
// ============================================================
function _tickStatusDurations() {
    const gs = window.GameState;
    Object.entries(gs.unitStates || {}).forEach(([key, state]) => {
        if (state._whiteMaskTurns > 0) {
            state._whiteMaskTurns--;
            if (state._whiteMaskTurns === 0) {
                // Revert the boost — recalc from scratch via recalculateUnitStats
                const [owner, idx] = key.split('_');
                const slots = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
                const slot  = slots[parseInt(idx)];
                if (slot?.dataset.card && window.recalculateUnitStats) {
                    window.recalculateUnitStats(slot, owner, parseInt(idx));
                }
            }
        }
    });
}
// Hook into turn_end if EffectBus is available
setTimeout(() => {
    if (window.EffectBus) {
        window.EffectBus.register('__system__', null, {
            trigger: window.EVENTS?.TURN_END,
            effect:  _tickStatusDurations,
        });
    }
}, 500);

// ============================================================
// PHASE 3 EFFECT ENGINE
// ============================================================
window.EffectEngine = {

    // Called by initPlanningPhase in game_rules.js
    async runPhase3Effects() {
        const prompts = _collectPhase3Prompts();
        if (!prompts.length) return;
        for (const p of prompts) {
            await _showEffectPrompt(p);
        }
    },

    // Called when player clicks a hand card that is a consumable item during phase 3
    async tryUseFromHand(card, handIndex) {
        const def = EFFECT_REGISTRY[String(card.id)];
        if (!def || def.trigger !== 'phase3') {
            _toast('This card has no usable effect.');
            return;
        }
        const confirmed = await _confirmModal({
            title: `${def.icon} ${def.label}`,
            body:  def.desc,
            yes:   'Activate',
            no:    'Cancel',
        });
        if (!confirmed) return;
        await def.execute({
            card,
            owner: 'player',
            source: 'hand',
            removeFromSource: () => {
                window.GameState.playerHand.splice(handIndex, 1);
                window.renderHand?.('player');
            },
        });
    },

    // Register passive effects when a unit is placed on field
    registerFieldEffects(card, slotEl, unitKey) {
        // Register passive effects from main card
        window.EffectBus.registerCard(card, slotEl, unitKey);

        // Register passive effects from equipped items (e.g. White Mask)
        let equips = [];
        try { equips = JSON.parse(slotEl.dataset.equip || '[]'); } catch {}
        equips.forEach(eq => {
            window.EffectBus.registerCard(eq, slotEl, unitKey);
        });
    },
};

// ============================================================
// COLLECT PHASE 3 PROMPTS
// Scans the field for cards with active phase3 effects
// ============================================================
function _collectPhase3Prompts() {
    const prompts = [];
    const gs      = window.GameState;

    // 1. Support slot NPC effects
    const supportSlot = document.querySelector('.player-area.player .slot.support[data-card]');
    if (supportSlot) {
        try {
            const card = JSON.parse(supportSlot.dataset.card);
            const def  = EFFECT_REGISTRY[String(card.id)];
            if (def && def.trigger === 'phase3' && def.source === 'support') {
                prompts.push({
                    def, card,
                    unitKey: 'support',
                    slotEl:  supportSlot,
                    auto:    def.auto ?? false,
                    ctx: {
                        card, slotEl: supportSlot, unitKey: 'support', owner: 'player',
                        removeFromSource: () => {},
                    },
                });
            }
        } catch {}
    }

    // 2. Battle slots — unit cards with their own effect, plus equipped items
    const battleSlots = [...document.querySelectorAll('.player-area.player .slot.battle[data-card]')];
    battleSlots.forEach((slotEl, idx) => {
        const unitKey = 'player_' + idx;
        let card;
        try { card = JSON.parse(slotEl.dataset.card); } catch { return; }

        // NPC field effect (non-support)
        const unitDef = EFFECT_REGISTRY[String(card.id)];
        if (unitDef && unitDef.trigger === 'phase3' && unitDef.source === 'field') {
            prompts.push({
                def: unitDef, card,
                unitKey, slotEl,
                auto: unitDef.auto ?? false,
                ctx: {
                    card, slotEl, unitKey, owner: 'player',
                    removeFromSource: () => {},
                },
            });
        }

        // Equipped items/incantations
        let equips = [];
        try { equips = JSON.parse(slotEl.dataset.equip || '[]'); } catch {}
        equips.forEach(eq => {
            const eqDef = EFFECT_REGISTRY[String(eq.id)];
            if (!eqDef || eqDef.trigger !== 'phase3') return;
            // Don't re-prompt Catch Flame if already ready
            const state = gs.unitStates[unitKey] || {};
            if (eq.id == 109 && state.catchFlameReady) return;

            prompts.push({
                def: eqDef, card: eq,
                unitKey, slotEl,
                auto: eqDef.auto ?? false,
                unitName: card.name,
                ctx: {
                    card: eq, slotEl, unitKey, owner: 'player',
                    removeFromSource: () => {
                        // Remove equip from slot
                        let eqArr = [];
                        try { eqArr = JSON.parse(slotEl.dataset.equip || '[]'); } catch {}
                        eqArr = eqArr.filter(e => String(e.id) !== String(eq.id));
                        slotEl.dataset.equip = JSON.stringify(eqArr);
                        if (window.renderEquipments) window.renderEquipments(slotEl);
                        if (window.recalculateUnitStats) {
                            const allSlots = [...document.querySelectorAll('.player-area.player .slot.battle')];
                            window.recalculateUnitStats(slotEl, 'player', allSlots.indexOf(slotEl));
                        }
                    },
                },
            });
        });
    });

    return prompts;
}

// ============================================================
// SHOW A SINGLE EFFECT PROMPT MODAL
// ============================================================
async function _showEffectPrompt(prompt) {
    const { def, card, unitName, auto, ctx } = prompt;

    // Auto effects (e.g. Merchant Kale) just confirm immediately
    if (auto) {
        const confirmed = await _confirmModal({
            title:     `${def.icon} ${def.label}`,
            subtitle:  unitName ? `Triggered by: ${unitName}` : 'Support Effect',
            body:      def.desc,
            yes:       'Activate',
            no:        'Skip',
        });
        if (confirmed) await def.execute(ctx);
        return;
    }

    const confirmed = await _confirmModal({
        title:    `${def.icon} ${def.label}`,
        subtitle: unitName ? `Equipped on: ${unitName}` : '',
        body:     def.desc,
        yes:      'Activate',
        no:       'Skip',
    });
    if (confirmed) await def.execute(ctx);
}

// ============================================================
// CATCH FLAME — inject into action menu
// Called by showActionMenu in game_rules.js (must be wired in)
// ============================================================
window.getCatchFlameAction = function(unitKey) {
    const state = window.GameState.unitStates[unitKey] || {};
    if (!state.catchFlameReady) return null;
    return {
        id:        'catch_flame',
        label:     '🔥 Catch Flame',
        note:      '(Free action)',
        available: true,
        isFree:    true,   // does not consume the unit's action slot
    };
};

// Called by Phase 5 resolution to process catch flame attacks
window.resolveCatchFlame = function(owner, idx) {
    const gs    = window.GameState;
    const key   = owner + '_' + idx;
    const state = gs.unitStates[key];
    if (!state?.catchFlameActive) return 0;

    const enemy       = owner === 'player' ? 'opponent' : 'player';
    const enemySlots  = [...document.querySelectorAll(`.player-area.${enemy} .slot.battle`)];
    const range       = [idx, idx - 1, idx + 1].filter(t => t >= 0 && t < 5);
    const targetIdx   = range.find(t => enemySlots[t]?.dataset.card);

    const fireDmg = Math.round((state.lightAtk || 10) * 1.67); // Catch Flame multiplier
    if (targetIdx != null) {
        const tKey   = enemy + '_' + targetIdx;
        const tState = gs.unitStates[tKey];
        if (tState) {
            tState.hp = Math.max(0, tState.hp - fireDmg);
            window._showHPBadge?.(enemySlots[targetIdx], tState.hp);
            _spawnFloatingText(enemySlots[targetIdx], `🔥-${fireDmg}`, '#ff8833');
        }
    } else {
        gs[`${enemy}Runes`] = Math.max(0, (gs[`${enemy}Runes`] || 0) - fireDmg);
    }

    state.catchFlameActive = false;
    state.catchFlameReady  = false;
    window.updatePhaseDisplay?.();
    return fireDmg;
};

// ============================================================
// MODAL — styled confirmation dialog
// Returns Promise<boolean>
// ============================================================
function _confirmModal({ title = '', subtitle = '', body = '', yes = 'Yes', no = 'No' }) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id    = 'effect-confirm-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.78);
            display:flex;align-items:center;justify-content:center;
            z-index:15000;font-family:'Cinzel',sans-serif;
        `;

        overlay.innerHTML = `
            <div style="
                background:linear-gradient(160deg,#1a120a,#0e0a06);
                border:2px solid #edd7ab55;border-radius:16px;
                padding:28px 32px;max-width:380px;width:90%;
                box-shadow:0 16px 60px rgba(0,0,0,0.9),0 0 0 1px #edd7ab11;
                text-align:center;
            ">
                <div style="font-size:1.5em;color:#edd7ab;font-weight:bold;margin-bottom:6px;">
                    ${title}
                </div>
                ${subtitle ? `<div style="font-size:0.72em;color:#888;margin-bottom:12px;
                    text-transform:uppercase;letter-spacing:.06em;">${subtitle}</div>` : ''}
                <div style="font-size:0.85em;color:#bbb;line-height:1.5;margin:12px 0 24px;">
                    ${body}
                </div>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button id="effect-no" style="
                        background:rgba(200,60,60,0.12);color:#cc7777;
                        border:1px solid #cc444433;border-radius:10px;
                        padding:10px 28px;cursor:pointer;font-family:'Cinzel',sans-serif;
                        font-size:0.9em;transition:background .15s;">
                        ${no}
                    </button>
                    <button id="effect-yes" style="
                        background:rgba(237,215,171,0.14);color:#edd7ab;
                        border:2px solid #edd7ab55;border-radius:10px;
                        padding:10px 28px;cursor:pointer;font-family:'Cinzel',sans-serif;
                        font-size:0.9em;font-weight:bold;transition:background .15s;">
                        ${yes}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const yesBtn = overlay.querySelector('#effect-yes');
        const noBtn  = overlay.querySelector('#effect-no');

        yesBtn.addEventListener('mouseenter', () => yesBtn.style.background = 'rgba(237,215,171,0.26)');
        yesBtn.addEventListener('mouseleave', () => yesBtn.style.background = 'rgba(237,215,171,0.14)');
        noBtn.addEventListener('mouseenter',  () => noBtn.style.background  = 'rgba(200,60,60,0.22)');
        noBtn.addEventListener('mouseleave',  () => noBtn.style.background  = 'rgba(200,60,60,0.12)');

        const done = (val) => { overlay.remove(); resolve(val); };
        yesBtn.addEventListener('click', () => done(true));
        noBtn.addEventListener('click',  () => done(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    });
}

// ============================================================
// UNIT SLOT PICKER — highlights valid slots, awaits click
// Returns Promise<HTMLElement|null>
// ============================================================
function _pickUnitSlot(owner, hint = 'Choose a unit') {
    return new Promise(resolve => {
        const selector = `.player-area.${owner} .slot.battle[data-card]`;
        const slots    = [...document.querySelectorAll(selector)];

        if (!slots.length) { resolve(null); return; }

        // Dim overlay
        const dimmer = document.createElement('div');
        dimmer.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:12000;
            cursor:crosshair;
        `;
        document.body.appendChild(dimmer);

        // Hint
        const hintEl = document.createElement('div');
        hintEl.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            background:rgba(237,215,171,0.92);color:#1a1008;
            padding:12px 28px;border-radius:20px;font-weight:bold;
            font-family:'Cinzel',sans-serif;font-size:1em;
            z-index:12001;box-shadow:0 4px 20px rgba(0,0,0,0.5);
            pointer-events:none;
        `;
        hintEl.textContent = `${hint} — or press ESC to cancel`;
        document.body.appendChild(hintEl);

        // Highlight slots
        slots.forEach(s => {
            s.style.outline      = '3px solid #edd7ab';
            s.style.outlineOffset = '2px';
            s.style.zIndex       = '12002';
            s.style.cursor       = 'crosshair';
            s.style.position     = 'relative';
        });

        const cleanup = () => {
            dimmer.remove(); hintEl.remove();
            slots.forEach(s => {
                s.style.outline = '';
                s.style.outlineOffset = '';
                s.style.zIndex  = '';
                s.style.cursor  = '';
            });
            document.removeEventListener('keydown', escHandler);
        };

        const escHandler = (e) => {
            if (e.key !== 'Escape') return;
            cleanup(); resolve(null);
        };
        document.addEventListener('keydown', escHandler);

        dimmer.addEventListener('click', () => { cleanup(); resolve(null); });

        slots.forEach(s => {
            const handler = () => {
                slots.forEach(x => x.removeEventListener('click', x._pickHandler));
                cleanup(); resolve(s);
            };
            s._pickHandler = handler;
            s.addEventListener('click', handler, { once: true });
        });
    });
}

// ============================================================
// CARD LIST PICKER — like openCardPicker but async
// ============================================================
function _pickFromList(cards, title = 'Choose a card') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:14000;
            display:flex;flex-direction:column;align-items:center;
            padding:40px 20px;overflow-y:auto;font-family:'Cinzel',sans-serif;
        `;

        const h = document.createElement('div');
        h.style.cssText = 'color:#edd7ab;font-size:1.2em;font-weight:bold;margin-bottom:20px;';
        h.textContent   = title;
        overlay.appendChild(h);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-width:900px;';

        cards.forEach(card => {
            const wrap = document.createElement('div');
            wrap.style.cssText = `
                cursor:pointer;border:2px solid transparent;border-radius:8px;
                transition:border .15s,transform .15s;padding:3px;
            `;
            const img = document.createElement('img');
            img.src    = `static/src/cards/front/${card.id}.png`;
            img.style.cssText  = 'width:130px;height:185px;object-fit:contain;border-radius:6px;display:block;';
            img.onerror = () => img.src = `https://placehold.co/130x185?text=${card.id}`;

            const lbl = document.createElement('div');
            lbl.style.cssText = 'color:#edd7ab;font-size:0.65em;text-align:center;margin-top:4px;';
            lbl.textContent   = card.name;

            wrap.appendChild(img); wrap.appendChild(lbl);
            wrap.addEventListener('mouseenter', () => {
                wrap.style.border    = '2px solid #edd7ab';
                wrap.style.transform = 'scale(1.05)';
            });
            wrap.addEventListener('mouseleave', () => {
                wrap.style.border    = '2px solid transparent';
                wrap.style.transform = '';
            });
            wrap.addEventListener('click', () => { overlay.remove(); resolve(card); });
            grid.appendChild(wrap);
        });
        overlay.appendChild(grid);

        const cancel = document.createElement('button');
        cancel.textContent  = '✕ Cancel';
        cancel.style.cssText = `
            margin-top:24px;background:rgba(180,40,40,0.15);color:#cc7777;
            border:1px solid #cc444444;border-radius:10px;padding:10px 28px;
            cursor:pointer;font-family:'Cinzel',sans-serif;font-size:0.9em;
        `;
        cancel.addEventListener('click', () => { overlay.remove(); resolve(null); });
        overlay.appendChild(cancel);

        document.body.appendChild(overlay);
    });
}

// ============================================================
// PEEK MODAL — show opponent cards temporarily
// ============================================================
function _showPeekModal(cards, title) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:14000;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'Cinzel',sans-serif;
        `;
        overlay.innerHTML = `
            <div style="color:#edd7ab;font-size:1.1em;font-weight:bold;margin-bottom:20px;">
                🔭 ${title}
            </div>
            <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:28px;">
                ${cards.map(c => `
                    <div style="text-align:center;">
                        <img src="static/src/cards/front/${c.id}.png"
                             style="width:140px;height:200px;object-fit:contain;border-radius:8px;
                                    border:2px solid #edd7ab55;"
                             onerror="this.src='https://placehold.co/140x200?text=${c.id}'">
                        <div style="color:#edd7ab88;font-size:0.72em;margin-top:6px;">${c.name}</div>
                    </div>`).join('')}
            </div>
            <button id="peek-close" style="
                background:rgba(237,215,171,0.12);color:#edd7ab;
                border:2px solid #edd7ab44;border-radius:10px;
                padding:10px 28px;cursor:pointer;font-family:'Cinzel',sans-serif;">
                Close
            </button>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('#peek-close').addEventListener('click', () => {
            overlay.remove(); resolve();
        });
    });
}

// ============================================================
// HELPER UTILITIES
// ============================================================

function _slotKey(owner, slotEl) {
    const all = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    return owner + '_' + all.indexOf(slotEl);
}

function _sendToErdtree(card, owner = 'player') {
    const sel = owner === 'player'
        ? '.slot.graveyard:not(.enemy)'
        : '.slot.graveyard.enemy';
    const mt  = document.querySelector(sel);
    if (!mt) return;
    mt.innerHTML   = window.createCardImage?.(card, false) || '';
    mt.dataset.card = JSON.stringify(card);
    console.log(`📦 → Erdtree (${owner}):`, card.name);
}

function _destroyUnitByKey(key) {
    const [owner, idxStr] = key.split('_');
    const slots  = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    const slot   = slots[parseInt(idxStr)];
    if (!slot) return;
    const wrapper = slot.querySelector('.card-wrapper');
    if (wrapper && window.animateDestroyCard) {
        window.animateDestroyCard(wrapper, () => {
            slot.innerHTML = '';
            delete slot.dataset.card;
            delete slot.dataset.cardType;
            delete slot.dataset.equip;
        });
    } else {
        slot.innerHTML = '';
        delete slot.dataset.card;
        delete slot.dataset.cardType;
        delete slot.dataset.equip;
    }
    delete window.GameState.unitStates[key];
    window.updatePhaseDisplay?.();
}

function _glowSlot(slotEl, on) {
    if (!slotEl) return;
    const cw = slotEl.querySelector?.('.card-wrapper');
    if (cw) cw.classList.toggle('effect-ready', on);
}

function _applyStatusBadge(slotEl, statusId, label, turns = 0) {
    if (!slotEl) return;
    let badge = slotEl.querySelector(`.status-badge[data-status="${statusId}"]`);
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'status-badge';
        badge.dataset.status = statusId;
        badge.style.cssText = `
            position:absolute;top:4px;right:4px;
            background:${STATUS_COLORS[statusId] || '#c44'};color:#fff;
            font-size:0.65em;font-weight:bold;padding:2px 6px;
            border-radius:6px;z-index:20;pointer-events:none;
        `;
        slotEl.style.position = 'relative';
        slotEl.appendChild(badge);
    }
    badge.textContent = `${label}${turns ? ` (${turns})` : ''}`;
}

function _spawnFloatingText(el, text, color = '#fff') {
    if (!el) return;
    const rect    = el.getBoundingClientRect?.() || { left: 200, top: 200, width: 50, height: 50 };
    const floater = document.createElement('div');
    floater.textContent = text;
    floater.style.cssText = `
        position:fixed;left:${rect.left + rect.width / 2}px;top:${rect.top}px;
        color:${color};font-family:'Cinzel',sans-serif;font-size:1.1em;font-weight:bold;
        pointer-events:none;z-index:20000;text-shadow:0 0 8px rgba(0,0,0,0.8);
        transform:translateX(-50%);
        animation:floatUp 1.2s ease-out forwards;
    `;
    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 1300);
}

function _toast(text, duration = 2500) {
    let t = document.getElementById('effect-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'effect-toast';
        t.style.cssText = `
            position:fixed;bottom:130px;left:50%;transform:translateX(-50%);
            background:rgba(10,6,2,0.95);color:#edd7ab;
            padding:10px 24px;border-radius:20px;border:1px solid #edd7ab44;
            font-family:'Cinzel',sans-serif;font-size:0.88em;
            z-index:16000;box-shadow:0 4px 20px rgba(0,0,0,0.6);
            pointer-events:none;transition:opacity .3s;
        `;
        document.body.appendChild(t);
    }
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(t._hide);
    t._hide = setTimeout(() => { t.style.opacity = '0'; }, duration);
}

// ============================================================
// CSS — animations + glow
// ============================================================
(function injectStyles() {
    if (document.getElementById('effect-engine-styles')) return;
    const s = document.createElement('style');
    s.id = 'effect-engine-styles';
    s.textContent = `
        @keyframes floatUp {
            0%   { opacity:1; transform:translateX(-50%) translateY(0); }
            100% { opacity:0; transform:translateX(-50%) translateY(-60px); }
        }
        .card-wrapper.effect-ready {
            animation: effectGlow 0.9s ease-in-out infinite alternate;
            position: relative; z-index: 10;
        }
        @keyframes effectGlow {
            from {
                box-shadow: 0 0 6px 2px rgba(255,200,50,.5),
                            0 0 14px 6px rgba(255,160,20,.35),
                            0 0 28px 10px rgba(255,100,0,.18);
                filter: brightness(1.05);
            }
            to {
                box-shadow: 0 0 12px 4px rgba(255,220,80,.85),
                            0 0 28px 10px rgba(255,170,30,.6),
                            0 0 48px 18px rgba(255,110,0,.35);
                filter: brightness(1.18);
            }
        }
        .slot.slot-effect-active {
            outline: 2px solid rgba(255,200,50,.7);
            outline-offset: 2px;
        }
    `;
    document.head.appendChild(s);
})();

// ============================================================
// INTEGRATION HOOKS
// Wire into game_rules.js and turn-manager.js
// ============================================================

// 1. Wire Phase 3 trigger (called by turn-manager.js advanceToNextPhase)
//    Override window.initPlanningPhase after game_rules.js loads
const _origInitPlanning = window.initPlanningPhase;
window.initPlanningPhase = async function () {
    if (_origInitPlanning) _origInitPlanning();
    // Small delay so unit action UI is visible first, then effect prompts
    await new Promise(r => setTimeout(r, 300));
    await window.EffectEngine.runPhase3Effects();
};

// 2. Hand click during Phase 3 — wire into renderHand's click handler
//    Patch window.trySummon to intercept consumable items during Phase 3
const _origTrySummon = window.trySummon;
window.trySummon = function (card, handIndex) {
    const gs   = window.GameState;
    const type = window.getCardType?.(card) || '';

    // Items during Phase 3 can be used directly
    if (gs.currentPhase === 3 && type === 'items') {
        const def = EFFECT_REGISTRY[String(card.id)];
        if (def && def.trigger === 'phase3') {
            window.EffectEngine.tryUseFromHand(card, handIndex);
            return;
        }
    }

    // Incantations / sorceries during Phase 3 can also be used from hand
    if (gs.currentPhase === 3 && ['incantations', 'sorceries'].includes(type)) {
        const def = EFFECT_REGISTRY[String(card.id)];
        if (def && def.trigger === 'phase3') {
            window.EffectEngine.tryUseFromHand(card, handIndex);
            return;
        }
    }

    if (_origTrySummon) _origTrySummon(card, handIndex);
};

// 3. Register passive effects when a unit is placed on field
//    Patch game_rules.js placeUnit via MutationObserver (same approach as before)
const _fieldObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
        m.addedNodes.forEach(node => {
            if (!(node instanceof HTMLElement)) return;
            const slot = node.closest?.('.slot');
            if (!slot) return;
            setTimeout(() => {
                if (!slot.dataset.card) return;
                try {
                    const card    = JSON.parse(slot.dataset.card);
                    const allBattle = [...document.querySelectorAll('.player-area.player .slot.battle')];
                    const idx     = allBattle.indexOf(slot);
                    if (idx === -1) return;
                    const unitKey = 'player_' + idx;
                    window.EffectEngine.registerFieldEffects(card, slot, unitKey);
                } catch {}
            }, 100);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('game-table');
    if (table) _fieldObserver.observe(table, { childList: true, subtree: true });
});

// 4. Expose existing helpers for EffectBus usage (some used in turn-manager)
function findSlotByCardId(cardId) {
    for (const slot of document.querySelectorAll('.slot[data-card]')) {
        try { if (String(JSON.parse(slot.dataset.card).id) === String(cardId)) return slot; } catch {}
    }
    return null;
}

function changeRunesHelper(who, delta) {
    const gs = window.GameState;
    if (who === 'player')   gs.playerRunes   = Math.max(0, (gs.playerRunes   || 0) + delta);
    else                    gs.opponentRunes = Math.max(0, (gs.opponentRunes || 0) + delta);
    window.updatePhaseDisplay?.();
    window.EffectBus?.emit(window.EVENTS?.RUNE_CHANGE, { who, delta, gameState: gs });
}

console.log('[EffectEngine] ✅ Card effects system loaded');