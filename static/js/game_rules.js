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

    // Inizializza stato dell'unità
    const allSlots = [...document.querySelectorAll('.player-area.player .slot.battle')];
    const slotIdx  = allSlots.indexOf(slot);
    const stateKey = 'player_' + slotIdx;
    gs.unitStates[stateKey] = {
        hp:             card.hp || 10,
        maxHp:          card.hp || 10,
        charges:        0,
        dodgedLastTurn: false
    };
    window._showHPBadge(slot, gs.unitStates[stateKey].hp);

    if (!window.isSupportNPC(card, type)) {
        gs.hasSummonedThisTurn = true;
    }

    window.renderHand('player');
    console.log(`✅ ${card.name} (${type}) — slot ${slotIdx}, HP: ${gs.unitStates[stateKey].hp}`);
}

// ----------------------------------------
// POSIZIONA EQUIPAGGIAMENTO
// ----------------------------------------
function placeEquipment(itemCard, handIndex, classSlot) {
    const gs = window.GameState;

    const existingEquipStr = classSlot.dataset.equip;
    if (existingEquipStr) {
        const existing = JSON.parse(existingEquipStr);
        if (window.getCardType(existing) === window.getCardType(itemCard)) {
            sendToMotherTree(existing);
        }
    }

    let equips = [];
    if (classSlot.dataset.equip) equips = JSON.parse(classSlot.dataset.equip);
    equips = equips.filter(e => window.getCardType(e) !== window.getCardType(itemCard));
    equips.push(itemCard);
    classSlot.dataset.equip = JSON.stringify(equips);

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

    gs.playerHand.splice(handIndex, 1);
    window.renderHand('player');
    console.log(`🗡️ ${itemCard.name} equipaggiato su ${JSON.parse(classSlot.dataset.card).name}`);
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

    const actionDefs = [
        { id: 'move_left',  label: '← Muovi Sinistra',     available: slotIndex > 0,            icon: '←' },
        { id: 'move_right', label: 'Muovi Destra →',        available: slotIndex < 4,            icon: '→' },
        { id: 'dodge',      label: '💨 Schivata',           available: canDodge,                 icon: '💨', note: !canDodge ? '(già schivato)' : '' },
        { id: 'charge',     label: '⚡ Carica',             available: true,                     icon: '⚡' },
        { id: 'light',      label: '⚔️ Attacco Leggero',   available: !isFirstTurn,             icon: '⚔️', note: isFirstTurn ? '(primo turno)' : inRange ? '(nemico in range)' : '' },
        { id: 'heavy',      label: '💥 Attacco Pesante',   available: !isFirstTurn && canHeavy, icon: '💥', note: !canHeavy ? '(carica necessaria)' : isFirstTurn ? '(primo turno)' : '' },
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

function showSidePanel(card, element) {
    const panel = document.getElementById('card-hover-panel');
    panel.classList.add('hiddenn');
    const computed = computeCardStats(card, element);
    panel.innerHTML = `
        <h3>${card.name}</h3><hr>
        ${computed.hp       ? `<p>HP: ${computed.hp}</p>`         : ''}
        ${computed.mana     ? `<p>Mana: ${computed.mana}</p>`     : ''}
        ${computed.stamina  ? `<p>Stamina: ${computed.stamina}</p>` : ''}
        ${computed.lightAtk ? `<p>Light: ${computed.lightAtk}</p>` : ''}
        ${computed.heavyAtk ? `<p>Heavy: ${computed.heavyAtk}</p>` : ''}
        ${computed.charges  ? `<p>Charges: ${computed.charges}</p>` : ''}
    `;
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

function computeCardStats(card, element) {
    const type  = window.getCardType(card);
    const stats = {};
    if (type === 'classes') {
        stats.hp = card.hp || '—'; stats.mana = '—'; stats.stamina = '—';
        stats.lightAtk = '—'; stats.heavyAtk = '—';
    } else if (['bosses', 'npcs', 'creatures', 'spirits'].includes(type)) {
        stats.hp = card.hp;
    } else if (type === 'weapons') {
        stats.lightAtk = card.atk || card.attack || '—';
    } else if (['sorceries', 'incantations'].includes(type)) {
        stats.mana = card.fpcost; stats.lightAtk = card.attack;
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