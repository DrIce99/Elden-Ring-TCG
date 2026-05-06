// ========================================
// GAME RULES — Regole posizionamento, campo, pianificazione
// ========================================

// ----------------------------------------
// TYPE MAP
// ----------------------------------------
const TYPE_MAP = {
    '01': 'ammos', '02': 'armors', '03': 'ashes', '04': 'bosses',
    '05': 'classes', '06': 'creatures', '07': 'gloves', '08': 'helmets',
    '09': 'incantations', '10': 'items', '11': 'leg_armors', '12': 'locations',
    '13': 'npcs', '14': 'shields', '15': 'sorceries', '16': 'spirits',
    '17': 'talismans', '18': 'weapons'
};

window.getCardType = function (card) {
    const idStr  = String(card.id).padStart(4, '0');
    const suffix = idStr.slice(-2);
    return TYPE_MAP[suffix] || 'unknown';
};

window.isUnit = function (cardType) {
    return ['classes', 'npcs', 'creatures', 'bosses', 'spirits'].includes(cardType);
};

window.isEquipment = function (cardType) {
    return ['weapons', 'armors', 'gloves', 'leg_armors', 'helmets',
            'talismans', 'items', 'shields', 'ammos'].includes(cardType);
};

window.isSupportNPC = function (card, cardType) {
    return cardType === 'npcs' && card.support === 1;
};

// ----------------------------------------
// PLACEMENT MODE — stato selezione slot
// ----------------------------------------
window.placementState = null;

// ----------------------------------------
// TROVA SLOT VALIDI
// ----------------------------------------
function getValidSlots(card) {
    const type       = window.getCardType(card);
    const playerArea = '.player-area.player';

    if (window.isSupportNPC(card, type)) {
        return [...document.querySelectorAll(`${playerArea} .slot.support`)]
            .filter(s => !s.dataset.card);
    }
    if (window.isUnit(type)) {
        return [...document.querySelectorAll(`${playerArea} .slot.battle`)]
            .filter(s => !s.dataset.card);
    }
    if (window.isEquipment(type)) {
        return [...document.querySelectorAll(`${playerArea} .slot.battle`)]
            .filter(s => {
                if (!s.dataset.card) return false;
                try {
                    const d = JSON.parse(s.dataset.card);
                    return window.getCardType(d) === 'classes';
                } catch { return false; }
            });
    }
    return [];
}

// ----------------------------------------
// EVIDENZIA / PULISCE SLOT
// ----------------------------------------
function highlightSlots(slots) {
    clearHighlights();
    slots.forEach(slot => slot.classList.add('slot-highlight'));
}

function clearHighlights() {
    document.querySelectorAll('.slot-highlight, .slot-highlight-equip')
        .forEach(s => s.classList.remove('slot-highlight', 'slot-highlight-equip'));
}

// ----------------------------------------
// ENTRA IN PLACEMENT MODE
// ----------------------------------------
window.enterPlacementMode = function (card, handIndex) {
    cancelPlacementMode();

    const validSlots = getValidSlots(card);

    if (validSlots.length === 0) {
        const type = window.getCardType(card);
        if (window.isEquipment(type))              alert('❌ Nessuna Classe disponibile in campo per equipaggiare!');
        else if (window.isSupportNPC(card, type))  alert('❌ Slot supporto già occupato!');
        else                                        alert('❌ Nessuno slot disponibile in campo!');
        return;
    }

    window.placementState = { card, handIndex, validSlots };
    const type = window.getCardType(card);
    highlightSlots(validSlots);

    showPlacementHint(
        window.isEquipment(type)       ? 'Seleziona la Classe su cui equipaggiare'
        : window.isSupportNPC(card, type) ? 'Seleziona lo slot Supporto'
        :                                    'Seleziona uno slot in campo'
    );

    validSlots.forEach(slot => slot.addEventListener('click', onSlotClick));
    console.log(`🎯 Placement mode: ${card.name} (${type}) — ${validSlots.length} slot disponibili`);
};

function cancelPlacementMode() {
    if (!window.placementState) return;
    clearHighlights();
    hidePlacementHint();
    window.placementState.validSlots.forEach(slot => slot.removeEventListener('click', onSlotClick));
    window.placementState = null;
}

// ----------------------------------------
// CLICK SU SLOT EVIDENZIATO
// ----------------------------------------
function onSlotClick(e) {
    if (!window.placementState) return;
    const slot                   = e.currentTarget;
    const { card, handIndex }    = window.placementState;
    const type                   = window.getCardType(card);

    clearHighlights();
    hidePlacementHint();
    window.placementState = null;

    if (window.isEquipment(type)) placeEquipment(card, handIndex, slot);
    else                          placeUnit(card, handIndex, slot, type);
}

// ESC cancella placement
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.placementState) {
        cancelPlacementMode();
        console.log('↩️ Placement mode annullato');
    }
});

// Click fuori → cancella
document.addEventListener('click', (e) => {
    if (!window.placementState) return;
    if (!e.target.closest('.slot-highlight')) cancelPlacementMode();
}, true);

// ----------------------------------------
// POSIZIONA UNITÀ
// ----------------------------------------
function placeUnit(card, handIndex, slot, type) {
    const gs = window.GameState;

    if (type === 'bosses') {
        if (hasBossInField()) { alert('❌ Già 1 Boss in campo!'); return; }
        if (!checkTribute(card)) { alert('❌ Tributo Boss mancato!'); return; }
    }
    if (type === 'spirits' && !hasAllyClass()) {
        alert('❌ Le Lacrime richiedono una Classe alleata in campo!');
        return;
    }

    gs.playerHand.splice(handIndex, 1);

    slot.innerHTML        = createCardImage(card, false);
    slot.dataset.card     = JSON.stringify(card);
    slot.dataset.cardType = type;

    let equips = [];
    if (card.items && Array.isArray(card.items)) {
        // Mappiamo gli oggetti base per assicurarci che abbiano l'id necessario per getCardType
        equips = card.items.map(item => ({ ...item, isBase: true }));
    }
    slot.dataset.equip = JSON.stringify(equips);

    const allSlots = [...document.querySelectorAll('.player-area.player .slot.battle')];
    const slotIdx  = allSlots.indexOf(slot);

    if (window.initUnitStats) {
        window.initUnitStats('player', slotIdx, card, equips);
    } else {
        const stateKey = 'player_' + slotIdx;
        gs.unitStates[stateKey] = { hp: card.hp || 10, maxHp: card.hp || 10, charges: 0, dodgedLastTurn: false };
        window._showHPBadge?.(slot, gs.unitStates[stateKey].hp);
    }

    if (!window.isSupportNPC(card, type)) {
        gs.hasSummonedThisTurn = true;
    }

    window.renderEquipments(slot);
    window.renderHand('player');

    // Register passive & phase3 effects from the card and its equipment
    if (window.EffectEngine?.registerFieldEffects) {
        window.EffectEngine.registerFieldEffects(card, slot, 'player_' + slotIdx);
    }
    console.log(`✅ ${card.name} (${type}) — slot ${slotIdx}`);
}

window.initUnitStats = function(owner, slotIdx, card, equips = []) {
    const gs = window.GameState;
    const stateKey = owner + '_' + slotIdx;

    // Calcolo base dalle stats del personaggio
    let baseHp = parseInt(card.hp) || (card.stats ? parseInt(card.stats.vigor) * 10 : 10);
    let baseFp = parseInt(card.mp) || (card.stats ? parseInt(card.stats.mind) * 5 : 0);
    let baseStamina = card.stats ? parseInt(card.stats.endurance) * 10 : 0;

    let totalAtk = 0;
    let totalDef = 0;
    let totalNeg = 0;

    // Aggiungiamo i valori degli equipaggiamenti (armi, armature)
    equips.forEach(eq => {
        if (eq.attack && Array.isArray(eq.attack)) {
            const phy = eq.attack.find(a => a.name === 'Phy');
            if (phy) totalAtk += parseInt(phy.amount || 0);
        }
        if (eq.dmgNegation && Array.isArray(eq.dmgNegation)) {
            const phyDef = eq.dmgNegation.find(d => d.name === 'Phy');
            if (phyDef) totalNeg += parseFloat(phyDef.amount || 0);
        }
    });

    // Se non ha armi o armature predefinite, scaliamo sulle caratteristiche (Str/Dex/End)
    if (totalAtk === 0 && card.stats) totalAtk = parseInt(card.stats.strength || 0) * 2 + parseInt(card.stats.dexterity || 0);
    if (totalDef === 0 && card.stats) totalDef = parseInt(card.stats.endurance || 0) * 1.5;

    let atkBase = totalAtk > 0 ? totalAtk : parseInt(card.atk || card.attack || 0);

    // Salviamo tutto in liveStats
    gs.unitStates[stateKey] = {
        hp: baseHp,
        maxHp: baseHp,
        fp: baseFp,
        stamina: baseStamina,
        lightAtk: atkBase,
        heavyAtk: Math.floor(atkBase * 1.5),
        defense: { 
            physical: totalDef, 
            magic: totalDef * 0.8 
        },
        negation: { 
            phy: totalNeg, 
            magic: totalNeg * 0.8 
        },
        charges: 0,
        dodgedLastTurn: false
    };

    // Mostriamo l'HP Badge aggiornato
    const slot = document.querySelectorAll(`.player-area.${owner} .slot.battle`)[slotIdx];
    if (slot && window._showHPBadge) window._showHPBadge(slot, baseHp);
};

// Funzione da chiamare quando EQUIPAGGI o DISQUIPAGGI una carta sull'unità
window.recalculateUnitStats = function(slot, owner, slotIdx) {
    const card = JSON.parse(slot.dataset.card);
    const equips = JSON.parse(slot.dataset.equip || '[]');
    const gs = window.GameState;
    const stateKey = owner + '_' + slotIdx;
    
    // Salviamo gli HP attuali per non "curare" accidentalmente l'unità quando cambia arma
    const currentHp = gs.unitStates[stateKey].hp;
    
    // Ricalcoliamo i massimali
    window.initUnitStats(owner, slotIdx, card, equips);
    
    // Ripristiniamo gli HP, ma bloccandoli al nuovo Max HP nel caso in cui un buff vita sia stato rimosso
    gs.unitStates[stateKey].hp = Math.min(currentHp, gs.unitStates[stateKey].maxHp);
    if (window._showHPBadge) window._showHPBadge(slot, gs.unitStates[stateKey].hp);
};

// ----------------------------------------
// POSIZIONA EQUIPAGGIAMENTO
// ----------------------------------------
function placeEquipment(itemCard, handIndex, classSlot) {
    const gs = window.GameState;

    // Gestione scarto equipaggiamento precedente dello stesso tipo
    const existingEquipStr = classSlot.dataset.equip;
    if (existingEquipStr) {
        const existing = JSON.parse(existingEquipStr);
        // Se stiamo sovrascrivendo un oggetto dello stesso tipo (es. arma con arma)
        if (window.getCardType(existing) === window.getCardType(itemCard)) {
            window.discardCard(existing, 'player'); // Manda all'Erdtree
        }
    }

    // Aggiornamento array equipaggiamenti
    let equips = [];
    if (classSlot.dataset.equip) equips = JSON.parse(classSlot.dataset.equip);
    
    // Rimuoviamo eventuali vecchi oggetti dello stesso tipo prima di aggiungere il nuovo
    equips = equips.filter(e => window.getCardType(e) !== window.getCardType(itemCard));
    equips.push(itemCard);
    classSlot.dataset.equip = JSON.stringify(equips);

    // CALCOLO INDICE E AGGIORNAMENTO STATS (Risolve l'errore "slot is not defined")
    const allSlots = [...document.querySelectorAll('.player-area.player .slot.battle')];
    const slotIdx = allSlots.indexOf(classSlot);
    
    // Ricalcola le statistiche live
    window.recalculateUnitStats(classSlot, 'player', slotIdx);

    // Gestione visuale Overlay (opzionale se usi renderEquipments)
    let equipOverlay = classSlot.querySelector('.equip-overlay');
    if (!equipOverlay) {
        equipOverlay = document.createElement('div');
        equipOverlay.className = 'equip-overlay';
        classSlot.appendChild(equipOverlay);
    }
    equipOverlay.innerHTML = `
        <img src="static/src/cards/front/${itemCard.id}.png"
             style="width:60%;height:auto;opacity:0.85;border-radius:4px;border:1px solid #edd7ab"
             onerror="this.style.display='none'">`;

    // Rimuovi dalla mano e aggiorna UI
    gs.playerHand.splice(handIndex, 1);
    window.renderHand('player');

    // Mostra le icone degli oggetti (se hai aggiunto la funzione renderEquipments)
    if (window.renderEquipments) window.renderEquipments(classSlot);
    
    console.log(`🗡️ ${itemCard.name} equipped on ${JSON.parse(classSlot.dataset.card).name}`);
}

// ----------------------------------------
// SUMMON ENTRY POINT
// ----------------------------------------
window.trySummon = function (card, handIndex) {
    const gs   = window.GameState;
    const type = window.getCardType(card);

    if (gs.currentPhase !== 2) {
        alert('❌ Puoi schierare solo nella Fase di Schieramento!');
        return;
    }

    if (window.isEquipment(type)) {
        window.enterPlacementMode(card, handIndex);
        return;
    }

    if (!window.isSupportNPC(card, type) && gs.hasSummonedThisTurn) {
        alert('❌ Puoi schierare solo 1 combattente per turno!');
        return;
    }

    window.enterPlacementMode(card, handIndex);
};

// ----------------------------------------
// FASE 3 — PLANNING UI
// ----------------------------------------
window.initPlanningPhase = function () {
    const gs    = window.GameState;
    const slots = [...document.querySelectorAll('.player-area.player .slot.battle')];

    slots.forEach((slot, i) => {
        if (!slot.dataset.card) return;
        slot.style.cursor = 'pointer';
        slot._planningHandler = (e) => {
            // Non interferire con hover panel
            if (e.target.closest('#card-hover-panel') || e.target.closest('#card-preview-top')) return;
            e.stopPropagation();
            showActionMenu(slot, 'player_' + i, i);
        };
        slot.addEventListener('click', slot._planningHandler);
        // Evidenza visiva che è cliccabile
        slot.classList.add('planning-active');
    });

    showPlacementHint('Fase 3 — Seleziona le azioni per ogni unità, poi clicca Conferma');
    console.log('📋 Fase pianificazione attivata');
};

window.clearPlanningUI = function () {
    const slots = [...document.querySelectorAll('.player-area.player .slot.battle')];
    slots.forEach(slot => {
        if (slot._planningHandler) {
            slot.removeEventListener('click', slot._planningHandler);
            delete slot._planningHandler;
        }
        slot.style.cursor = '';
        slot.classList.remove('planning-active');
    });
    hidePlacementHint();
    _closeActionMenu();
};

// ----------------------------------------
// ACTION MENU (fase 3)
// ----------------------------------------
function showActionMenu(slotEl, unitKey, slotIndex) {
    _closeActionMenu();

    const gs          = window.GameState;
    const isFirstTurn = gs.turnNumber === 1;
    const state       = gs.unitStates[unitKey] || {};
    const canHeavy    = (state.charges || 0) >= 1;
    const canDodge    = !state.dodgedLastTurn;

    // Controlla se c'è un bersaglio nel raggio (per hint)
    const enemySlots = [...document.querySelectorAll('.player-area.opponent .slot.battle')];
    const inRange    = [slotIndex - 1, slotIndex, slotIndex + 1]
        .filter(t => t >= 0 && t < 5)
        .some(t => enemySlots[t]?.dataset.card);

    const currentType = gs.plannedActions[unitKey]?.type;

    const card = (() => { try { return JSON.parse(slotEl.dataset.card); } catch { return {}; } })();

    // Catch Flame free action (from equipped incantation)
    const catchFlame = window.getCatchFlameAction?.(unitKey);

    const actionDefs = [
        { id: 'move_left',  label: '← Move Left',           available: slotIndex > 0,            icon: '←' },
        { id: 'move_right', label: 'Move Right →',           available: slotIndex < 4,            icon: '→' },
        { id: 'dodge',      label: '💨 Dodge',               available: canDodge,                 icon: '💨', note: !canDodge ? '(used last turn)' : '' },
        { id: 'charge',     label: '⚡ Charge',              available: true,                     icon: '⚡' },
        { id: 'light',      label: '⚔️ Light Attack',        available: !isFirstTurn,             icon: '⚔️', note: isFirstTurn ? '(first turn)' : inRange ? '(enemy in range)' : '' },
        { id: 'heavy',      label: '💥 Heavy Attack',        available: !isFirstTurn && canHeavy, icon: '💥', note: !canHeavy ? '(charge required)' : isFirstTurn ? '(first turn)' : '' },
        ...(catchFlame ? [{ ...catchFlame, isFree: true }] : []),
    ];

    const menu = document.createElement('div');
    menu.id = 'action-menu';
    menu.style.cssText = `
        position:fixed;z-index:7000;
        background:rgba(12,8,4,0.97);
        border:2px solid #edd7ab88;border-radius:14px;
        padding:14px 12px;display:flex;flex-direction:column;gap:6px;
        min-width:200px;max-width:230px;
        box-shadow:0 8px 40px rgba(0,0,0,0.8),0 0 0 1px #edd7ab22;
        font-family:'Cinzel',sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `color:#edd7ab;font-size:0.8em;font-weight:bold;
        margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid #edd7ab33;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    header.textContent = `Azione: ${card.name || unitKey}`;
    menu.appendChild(header);

    actionDefs.forEach(a => {
        const btn = document.createElement('button');
        const isSelected = currentType === a.id;
        btn.style.cssText = `
            background:${isSelected ? 'rgba(237,215,171,0.22)' : 'rgba(237,215,171,0.04)'};
            color:${a.available ? '#edd7ab' : '#555'};
            border:1px solid ${isSelected ? '#edd7ab88' : a.available ? '#edd7ab22' : '#33333366'};
            border-radius:8px;padding:8px 12px;cursor:${a.available ? 'pointer' : 'not-allowed'};
            font-family:inherit;font-size:0.88em;text-align:left;width:100%;
            display:flex;justify-content:space-between;align-items:center;
            transition:background 0.12s,border 0.12s;
        `;
        btn.innerHTML = `<span>${a.label}</span>${a.note ? `<span style="font-size:0.75em;opacity:0.5;margin-left:6px;">${a.note}</span>` : ''}`;
        if (isSelected) btn.innerHTML += `<span style="color:#edd7ab;margin-left:auto;">✓</span>`;

        if (a.available) {
            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(237,215,171,0.14)'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = isSelected ? 'rgba(237,215,171,0.22)' : 'rgba(237,215,171,0.04)'; });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (a.isFree) {
                    // Free action: mark catch flame as active, don't consume planned action
                    const st = window.GameState.unitStates[unitKey] || {};
                    st.catchFlameActive = true;
                    st.catchFlameReady  = false;
                    _showActionBadge(slotEl, '🔥 Catch Flame (Free)', '#ff8833');
                    // Don't close menu — player still picks a regular action
                    return;
                }
                gs.plannedActions[unitKey] = { type: a.id };
                _showActionBadge(slotEl, a.label);
                _closeActionMenu();
                console.log(`📋 ${unitKey} → ${a.id}`);
            });
        }
        menu.appendChild(btn);
    });

    // Separatore + bottone annulla
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #edd7ab22;margin:4px 0;';
    menu.appendChild(sep);

    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `
        background:rgba(180,40,40,0.1);color:#cc7777;
        border:1px solid #cc444422;border-radius:8px;
        padding:7px 12px;cursor:pointer;font-family:inherit;
        font-size:0.82em;text-align:left;width:100%;
    `;
    cancelBtn.textContent = '✕  Nessuna azione';
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        delete gs.plannedActions[unitKey];
        _clearActionBadge(slotEl);
        _closeActionMenu();
    });
    menu.appendChild(cancelBtn);

    // Posiziona vicino allo slot
    const rect  = slotEl.getBoundingClientRect();
    const left  = Math.min(rect.right + 10, window.innerWidth - 250);
    const top   = Math.min(Math.max(rect.top - 20, 10), window.innerHeight - 360);
    menu.style.left = `${left}px`;
    menu.style.top  = `${top}px`;

    document.body.appendChild(menu);

    // Chiudi se si clicca fuori
    setTimeout(() => document.addEventListener('click', _closeMenuOutside), 50);
}

function _closeMenuOutside(e) {
    const menu = document.getElementById('action-menu');
    if (menu && !menu.contains(e.target)) _closeActionMenu();
}

function _closeActionMenu() {
    const menu = document.getElementById('action-menu');
    if (menu) menu.remove();
    document.removeEventListener('click', _closeMenuOutside);
}

function _showActionBadge(slotEl, label) {
    _clearActionBadge(slotEl);
    const badge = document.createElement('div');
    badge.className = 'action-badge';
    badge.style.cssText = `
        position:absolute;top:4px;left:4px;right:4px;
        background:rgba(237,215,171,0.88);color:#1a1008;
        font-size:0.58em;font-weight:bold;padding:3px 6px;
        border-radius:6px;text-align:center;z-index:120;
        pointer-events:none;font-family:'Cinzel',sans-serif;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
    `;
    badge.textContent = label;
    slotEl.style.position = 'relative';
    slotEl.appendChild(badge);
}

function _clearActionBadge(slotEl) {
    const badge = slotEl.querySelector('.action-badge');
    if (badge) badge.remove();
}

window.clearAllActionBadges = function () {
    document.querySelectorAll('.action-badge').forEach(b => b.remove());
};

// ----------------------------------------
// HOVER PREVIEW
// ----------------------------------------
document.addEventListener('mouseover', (e) => {
    // Non aprire preview durante planning (action menu aperto)
    if (document.getElementById('action-menu')) return;
    const cardSlot = e.target.closest('[data-card]');
    if (!cardSlot) return;
    if (cardSlot.contains(e.relatedTarget)) return;
    const wrapper = cardSlot.querySelector('.card-wrapper');
    if (!wrapper || wrapper.classList.contains('flipped')) return;
    const cardData = JSON.parse(cardSlot.dataset.card);
    showCardInfo(cardData, cardSlot);
});

function showCardInfo(cardData, cardElement) {
    hideCardInfo();
    showSidePanel(cardData, cardElement);
    showTopPreview(cardData);
}

document.addEventListener('mouseout', (e) => {
    const cardSlot = e.target.closest('[data-card]');
    if (!cardSlot) return;
    if (cardSlot.contains(e.relatedTarget)) return;
    const isOverPreview =
        e.relatedTarget?.closest('#card-hover-panel') ||
        e.relatedTarget?.closest('#card-preview-top');
    if (isOverPreview) return;
    hideCardInfo();
});

// ----------------------------------------
// HOVER PREVIEW - PANNELLO LATERALE
// ----------------------------------------
function showSidePanel(card, element) {
    const panel = document.getElementById('card-hover-panel');
    panel.classList.add('hiddenn');

    const slotEl   = element.closest?.('.slot.battle');
    const allPlayer = [...document.querySelectorAll('.player-area.player .slot.battle')];
    const allEnemy  = [...document.querySelectorAll('.player-area.opponent .slot.battle')];
    const pIdx      = allPlayer.indexOf(slotEl);
    const eIdx      = allEnemy.indexOf(slotEl);
    const gs        = window.GameState;

    let liveStats = null;
    if (pIdx !== -1 && gs?.unitStates) liveStats = gs.unitStates['player_'   + pIdx];
    if (eIdx !== -1 && gs?.unitStates) liveStats = gs.unitStates['opponent_' + eIdx];

    const type = window.getCardType?.(card) || '';
    const isUnit = ['classes','npcs','creatures','bosses','spirits'].includes(type);

    // Recupera l'equipaggiamento: dal DOM se sul campo, oppure dalla carta se in mano
    let equips = [];
    if (slotEl && slotEl.dataset.equip) {
        try { equips = JSON.parse(slotEl.dataset.equip); } catch {}
    } else if (card.items) {
        equips = card.items;
    }

    let html = '';

    if (liveStats && isUnit) {
        // --- STATISTICHE LIVE (UNITÀ SUL CAMPO) ---
        const d  = liveStats.defense   || {};
        const n  = liveStats.negation  || {};

        html = `
            <h3 style="margin:0 0 6px;color:#edd7ab;font-size:1em;">${card.name}</h3>
            <div style="font-size:0.75em;color:#bbb;margin-bottom:8px;">${type.toUpperCase()}</div>
            <hr style="border-color:#edd7ab33;margin:0 0 8px;">

            <div class="stat-section-title">Vitals</div>
            <div class="stat-row"><span>HP</span><span>${liveStats.hp} / ${liveStats.maxHp}</span></div>
            ${liveStats.fp > 0 ? `<div class="stat-row"><span>FP</span><span>${liveStats.fp}</span></div>` : ''}
            <div class="stat-row"><span>Stamina</span><span>${liveStats.stamina || '—'}</span></div>

            <div class="stat-section-title" style="margin-top:8px;">Attack Power</div>
            <div class="stat-row"><span>⚔ Light</span><span>${liveStats.lightAtk || '—'}</span></div>
            <div class="stat-row"><span>⚒ Heavy</span><span>${liveStats.heavyAtk || '—'}</span></div>

            <div class="stat-section-title" style="margin-top:8px;">Defense & Negation</div>
            <div class="stat-row"><span>Physical</span><span>${d.physical ?? '—'} | ${Number(n.phy||0).toFixed(1)}%</span></div>
            <div class="stat-row"><span>Magic</span><span>${d.magic ?? '—'} | ${(n.magic||0).toFixed(1)}%</span></div>
        `;

        if (equips.length > 0) {
            html += `<div class="stat-section-title" style="margin-top:8px;">Equipaggiamento Attivo</div>`;
            equips.forEach(eq => {
                const eqTypeStr = window.getCardType(eq).replace('_', ' ');
                const tag = eq.isBase ? '(Base)' : '(Equipped)';
                html += `<div class="stat-row" style="color:#aaa;"><span>${eqTypeStr}</span><span>${eq.name} <span style="font-size:0.8em;opacity:0.7;">${tag}</span></span></div>`;
            });
        }
    } else {
        // --- STATISTICHE CALCOLATE (IN MANO / MAZZO / OGGETTI) ---
        const computed = computeCardStats(card, equips);
        html = `
            <h3 style="margin:0 0 6px;color:#edd7ab;font-size:1em;">${card.name}</h3>
            <div style="font-size:0.75em;color:#bbb;margin-bottom:8px;">${type.toUpperCase()}</div>
            <hr style="border-color:#edd7ab33;margin:0 0 8px;">
        `;

        if (isUnit) {
            html += `${computed.hp ? `<div class="stat-row"><span>HP Base</span><span>${computed.hp}</span></div>` : ''}`;
            html += `${computed.fp ? `<div class="stat-row"><span>FP Base</span><span>${computed.fp}</span></div>` : ''}`;
            html += `${computed.atk ? `<div class="stat-row"><span>Attacco Stimato</span><span>${computed.atk}</span></div>` : ''}`;
            html += `${computed.def ? `<div class="stat-row"><span>Difesa Stimata</span><span>${computed.def}</span></div>` : ''}`;

            if (equips.length > 0) {
                html += `<div class="stat-section-title" style="margin-top:8px;">Equipaggiamento Base</div>`;
                equips.forEach(eq => {
                    html += `<div class="stat-row" style="color:#aaa;"><span>- ${eq.name}</span></div>`;
                });
            }
        } else if (type === 'weapons') {
            if (computed.attack && computed.attack.length > 0) {
                html += `<div class="stat-section-title">Attack Power</div>`;
                computed.attack.forEach(a => {
                    if (a.amount > 0) html += `<div class="stat-row"><span>${a.name}</span><span>${a.amount}</span></div>`;
                });
            }
            if (computed.scalesWith && computed.scalesWith.length > 0) {
                html += `<div class="stat-section-title" style="margin-top:8px;">Attribute Scaling</div>`;
                computed.scalesWith.forEach(s => {
                    html += `<div class="stat-row"><span>${s.name}</span><span>${s.scaling}</span></div>`;
                });
            }
        } else if (['armors', 'helmets', 'gloves', 'leg_armors', 'shields'].includes(type)) {
            if (computed.dmgNegation && computed.dmgNegation.length > 0) {
                html += `<div class="stat-section-title">Damage Negation</div>`;
                computed.dmgNegation.forEach(d => {
                    html += `<div class="stat-row"><span>${d.name}</span><span>${d.amount}</span></div>`;
                });
            }
            if (computed.resistance && computed.resistance.length > 0) {
                html += `<div class="stat-section-title" style="margin-top:8px;">Resistances</div>`;
                computed.resistance.forEach(r => {
                    html += `<div class="stat-row"><span>${r.name}</span><span>${r.amount}</span></div>`;
                });
            }
            html += `<div class="stat-section-title" style="margin-top:8px;">Weight: ${computed.weight || '-'}</div>`;
        } else {
            html += `${computed.fpCost ? `<div class="stat-row"><span>FP Cost</span><span>${computed.fpCost}</span></div>` : ''}`;
            html += `${computed.atk ? `<div class="stat-row"><span>Damage</span><span>${computed.atk}</span></div>` : ''}`;
        }
    }

    panel.innerHTML = html;

    if (!document.getElementById('stat-panel-style')) {
        const style = document.createElement('style');
        style.id = 'stat-panel-style';
        style.textContent = `
            .stat-section-title { color:#edd7ab88; font-size:0.68em; text-transform:uppercase; letter-spacing:.08em; margin:4px 0 2px; }
            .stat-row { display:flex; justify-content:space-between; gap:12px; font-size:0.78em; color:#ddd; padding:1px 0; }
            .stat-row span:last-child { color:#edd7ab; font-weight:bold; }
        `;
        document.head.appendChild(style);
    }

    const rect = element.getBoundingClientRect();
    panel.style.left = `${rect.right + 10}px`;
    panel.style.top  = `${rect.top + window.scrollY}px`;
    panel.classList.remove('hiddenn');
}

function showTopPreview(card) {
    const panel = document.getElementById('card-preview-top');
    panel.classList.add('hiddenn');
    const passivesHtml = (card.passives && card.passives.length > 0)
        ? card.passives.map(p => `<div class="flex justify-between"><span>${p.type}</span><span class="opacity-70">${p.amount}%</span></div>`).join('')
        : `<div class="opacity-40">None</div>`;
    panel.innerHTML = `
        <img src="${card.img}" />
        <div style="flex:1;color:white;">
            <h2>${card.name}</h2>
            <p>${card.desc || 'No description'}</p>
            <p style="opacity:0.7;font-style:italic;">${card.gamedesc || ''}</p>
            <div>${passivesHtml}</div>
        </div>`;
    panel.classList.remove('hiddenn');
}

function hideCardInfo() {
    hideSidePanel();
    const topPanel = document.getElementById('card-preview-top');
    if (topPanel) topPanel.classList.add('hiddenn');
}

function hideSidePanel() {
    const panel = document.getElementById('card-hover-panel');
    if (panel) panel.classList.add('hiddenn');
}

function computeCardStats(card, equips = []) {
    const type  = window.getCardType(card);
    const stats = {};

    if (['classes', 'bosses', 'npcs', 'creatures', 'spirits'].includes(type)) {
        stats.hp = card.hp || (card.stats ? card.stats.vigor * 10 : '—');
        stats.fp = card.mp || (card.stats ? card.stats.mind * 5 : '—');

        let totalAtk = 0;
        let totalDef = 0;

        // Se l'arma bindata ha i dati completi nell'oggetto, calcoliamo i danni, 
        // altrimenti fallback sulle statistiche (Str/Dex)
        equips.forEach(eq => {
            if (eq.attack && Array.isArray(eq.attack)) {
                const phy = eq.attack.find(a => a.name === 'Phy');
                if (phy) totalAtk += phy.amount;
            }
            if (eq.dmgNegation && Array.isArray(eq.dmgNegation)) {
                const phyDef = eq.dmgNegation.find(d => d.name === 'Phy');
                if (phyDef) totalDef += phyDef.amount;
            }
        });

        if (totalAtk === 0 && card.stats) {
            totalAtk = parseInt(card.stats.strength || 0) * 2 + parseInt(card.stats.dexterity || 0);
        }
        if (totalDef === 0 && card.stats) {
            totalDef = parseInt(card.stats.endurance || 0) * 1.5;
        }

        stats.atk = totalAtk > 0 ? totalAtk : (card.atk || card.attack || '—');
        stats.def = totalDef > 0 ? totalDef.toFixed(1) : '—';

    } else if (type === 'weapons') {
        stats.attack = card.attack || [];
        stats.scalesWith = card.scalesWith || [];
    } else if (['armors', 'helmets', 'gloves', 'leg_armors', 'shields'].includes(type)) {
        stats.dmgNegation = card.dmgNegation || [];
        stats.resistance = card.resistance || [];
        stats.weight = card.weight;
    } else if (['sorceries', 'incantations'].includes(type)) {
        stats.fpCost = card.fpcost;
        stats.atk = card.attack;
    }

    return stats;
}

function hideEquipPreview() {
    const existing = document.getElementById('equip-preview');
    if (existing) existing.remove();
}

document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.slot.battle')) hideEquipPreview();
});

// ----------------------------------------
// DRAG & DROP
// ----------------------------------------
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    const gs = window.GameState;
    if (gs.currentPhase !== 2) return;
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
        const { card, index } = JSON.parse(raw);
        const targetSlot = e.target.closest('.slot.battle, .slot.support');
        if (targetSlot) dropOnSlot(card, index, targetSlot);
        else             window.trySummon(card, index);
    } catch (err) {
        console.error('Drop error:', err);
    }
});

function dropOnSlot(card, handIndex, slot) {
    const gs         = window.GameState;
    const type       = window.getCardType(card);
    const validSlots = getValidSlots(card);
    if (!validSlots.includes(slot)) { alert('❌ Slot non valido per questa carta!'); return; }
    if (window.isEquipment(type)) {
        placeEquipment(card, handIndex, slot);
    } else {
        if (!window.isSupportNPC(card, type) && gs.hasSummonedThisTurn) {
            alert('❌ Puoi schierare solo 1 combattente per turno!');
            return;
        }
        placeUnit(card, handIndex, slot, type);
    }
}

// ----------------------------------------
// HINT DI PLACEMENT
// ----------------------------------------
function showPlacementHint(text) {
    let hint = document.getElementById('placement-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'placement-hint';
        hint.style.cssText = `
            position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
            background:rgba(237,215,171,0.92);color:#1a1a1a;
            padding:10px 24px;border-radius:20px;font-weight:bold;
            font-family:'Cinzel',sans-serif;font-size:0.95em;
            z-index:5000;box-shadow:0 4px 20px rgba(0,0,0,0.5);
            pointer-events:none;max-width:80%;text-align:center;
        `;
        document.body.appendChild(hint);
    }
    hint.textContent = text;
    hint.style.display = 'block';
}

function hidePlacementHint() {
    const hint = document.getElementById('placement-hint');
    if (hint) hint.style.display = 'none';
}

// ----------------------------------------
// STUB (dipendenze esterne)
// ----------------------------------------
function checkTribute(card) { return true; }
function saveAction(slot, action) { console.log('Azione:', action); }

// ----------------------------------------
// UTILITY
// ----------------------------------------
function hasAllyClass() {
    return !!document.querySelector('.player-area.player .slot.battle[data-card-type="classes"]');
}

function hasBossInField() {
    return !!document.querySelector('.player-area.player .slot.battle[data-card-type="bosses"]');
}

function sendToMotherTree(cardData) {
    const mt = document.querySelector('.slot.graveyard:not(.enemy)');
    if (!mt) return;
    mt.innerHTML   = createCardImage(cardData, false);
    mt.dataset.card = JSON.stringify(cardData);
    console.log('📦 → Albero Madre:', cardData.name);
}

// createCardImage — usa quella di turn-manager se disponibile
function createCardImage(cardData, showBack = false) {
    if (window.createCardImage && window.createCardImage !== createCardImage) {
        return window.createCardImage(cardData, showBack);
    }
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
}

window.renderEquipments = function(slot) {
    let eqContainer = slot.querySelector('.equip-container');
    if (!eqContainer) {
        eqContainer = document.createElement('div');
        eqContainer.className = 'equip-container';
        // Le mini icone appariranno nell'angolo in basso a sinistra della carta
        eqContainer.style.cssText = 'position:absolute; bottom:4px; left:4px; display:flex; gap:4px; z-index:10; pointer-events:none;';
        slot.appendChild(eqContainer);
    }
    eqContainer.innerHTML = '';
    
    let equips = [];
    try { equips = JSON.parse(slot.dataset.equip || '[]'); } catch(e){}

    equips.forEach(eq => {
        if (!eq.image) return;
        const img = document.createElement('img');
        img.src = eq.image;
        // Icone rotonde con un bordo dorato per richiamare lo stile del gioco
        img.style.cssText = 'width:22px; height:22px; border-radius:50%; border:1px solid #edd7ab; object-fit:cover; background:#000; box-shadow: 0 0 4px #000;';
        img.title = eq.name; // Il nome appare se ci passi sopra col mouse
        eqContainer.appendChild(img);
    });
};

window.discardCard = function(card, owner = 'player') {
    const gs = window.GameState;
    if (!gs.discardPile) gs.discardPile = { player: [], opponent: [] };
    
    // Aggiungi la carta alla lista
    gs.discardPile[owner].push(card);

    // Cerca l'elemento grafico dell'Erdtree (assicurati che l'ID corrisponda a quello nel tuo HTML, es. 'erdtree')
    const erdtreeEl = document.getElementById('erdtree') || document.querySelector('.discard-pile');
    
    if (erdtreeEl) {
        // Applica l'immagine della carta come sfondo dell'Erdtree
        erdtreeEl.style.backgroundImage = `url(${card.image})`;
        erdtreeEl.style.backgroundSize = 'cover';
        erdtreeEl.style.backgroundPosition = 'center';
        erdtreeEl.style.border = '2px solid #edd7ab';
        erdtreeEl.style.position = 'relative';
        erdtreeEl.title = `In cima agli scarti: ${card.name}`;
        
        // Aggiungi un piccolo contatore per far capire quante carte ci sono dentro
        erdtreeEl.innerHTML = `<div style="position:absolute; bottom:2px; right:4px; background:rgba(0,0,0,0.8); color:#fff; font-size:12px; padding:2px 5px; border-radius:4px;">${gs.discardPile[owner].length}</div>`;
    }
};