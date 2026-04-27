// ========================================
// TURN MANAGER — Gestione fasi e pesca
// ========================================

// ----------------------------------------
// GAME STATE
// ----------------------------------------
window.GameState = {
    currentPhase: 0,
    turnNumber: 1,          // primo turno = niente attacchi
    turnOwner: 'player',    // fisso: fasi 1-3 = player, fase 4 = opponent AI
    hasSummonedThisTurn: false,
    hasOpponentSummonedThisTurn: false,
    playerHand: [],
    opponentHand: [],
    playerRunes: 20,
    opponentRunes: 20,
    plannedActions: {},     // { 'player_0': {type:'light'}, 'opponent_2': {type:'charge'} }
    unitStates: {},         // { 'player_0': { hp, maxHp, charges, dodgedLastTurn }, ... }
    phases: [
        { id: 1, name: "Fase 1 — Pesca (clicca il mazzo)" },
        { id: 2, name: "Fase 2 — Schieramento" },
        { id: 3, name: "Fase 3 — Pianificazione" },
        { id: 4, name: "Fase 4 — Turno Avversario" },
        { id: 5, name: "Fase 5 — Resa dei Conti" }
    ],
    checkWinCondition() {
        const playerLost   = this.playerRunes <= 0 ||
            (this.playerHand.length === 0 && window.playerDeck?.length === 0);
        const opponentLost = this.opponentRunes <= 0 ||
            (this.opponentHand.length === 0 && window.opponentDeck?.length === 0);
        if (playerLost)   { _showGameOver('💀 Le tue Rune sono esaurite — HAI PERSO!'); return true; }
        if (opponentLost) { _showGameOver('🏆 HAI VINTO! Il Senzaluce trionfa!'); return true; }
        return false;
    }
};

function _showGameOver(msg) {
    let overlay = document.getElementById('gameover-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'gameover-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.85);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            z-index:99999;font-family:'Cinzel',sans-serif;
        `;
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div style="color:#edd7ab;font-size:2.2em;font-weight:bold;
                    text-shadow:0 0 24px #edd7ab88;margin-bottom:28px;text-align:center;
                    padding:0 20px;">${msg}</div>
        <button onclick="location.reload()" style="
            background:rgba(237,215,171,0.12);color:#edd7ab;
            border:2px solid #edd7ab;padding:12px 36px;
            font-family:'Cinzel',sans-serif;font-size:1.1em;
            border-radius:8px;cursor:pointer;letter-spacing:.05em;">
            ↺ Nuova Partita
        </button>`;
}

// ----------------------------------------
// DRAW — variabili di stato
// ----------------------------------------
const DRAW_PER_TURN = 2;
window.drawnThisTurn = 0;
window.isDrawing = false;

// ----------------------------------------
// PESCA SINGOLA CON ANIMAZIONE
// ----------------------------------------
window.drawOneCard = function (target = 'player', skipCounter = false) {
    if (target === 'player' && window.isDrawing) return;

    const deck = target === 'player' ? window.playerDeck : window.opponentDeck;
    if (!deck || deck.length === 0) {
        window.GameState.checkWinCondition();
        return;
    }

    if (target === 'player') window.isDrawing = true;

    const cardData = deck.pop();
    renderDeck(deck, target === 'player' ? '#player-deck' : '.slot.deck.enemy');

    window.animateCardToHand(cardData, target, () => {
        const handKey = target === 'player' ? 'playerHand' : 'opponentHand';
        window.GameState[handKey].push(cardData);
        window.renderHand(target);
        if (target === 'player') window.isDrawing = false;

        // Solo per la pesca manuale del giocatore (fase 1)
        if (target === 'player' && !skipCounter) {
            window.drawnThisTurn++;
            updatePhaseDisplay();
            if (window.drawnThisTurn >= DRAW_PER_TURN) {
                setTimeout(() => window.advanceToNextPhase(), 400);
            }
        }
    });
};

// ----------------------------------------
// PESCA INIZIALE (5 carte silenziosa)
// ----------------------------------------
window.initHands = function () {
    if (window._handsDealt) return;
    window._handsDealt = true;

    const drawSilent = (target, count) => {
        const deck    = target === 'player' ? window.playerDeck : window.opponentDeck;
        const handKey = target === 'player' ? 'playerHand' : 'opponentHand';
        for (let i = 0; i < count && deck.length > 0; i++) {
            window.GameState[handKey].push(deck.pop());
        }
        window.renderHand(target);
        renderDeck(deck, target === 'player' ? '#player-deck' : '.slot.deck.enemy');
    };

    drawSilent('player', 5);
    drawSilent('opponent', 5);
    console.log('🎮 Mani iniziali distribuite (5 carte ciascuno)');
};

// ----------------------------------------
// GESTIONE FASI
// ----------------------------------------
window.advanceToNextPhase = function () {
    const gs = window.GameState;
    gs.currentPhase++;

    // Fine ciclo → nuovo turno
    if (gs.currentPhase > 5) {
        gs.currentPhase = 1;
        gs.turnNumber++;
        gs.hasSummonedThisTurn = false;
        gs.hasOpponentSummonedThisTurn = false;
        gs.plannedActions = {};
        window.drawnThisTurn = 0;
        console.log(`🔄 ===== TURNO ${gs.turnNumber} =====`);
    }

    updatePhaseDisplay();
    const phaseBtn = document.querySelector('.phase-button');

    switch (gs.currentPhase) {
        case 1:
            // Pesca manuale — nascondi bottone
            if (phaseBtn) { phaseBtn.classList.add('hidden'); phaseBtn.textContent = 'Next Phase'; }
            break;

        case 2:
            // Schieramento
            if (phaseBtn) {
                phaseBtn.classList.remove('hidden');
                phaseBtn.textContent = 'Fine Schieramento →';
            }
            break;

        case 3:
            // Pianificazione — attiva UI azioni
            if (phaseBtn) {
                phaseBtn.classList.remove('hidden');
                phaseBtn.textContent = 'Conferma Azioni →';
            }
            if (window.initPlanningPhase) window.initPlanningPhase();
            break;

        case 4:
            // Turno avversario — tutto automatico
            if (phaseBtn) phaseBtn.classList.add('hidden');
            if (window.clearPlanningUI) window.clearPlanningUI();
            setTimeout(_runOpponentTurn, 600);
            break;

        case 5:
            // Resa dei conti — tutto automatico
            if (phaseBtn) phaseBtn.classList.add('hidden');
            setTimeout(window.resolvePhase5, 800);
            break;
    }

    console.log(`📍 Fase ${gs.currentPhase} — ${gs.phases[gs.currentPhase - 1]?.name} (Turno ${gs.turnNumber})`);
    gs.checkWinCondition();
};

// Alias bottone HTML
window.nextPhaseAuto = window.advanceToNextPhase;

// ----------------------------------------
// FASE 4 — TURNO AVVERSARIO (AI)
// ----------------------------------------
function _runOpponentTurn() {
    console.log('🤖 Avversario — Fase 1: Pesca...');
    let drawn = 0;

    const drawNext = () => {
        if (drawn >= DRAW_PER_TURN) {
            setTimeout(_opponentDeploy, 500);
            return;
        }
        window.drawOneCard('opponent', true); // skipCounter
        drawn++;
        setTimeout(drawNext, 700);
    };
    drawNext();
}

function _opponentDeploy() {
    const gs = window.GameState;
    console.log('🤖 Avversario — Fase 2: Schieramento...');

    if (!gs.hasOpponentSummonedThisTurn) {
        // Cerca prima unità non-boss valida in mano
        const unitIndex = gs.opponentHand.findIndex(card => {
            const type = window.getCardType(card);
            return window.isUnit(type) && !window.isSupportNPC(card, type) && type !== 'bosses';
        });

        if (unitIndex !== -1) {
            const opponentSlots = [...document.querySelectorAll('.player-area.opponent .slot.battle')];
            const preferred     = [2, 1, 3, 0, 4];
            const emptySlot     = preferred.map(i => opponentSlots[i]).find(s => s && !s.dataset.card);

            if (emptySlot) {
                const card      = gs.opponentHand[unitIndex];
                const type      = window.getCardType(card);
                gs.opponentHand.splice(unitIndex, 1);

                emptySlot.innerHTML = window.createCardImage(card, false);
                const inner = emptySlot.querySelector('.card-inner');
                if (inner) inner.style.transform = 'rotate(180deg)';
                emptySlot.dataset.card     = JSON.stringify(card);
                emptySlot.dataset.cardType = type;

                const allSlots = [...document.querySelectorAll('.player-area.opponent .slot.battle')];
                const slotIdx  = allSlots.indexOf(emptySlot);
                const stateKey = 'opponent_' + slotIdx;

                gs.unitStates[stateKey] = {
                    hp:             card.hp || 8,
                    maxHp:          card.hp || 8,
                    charges:        0,
                    dodgedLastTurn: false
                };
                window._showHPBadge(emptySlot, gs.unitStates[stateKey].hp);

                gs.hasOpponentSummonedThisTurn = true;
                window.renderHand('opponent');
                console.log(`🤖 Avversario schiera: ${card.name} (slot ${slotIdx})`);
            }
        }
    }

    setTimeout(_opponentPlan, 600);
}

function _opponentPlan() {
    const gs           = window.GameState;
    const opponentSlots = [...document.querySelectorAll('.player-area.opponent .slot.battle')];
    const playerSlots   = [...document.querySelectorAll('.player-area.player .slot.battle')];
    console.log('🤖 Avversario — Fase 3: Pianificazione...');

    opponentSlots.forEach((slot, i) => {
        if (!slot.dataset.card) return;
        const key   = 'opponent_' + i;
        const state = gs.unitStates[key] || {};

        if (gs.turnNumber === 1) {
            // Primo turno: niente attacchi
            if      (i < 2) gs.plannedActions[key] = { type: 'move_right' };
            else if (i > 2) gs.plannedActions[key] = { type: 'move_left' };
            else            gs.plannedActions[key] = { type: 'charge' };
        } else {
            const range     = [i, i - 1, i + 1].filter(t => t >= 0 && t < 5);
            const hasTarget = range.some(t => playerSlots[t]?.dataset.card);

            if (hasTarget) {
                gs.plannedActions[key] = (state.charges > 0) ? { type: 'heavy' } : { type: 'light' };
            } else {
                const dir = (i < 2) ? 'move_right' : (i > 2) ? 'move_left' : 'charge';
                gs.plannedActions[key] = { type: dir };
            }
        }
    });

    console.log('🤖 Azioni pianificate:', gs.plannedActions);
    setTimeout(() => window.advanceToNextPhase(), 900); // → Fase 5
}

// ----------------------------------------
// FASE 5 — RESA DEI CONTI
// ----------------------------------------
window.resolvePhase5 = function () {
    const gs = window.GameState;
    console.log('⚔️ === RESA DEI CONTI === Azioni:', gs.plannedActions);

    // 1. Marca schivate
    Object.entries(gs.plannedActions).forEach(([key, action]) => {
        const state = gs.unitStates[key];
        if (!state) return;
        state.dodging = (action.type === 'dodge');
    });

    // 2. Cariche
    Object.entries(gs.plannedActions).forEach(([key, action]) => {
        if (action.type !== 'charge') return;
        const state  = gs.unitStates[key] || (gs.unitStates[key] = {});
        state.charges = (state.charges || 0) + 1;
        window._updateChargeBadge(key);
        console.log(`⚡ ${key}: +1 carica (tot: ${state.charges})`);
    });

    // 3. Movimenti (simultanei — ordine: gli extremi prima per evitare collisioni)
    const moves = Object.entries(gs.plannedActions)
        .filter(([, a]) => a.type === 'move_left' || a.type === 'move_right');

    moves.sort(([ka, a], [kb]) => {
        const ia = parseInt(ka.split('_')[1]);
        const ib = parseInt(kb.split('_')[1]);
        return a.type === 'move_right' ? ib - ia : ia - ib;
    });
    moves.forEach(([key, action]) => {
        const [owner, idxStr] = key.split('_');
        const idx    = parseInt(idxStr);
        const newIdx = action.type === 'move_left' ? idx - 1 : idx + 1;
        if (newIdx >= 0 && newIdx < 5) _moveUnit(owner, idx, newIdx);
    });

    // 4. Calcolo danni (simultaneo — raccogliamo prima, poi applichiamo)
    const damageMap    = {};
    const directDamage = { player: 0, opponent: 0 };

    Object.entries(gs.plannedActions).forEach(([key, action]) => {
        if (!['light', 'heavy', 'magic'].includes(action.type)) return;

        const [owner, idxStr] = key.split('_');
        const idx     = parseInt(idxStr);
        const enemy   = owner === 'player' ? 'opponent' : 'player';
        const state   = gs.unitStates[key] || {};

        const attackerSlots = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
        const attackerSlot  = attackerSlots[idx];
        if (!attackerSlot?.dataset.card) return;

        const card = JSON.parse(attackerSlot.dataset.card);

        // Attacco pesante: richiede carica
        if (action.type === 'heavy') {
            if ((state.charges || 0) < 1) {
                console.warn(`⚠️ ${key}: attacco pesante senza carica — annullato`);
                return;
            }
            state.charges--;
            window._updateChargeBadge(key);
        }

        const baseAtk = card.atk || card.attack || 2;
        const dmg     = action.type === 'heavy' ? Math.round(baseAtk * 1.5)
                      : action.type === 'magic'  ? (card.fpcost || baseAtk)
                      :                             baseAtk;

        // Bersagli: 3 caselle frontali (posizione speculare ±1)
        const enemySlots = [...document.querySelectorAll(`.player-area.${enemy} .slot.battle`)];
        let targetIdx    = null;
        for (const t of [idx, idx - 1, idx + 1]) {
            if (t >= 0 && t < 5 && enemySlots[t]?.dataset.card) { targetIdx = t; break; }
        }

        if (targetIdx !== null) {
            const targetKey   = enemy + '_' + targetIdx;
            const targetState = gs.unitStates[targetKey] || {};

            if (targetState.dodging && !targetState.dodgedLastTurn) {
                targetState.dodgedLastTurn = true;
                console.log(`💨 ${targetKey} schiva l'attacco di ${key}!`);
                return;
            }

            damageMap[targetKey] = (damageMap[targetKey] || 0) + dmg;
            console.log(`⚔️ ${key}(${card.name}) → ${targetKey}: ${dmg} danno`);
        } else {
            // Danno diretto — nessuna unità nel raggio
            directDamage[enemy] += dmg;
            console.log(`💥 ${key}(${card.name}) → ${enemy} DIRETTO: ${dmg} rune`);
        }
    });

    // 5. Applica danni diretti alle Rune
    if (directDamage.player   > 0) { gs.playerRunes   -= directDamage.player;   _flashRunes('player',   directDamage.player); }
    if (directDamage.opponent > 0) { gs.opponentRunes -= directDamage.opponent; _flashRunes('opponent', directDamage.opponent); }

    // 6. Applica danni alle unità (simultaneo → accumula tutto, poi distruggi)
    const toDestroy = [];
    Object.entries(damageMap).forEach(([key, dmg]) => {
        const state = gs.unitStates[key];
        if (!state) return;
        state.hp -= dmg;
        if (state.hp <= 0) {
            toDestroy.push(key);
        } else {
            const [owner, idxStr] = key.split('_');
            const slots = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
            window._showHPBadge(slots[parseInt(idxStr)], state.hp);
        }
    });

    // Distruzione simultanea
    toDestroy.forEach(key => {
        const [owner, idxStr] = key.split('_');
        _destroyUnit(owner, parseInt(idxStr));
    });

    // 7. Reset stato schivata per il prossimo turno
    Object.values(gs.unitStates).forEach(state => {
        if (!state.dodging) state.dodgedLastTurn = false;
        state.dodging = false;
    });

    // 8. Pulizia UI azioni
    gs.plannedActions = {};
    if (window.clearAllActionBadges) window.clearAllActionBadges();

    // 9. Aggiorna HUD
    updatePhaseDisplay();
    if (gs.checkWinCondition()) return;

    // 10. Avanza al prossimo turno dopo pausa visuale
    setTimeout(() => window.advanceToNextPhase(), 1600);
};

// ----------------------------------------
// HELPER — Movimento unità
// ----------------------------------------
function _moveUnit(owner, fromIdx, toIdx) {
    const sel      = `.player-area.${owner} .slot.battle`;
    const slots    = [...document.querySelectorAll(sel)];
    const fromSlot = slots[fromIdx];
    const toSlot   = slots[toIdx];
    if (!fromSlot?.dataset.card || toSlot?.dataset.card) return;

    toSlot.innerHTML        = fromSlot.innerHTML;
    toSlot.dataset.card     = fromSlot.dataset.card;
    toSlot.dataset.cardType = fromSlot.dataset.cardType;
    if (fromSlot.dataset.equip) toSlot.dataset.equip = fromSlot.dataset.equip;

    fromSlot.innerHTML = '';
    delete fromSlot.dataset.card;
    delete fromSlot.dataset.cardType;
    delete fromSlot.dataset.equip;

    const gs      = window.GameState;
    const fromKey = owner + '_' + fromIdx;
    const toKey   = owner + '_' + toIdx;
    if (gs.unitStates[fromKey]) { gs.unitStates[toKey] = gs.unitStates[fromKey]; delete gs.unitStates[fromKey]; }
    if (gs.plannedActions[fromKey]) { gs.plannedActions[toKey] = gs.plannedActions[fromKey]; delete gs.plannedActions[fromKey]; }

    console.log(`🚶 ${owner} slot ${fromIdx} → ${toIdx}`);
}

// ----------------------------------------
// HELPER — Distruzione unità
// ----------------------------------------
function _destroyUnit(owner, idx) {
    const gs    = window.GameState;
    const slots = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    const slot  = slots[idx];
    if (!slot) return;

    let card = null;
    try { card = slot.dataset.card ? JSON.parse(slot.dataset.card) : null; } catch {}

    const wrapper = slot.querySelector('.card-wrapper');
    const clear   = () => {
        slot.innerHTML = '';
        delete slot.dataset.card;
        delete slot.dataset.cardType;
        delete slot.dataset.equip;
    };

    if (wrapper && window.animateDestroyCard) {
        window.animateDestroyCard(wrapper, clear);
    } else {
        clear();
    }

    const key = owner + '_' + idx;
    delete gs.unitStates[key];
    delete gs.plannedActions[key];

    // Loot
    if (card) {
        const loot = card.loot || card.drop || 2;
        if (owner === 'opponent') { gs.playerRunes   += loot; console.log(`💰 Loot: +${loot} Rune (${card.name})`); }
        else                     { gs.opponentRunes += loot; }
    }

    // Albero Madre
    if (card) {
        const mtSel = owner === 'player' ? '.slot.graveyard:not(.enemy)' : '.slot.graveyard.enemy';
        const mt    = document.querySelector(mtSel);
        if (mt) { mt.innerHTML = window.createCardImage(card, false); mt.dataset.card = JSON.stringify(card); }
    }

    updatePhaseDisplay();
    console.log(`💀 ${owner} unità ${idx} (${card?.name}) distrutta`);
}

// ----------------------------------------
// HELPER — Badge HP e Carica
// ----------------------------------------
window._showHPBadge = function (slotEl, hp) {
    if (!slotEl) return;
    let badge = slotEl.querySelector('.hp-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'hp-badge';
        badge.style.cssText = `
            position:absolute;bottom:4px;right:4px;
            background:rgba(160,25,25,0.9);color:#fff;
            font-size:0.6em;font-weight:bold;padding:2px 7px;
            border-radius:6px;z-index:110;pointer-events:none;
            font-family:'Cinzel',sans-serif;border:1px solid #ff443366;
        `;
        slotEl.style.position = 'relative';
        slotEl.appendChild(badge);
    }
    badge.textContent = `❤ ${hp}`;
};

window._updateChargeBadge = function (key) {
    const [owner, idxStr] = key.split('_');
    const slots   = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    const slot    = slots[parseInt(idxStr)];
    if (!slot) return;
    const charges = window.GameState.unitStates[key]?.charges || 0;
    let badge     = slot.querySelector('.charge-badge');
    if (charges === 0) { if (badge) badge.remove(); return; }
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'charge-badge';
        badge.style.cssText = `
            position:absolute;bottom:4px;left:4px;
            background:rgba(15,70,180,0.9);color:#fff;
            font-size:0.6em;font-weight:bold;padding:2px 7px;
            border-radius:6px;z-index:110;pointer-events:none;
            font-family:'Cinzel',sans-serif;border:1px solid #4488ff44;
        `;
        slot.style.position = 'relative';
        slot.appendChild(badge);
    }
    badge.textContent = `⚡ ${charges}`;
};

// ----------------------------------------
// HELPER — Flash Rune
// ----------------------------------------
function _flashRunes(side, amount) {
    const el = document.getElementById(side === 'player' ? 'player-runes' : 'opponent-runes');
    if (!el) return;
    el.style.transition = 'all 0.15s';
    el.style.color      = '#ff4444';
    el.style.transform  = 'scale(1.5)';
    setTimeout(() => { el.style.color = ''; el.style.transform = ''; }, 700);
}

// ----------------------------------------
// HUD
// ----------------------------------------
window.updatePhaseDisplay = function () {
    const gs        = window.GameState;
    const phaseName = gs.phases[gs.currentPhase - 1]?.name || '—';
    let label       = phaseName;

    if (gs.currentPhase === 1) {
        const remaining = DRAW_PER_TURN - window.drawnThisTurn;
        label += ` — ancora ${remaining}`;
    }

    const phaseEl = document.getElementById('current-phase');
    if (phaseEl) phaseEl.textContent = label;

    const playerRunes   = document.getElementById('player-runes');
    const opponentRunes = document.getElementById('opponent-runes');
    if (playerRunes)   playerRunes.textContent   = gs.playerRunes;
    if (opponentRunes) opponentRunes.textContent = gs.opponentRunes;
};

// ----------------------------------------
// CLICK SUL MAZZO (solo fase 1)
// ----------------------------------------
document.addEventListener('click', (e) => {
    const deckSlot = e.target.closest('#player-deck');
    if (!deckSlot) return;
    const gs = window.GameState;
    if (gs.currentPhase !== 1) return;
    if (window.drawnThisTurn >= DRAW_PER_TURN || window.isDrawing) return;
    window.drawOneCard('player');
});

// ----------------------------------------
// TYPE UTILS (duplicati per autonomia)
// ----------------------------------------
function getCardTypeFromId(cardId) {
    const idNum  = String(cardId).slice(-2);
    const typeMap = {
        '01':'ammos','02':'armors','03':'ashes','04':'bosses',
        '05':'classes','06':'creatures','07':'gloves','08':'helmets',
        '09':'incantations','10':'items','11':'leg_armors','12':'locations',
        '13':'npcs','14':'shields','15':'sorceries','16':'spirits',
        '17':'talismans','18':'weapons'
    };
    return typeMap[idNum] || 'unknown';
}

// ----------------------------------------
// CARD IMAGE HELPER
// ----------------------------------------
window.createCardImage = function (cardData, showBack = false) {
    const id    = cardData.id;
    const front = `static/src/cards/front/${id}.png`;
    const back  = `static/src/cards/back/back.png`;
    return `
        <div class="card-wrapper balatro-card ${showBack ? 'flipped' : ''}">
            <div class="card-inner">
                <div class="card face front">
                    <img src="${front}" class="w-full h-full object-contain"
                         onerror="this.src='https://placehold.co/300x400?text=${id}'">
                </div>
                <div class="card face back">
                    <img src="${back}" class="w-full h-full object-contain"
                         onerror="this.src='https://placehold.co/300x400?text=BACK'">
                </div>
            </div>
        </div>`;
};

// ----------------------------------------
// INIT
// ----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    updatePhaseDisplay();
});