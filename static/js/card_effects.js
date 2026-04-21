// ========================================
// CARD EFFECTS — Sistema Effetti e Bus Eventi
// ========================================
// Carica PRIMA di game_rules.js e table.js
//
// Flusso:
//   1.  Le carte dichiarano i propri effetti (effects:[])
//   2.  Quando vengono schierate, si registrano sull'EffectBus
//   3.  Il game loop emette gli eventi nei momenti giusti
//   4.  L'EffectBus valuta condition() e invoca effect()
//   5.  Le carte attivabili si illuminano con la classe CSS
//       "effect-ready" prima dell'emit
// ========================================

// ----------------------------------------
// EVENTI DEL GIOCO
// ----------------------------------------
window.EVENTS = Object.freeze({
    TURN_START       : 'turn_start',        // Inizio turno (dopo cambio proprietario)
    DRAW             : 'draw',              // Una carta è stata pescata
    SUMMON           : 'summon',            // Un'unità è stata schierata
    BEFORE_ACTION    : 'before_action',     // Prima delle azioni (fase 3)
    AFTER_ACTION     : 'after_action',      // Dopo le azioni (fase 4)
    DAMAGE           : 'damage',            // Un'unità riceve danno
    UNIT_DEATH       : 'unit_death',        // Un'unità muore
    DIRECT_DAMAGE    : 'direct_damage',     // Danno diretto alle rune
    TURN_END         : 'turn_end',          // Fine turno (fase 5)
    RESOLUTION_START : 'resolution_start',  // Inizio resa dei conti
    RESOLUTION_END   : 'resolution_end',    // Fine resa dei conti
    EQUIP            : 'equip',             // Equipaggiamento applicato
    SUPPORT_ENTER    : 'support_enter',     // NPC supporto entra in campo
    RUNE_CHANGE      : 'rune_change',       // Le rune cambiano (cura o danno)
});

// ----------------------------------------
// CONTEXT HELPERS
// ----------------------------------------
/**
 * Costruisce il contesto di default passato a condition() e effect().
 *
 * @param {string}  event      - chiave EVENTS
 * @param {object}  extra      - dati specifici dell'evento
 * @param {string}  cardId     - id della carta che sta reagendo
 * @returns {object} ctx
 */
function buildContext(event, extra, cardId) {
    return {
        event,
        cardId,                              // id carta che reagisce
        source: extra.source ?? null,        // chi ha causato l'evento
        target: extra.target ?? null,        // chi subisce l'evento
        card: extra.card ?? null,            // carta coinvolta (es. carta pescata)
        amount: extra.amount ?? 0,           // quantità numerica (danno, cura…)
        gameState: extra.gameState ?? window.GameState,
        ...extra,                            // qualsiasi dato extra passato dall'emit
        // Utility: applica uno status a un'unità nel suo slot
        applyStatus(targetCardId, status) {
            applyStatusToCard(targetCardId, status);
        },
        // Utility: modifica le rune
        changeRunes(who, delta) {
            changeRunesHelper(who, delta);
        }
    };
}

// ----------------------------------------
// EFFECT BUS
// ----------------------------------------
class CardEffectBus {
    constructor() {
        /**
         * Struttura: Map< eventName, Array<{ cardId, slotEl, condition, effect }> >
         */
        this._listeners = new Map();
    }

    /**
     * Registra un effetto di una carta su un dato evento.
     *
     * @param {string}      cardId   - identificatore della carta
     * @param {HTMLElement} slotEl   - elemento DOM dello slot (per glow e ctx)
     * @param {object}      effectDef
     *   @param {string}   effectDef.trigger   - uno dei EVENTS
     *   @param {Function} [effectDef.condition] - (ctx) => boolean
     *   @param {Function}  effectDef.effect    - (ctx) => void
     */
    register(cardId, slotEl, effectDef) {
        const { trigger, condition, effect } = effectDef;
        if (!trigger || typeof effect !== 'function') {
            console.warn(`[EffectBus] Effetto non valido per ${cardId}`, effectDef);
            return;
        }

        if (!this._listeners.has(trigger)) {
            this._listeners.set(trigger, []);
        }

        this._listeners.get(trigger).push({ cardId, slotEl, condition, effect });
        console.log(`[EffectBus] ✅ Registrato: ${cardId} → ${trigger}`);
    }

    /**
     * Rimuove tutti gli effetti legati a un cardId specifico.
     * Chiamato quando la carta lascia il campo (morte, spostamento…).
     */
    unregister(cardId) {
        for (const [, list] of this._listeners) {
            const before = list.length;
            // Filtra in-place
            list.splice(0, list.length, ...list.filter(e => e.cardId !== cardId));
            if (list.length !== before) {
                console.log(`[EffectBus] 🗑️ Rimosso: ${cardId}`);
            }
        }
        // Rimuovi glow se ancora presente
        document.querySelectorAll(`[data-card-id="${cardId}"] .card-wrapper`)
            .forEach(el => el.classList.remove('effect-ready'));
    }

    /**
     * Emette un evento, attivando gli effetti con condition soddisfatta.
     *
     * @param {string} event  - chiave EVENTS
     * @param {object} extra  - dati contestuali
     */
    emit(event, extra = {}) {
        if (!event) return;

        const handlers = this._listeners.get(event) ?? [];

        // 1. Pre-emit: evidenzia le carte attivabili
        this._highlightReady(event, extra, handlers);

        // 2. Esegui effetti
        handlers.forEach(({ cardId, slotEl, condition, effect }) => {
            try {
                const ctx = buildContext(event, extra, cardId);
                // "this" nel contesto condition/effect è la carta
                if (!condition || condition(ctx)) {
                    console.log(`[EffectBus] ⚡ ${cardId} reagisce a ${event}`);
                    effect(ctx);
                }
            } catch (err) {
                console.error(`[EffectBus] Errore effetto ${cardId}@${event}:`, err);
            }
        });

        // 3. Post-emit: rimuovi il glow dopo 1.5 s
        setTimeout(() => this._clearGlow(handlers), 1500);
    }

    // ----------------------------------------
    // GLOW — evidenzia le carte attivabili
    // ----------------------------------------
    /**
     * Aggiunge la classe "effect-ready" alle carte che POTREBBERO attivarsi.
     * Valuta la condition con un contesto "dry-run" (senza eseguire l'effect).
     */
    _highlightReady(event, extra, handlers) {
        handlers.forEach(({ cardId, slotEl, condition }) => {
            try {
                if (!condition) {
                    // Nessuna condizione → si attiva sempre → illumina
                    this._glowSlot(slotEl, true);
                    return;
                }
                const ctx = buildContext(event, extra, cardId);
                if (condition(ctx)) {
                    this._glowSlot(slotEl, true);
                }
            } catch (_) {
                // Condition fallita → non illuminare
            }
        });
    }

    _clearGlow(handlers) {
        handlers.forEach(({ slotEl }) => this._glowSlot(slotEl, false));
    }

    _glowSlot(slotEl, active) {
        if (!slotEl) return;
        const cardWrapper = slotEl.querySelector('.card-wrapper');
        if (cardWrapper) {
            cardWrapper.classList.toggle('effect-ready', active);
        }
        slotEl.classList.toggle('slot-effect-active', active);
    }

    // ----------------------------------------
    // REGISTRA TUTTI GLI EFFETTI DI UNA CARTA
    // ----------------------------------------
    /**
     * Scansiona card.effects[] e li registra tutti.
     * Chiamare quando una carta viene posizionata sullo slot.
     *
     * @param {object}      card   - oggetto carta con array effects
     * @param {HTMLElement} slotEl - elemento .slot in cui è posizionata
     */
    registerCard(card, slotEl) {
        if (!card.effects || !Array.isArray(card.effects)) return;
        card.effects.forEach(eff => {
            this.register(card.id, slotEl, eff);
        });
    }

    /**
     * Scansiona il campo (DOM) e registra tutti gli effetti delle carte presenti.
     * Utile per ri-sincronizzare dopo un caricamento di salvataggio.
     */
    syncFromField() {
        document.querySelectorAll('.slot[data-card]').forEach(slotEl => {
            try {
                const card = JSON.parse(slotEl.dataset.card);
                if (card?.effects?.length) {
                    this.registerCard(card, slotEl);
                }
            } catch (_) {}
        });
    }
}

// Istanza globale
window.EffectBus = new CardEffectBus();

// ----------------------------------------
// CSS — Glow per carte attivabili
// ----------------------------------------
(function injectEffectStyles() {
    if (document.getElementById('effect-bus-styles')) return;

    const style = document.createElement('style');
    style.id = 'effect-bus-styles';
    style.textContent = `
        /* Glow sulle carte che possono reagire all'evento corrente */
        .card-wrapper.effect-ready {
            animation: effectGlow 0.9s ease-in-out infinite alternate;
            position: relative;
            z-index: 10;
        }

        @keyframes effectGlow {
            from {
                box-shadow:
                    0 0  6px  2px rgba(255, 200,  50, 0.5),
                    0 0 14px  6px rgba(255, 160,  20, 0.35),
                    0 0 28px 10px rgba(255, 100,   0, 0.18);
                filter: brightness(1.05);
            }
            to {
                box-shadow:
                    0 0 12px  4px rgba(255, 220,  80, 0.85),
                    0 0 28px 10px rgba(255, 170,  30, 0.6),
                    0 0 48px 18px rgba(255, 110,   0, 0.35);
                filter: brightness(1.18);
            }
        }

        /* Bordo slot quando un effetto è attivo */
        .slot.slot-effect-active {
            outline: 2px solid rgba(255, 200, 50, 0.7);
            outline-offset: 2px;
        }
    `;
    document.head.appendChild(style);
})();

// ----------------------------------------
// UTILITY INTERNE (usate da buildContext)
// ----------------------------------------

/**
 * Applica uno status visuale e logico a una carta sul campo.
 * @param {string} cardId  - id della carta target
 * @param {string} status  - nome dello status (es. 'bleed', 'stun', 'burn')
 */
function applyStatusToCard(cardId, status) {
    // Trova lo slot della carta sul campo
    const slot = findSlotByCardId(cardId);
    if (!slot) {
        console.warn(`[EffectBus] applyStatus: slot non trovato per ${cardId}`);
        return;
    }

    // Aggiorna i dati
    try {
        const cardData = JSON.parse(slot.dataset.card);
        cardData.statuses = cardData.statuses || [];
        if (!cardData.statuses.includes(status)) {
            cardData.statuses.push(status);
            slot.dataset.card = JSON.stringify(cardData);
        }
    } catch (_) {}

    // Aggiunge badge visuale
    let badge = slot.querySelector(`.status-badge[data-status="${status}"]`);
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'status-badge';
        badge.dataset.status = status;
        badge.textContent = STATUS_ICONS[status] ?? status;
        badge.title = status;
        badge.style.cssText = `
            position: absolute;
            top: 4px; right: 4px;
            background: ${STATUS_COLORS[status] ?? '#c44'};
            color: #fff;
            font-size: 0.7em;
            font-weight: bold;
            padding: 2px 5px;
            border-radius: 6px;
            z-index: 20;
            pointer-events: none;
        `;
        slot.style.position = 'relative';
        slot.appendChild(badge);
    }

    console.log(`[EffectBus] 🩸 ${cardId} → status: ${status}`);
}

/**
 * Modifica le rune di un giocatore e aggiorna l'HUD.
 * @param {'player'|'opponent'} who
 * @param {number} delta  - positivo = cura, negativo = danno
 */
function changeRunesHelper(who, delta) {
    const gs = window.GameState;
    if (who === 'player') {
        gs.playerRunes = Math.max(0, gs.playerRunes + delta);
    } else {
        gs.opponentRunes = Math.max(0, gs.opponentRunes + delta);
    }
    if (window.updatePhaseDisplay) window.updatePhaseDisplay();

    // Emetti RUNE_CHANGE per eventuali reazioni a cascata
    window.EffectBus.emit(window.EVENTS.RUNE_CHANGE, {
        who, delta, gameState: gs
    });
}

/**
 * Cerca lo slot che contiene una carta con l'id dato.
 */
function findSlotByCardId(cardId) {
    for (const slot of document.querySelectorAll('.slot[data-card]')) {
        try {
            const d = JSON.parse(slot.dataset.card);
            if (String(d.id) === String(cardId)) return slot;
        } catch (_) {}
    }
    return null;
}

// ----------------------------------------
// ICONE E COLORI STATUS
// ----------------------------------------
const STATUS_ICONS = {
    bleed   : '🩸',
    stun    : '💫',
    burn    : '🔥',
    freeze  : '❄️',
    poison  : '☠️',
    shield  : '🛡️',
    regen   : '💚',
    cursed  : '💀',
    empowered: '⚡',
};

const STATUS_COLORS = {
    bleed   : '#b03030',
    stun    : '#8060d0',
    burn    : '#c06010',
    freeze  : '#4090c0',
    poison  : '#508040',
    shield  : '#4070a0',
    regen   : '#30a060',
    cursed  : '#601060',
    empowered:'#c0a020',
};

// ----------------------------------------
// HOOK: integrazione con game_rules.js
// Dopo placeUnit / placeEquipment → registra effetti
// ----------------------------------------
(function patchGameRules() {
    // Sovrascrive window.trySummon per agganciare l'EffectBus dopo il piazzamento.
    // Funziona perché game_rules.js chiama placeUnit internamente, e il campo viene
    // aggiornato subito. Usiamo un MutationObserver sugli slot per intercettarlo.

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;

                // Cerca il card-wrapper appena aggiunto a uno .slot
                const slot = node.closest?.('.slot') ?? (node.classList?.contains('slot') ? node : null);
                if (!slot) return;

                // Aspetta che dataset.card sia valorizzato
                setTimeout(() => {
                    if (!slot.dataset.card) return;
                    try {
                        const card = JSON.parse(slot.dataset.card);
                        if (card?.effects?.length) {
                            window.EffectBus.registerCard(card, slot);

                            // Emetti SUMMON
                            window.EffectBus.emit(window.EVENTS.SUMMON, {
                                card,
                                slotEl: slot,
                                gameState: window.GameState
                            });
                        }
                    } catch (_) {}
                }, 50);
            });
        });
    });

    // Osserva il campo di gioco per nuovi elementi
    document.addEventListener('DOMContentLoaded', () => {
        const field = document.getElementById('game-table');
        if (field) {
            observer.observe(field, { childList: true, subtree: true });
            console.log('[EffectBus] 👁️ MutationObserver attivo sul campo');
        }
    });
})();

// ----------------------------------------
// ESEMPIO CARTA CON EFFETTI
// ----------------------------------------
// Questo blocco mostra come definire effetti su una carta.
// Rimuovilo o spostalo nel tuo catalogo carte.
/*
const exampleCard = {
    id: "blood_sword",
    name: "Spada del Sangue",
    type: "weapons",
    effects: [
        {
            trigger: EVENTS.DAMAGE,
            condition: (ctx) => ctx.source === ctx.cardId,   // solo se questa carta ha inferto il danno
            effect: (ctx) => {
                if (Math.random() < 0.3) {
                    ctx.applyStatus(ctx.target, 'bleed');
                }
            }
        }
    ]
};

const exampleCard2 = {
    id: "flame_talisman",
    name: "Talismano della Fiamma",
    type: "talismans",
    effects: [
        {
            trigger: EVENTS.TURN_START,
            condition: (ctx) => ctx.turnOwner === 'player',
            effect: (ctx) => {
                // Brucia il primo nemico ogni turno
                const firstEnemySlot = document.querySelector('.player-area.opponent .slot.battle[data-card]');
                if (firstEnemySlot) {
                    const enemy = JSON.parse(firstEnemySlot.dataset.card);
                    ctx.applyStatus(enemy.id, 'burn');
                }
            }
        }
    ]
};

const exampleCard3 = {
    id: "regen_npc",
    name: "Guaritore",
    type: "npcs",
    support: 1,
    effects: [
        {
            trigger: EVENTS.TURN_END,
            condition: null,   // si attiva sempre
            effect: (ctx) => {
                ctx.changeRunes('player', 2);   // recupera 2 rune ogni fine turno
                console.log('💚 Guaritore: +2 rune al giocatore');
            }
        }
    ]
};
*/

console.log('[EffectBus] ✅ Sistema effetti carte caricato');