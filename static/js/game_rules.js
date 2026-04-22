// ========================================
// GAME RULES — Regole posizionamento e campo
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
    const idStr = String(card.id).padStart(4, '0');
    const suffix = idStr.slice(-2);
    return TYPE_MAP[suffix] || 'unknown';
};

// Unità da combattimento (vanno negli slot .battle)
window.isUnit = function (cardType) {
    return ['classes', 'npcs', 'creatures', 'bosses', 'spirits'].includes(cardType);
};

// Equipaggiamento (va sulle classi)
window.isEquipment = function (cardType) {
    return ['weapons', 'armors', 'gloves', 'leg_armors', 'helmets', 'talismans', 'items',
        'shields', 'ammos'].includes(cardType);
};

// NPC di supporto: tipo npcs E ha flag support = true
window.isSupportNPC = function (card, cardType) {
    return cardType === 'npcs' && card.support === 1;
};

// ----------------------------------------
// PLACEMENT MODE — stato selezione slot
// ----------------------------------------
window.placementState = null;
// { card, handIndex, validSlots: [...] }

// ----------------------------------------
// TROVA SLOT VALIDI
// ----------------------------------------
function getValidSlots(card) {
    const type = window.getCardType(card);
    const playerArea = '.player-area.player';

    // 1. NPC di supporto → slot support vuoto
    if (window.isSupportNPC(card, type)) {
        return [...document.querySelectorAll(`${playerArea} .slot.support`)]
            .filter(s => !s.dataset.card);
    }

    // 2. Unità combattimento → slot battle vuoti
    //    (NPC senza flag support = trattato come unità)
    if (window.isUnit(type)) {
        return [...document.querySelectorAll(`${playerArea} .slot.battle`)]
            .filter(s => !s.dataset.card);
    }

    // 3. Equipaggiamento → slot battle che ha una Classe
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
    // Se era già in placement mode, cancella prima
    cancelPlacementMode();

    const validSlots = getValidSlots(card);

    if (validSlots.length === 0) {
        const type = window.getCardType(card);
        if (window.isEquipment(type)) {
            alert('❌ Nessuna Classe disponibile in campo per equipaggiare!');
        } else if (window.isSupportNPC(card, type)) {
            alert('❌ Slot supporto già occupato!');
        } else {
            alert('❌ Nessuno slot disponibile in campo!');
        }
        return;
    }

    window.placementState = { card, handIndex, validSlots };

    // Evidenzia
    const type = window.getCardType(card);
    highlightSlots(validSlots);

    // Istruzione visuale
    showPlacementHint(
        window.isEquipment(type)
            ? 'Seleziona la Classe su cui equipaggiare'
            : window.isSupportNPC(card, type)
                ? 'Seleziona lo slot Supporto'
                : 'Seleziona uno slot in campo'
    );

    // Aggiungi listener sugli slot evidenziati
    validSlots.forEach(slot => {
        slot.addEventListener('click', onSlotClick);
    });

    console.log(`🎯 Placement mode: ${card.name} (${type}) — ${validSlots.length} slot disponibili`);
};

function cancelPlacementMode() {
    if (!window.placementState) return;
    clearHighlights();
    hidePlacementHint();
    // Rimuovi listener rimasti
    window.placementState.validSlots.forEach(slot => {
        slot.removeEventListener('click', onSlotClick);
    });
    window.placementState = null;
}

// ----------------------------------------
// CLICK SU UNO SLOT EVIDENZIATO
// ----------------------------------------
function onSlotClick(e) {
    if (!window.placementState) return;

    const slot = e.currentTarget;
    const { card, handIndex } = window.placementState;
    const type = window.getCardType(card);

    clearHighlights();
    hidePlacementHint();
    window.placementState = null;

    if (window.isEquipment(type)) {
        placeEquipment(card, handIndex, slot);
    } else {
        placeUnit(card, handIndex, slot, type);
    }
}

// ----------------------------------------
// TASTO ESC cancella placement mode
// ----------------------------------------
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.placementState) {
        cancelPlacementMode();
        console.log('↩️ Placement mode annullato');
    }
});

// Click fuori dagli slot → cancella
document.addEventListener('click', (e) => {
    if (window.placementState && !e.target.closest('.slot-highlight')) return;
    const isOnSlot = e.target.closest('.slot-highlight');
    if (!isOnSlot) {
        cancelPlacementMode();
    }
}, true);

// ----------------------------------------
// POSIZIONA UNITÀ
// ----------------------------------------
function placeUnit(card, handIndex, slot, type) {
    const gs = window.GameState;

    // Validazioni extra
    if (type === 'bosses') {
        if (hasBossInField()) { alert('❌ Già 1 Boss in campo!'); return; }
        if (!checkTribute(card)) { alert('❌ Tributo Boss mancato!'); return; }
    }

    if (type === 'spirits' && !hasAllyClass()) {
        alert('❌ Le Lacrime richiedono una Classe alleata in campo!');
        return;
    }

    // Rimuovi dalla mano
    gs.playerHand.splice(handIndex, 1);

    // Posiziona nello slot
    slot.innerHTML = createCardImage(card, false);
    slot.dataset.card = JSON.stringify(card);
    slot.dataset.cardType = type;

    if (!window.isSupportNPC(card, type)) {
        gs.hasSummonedThisTurn = true;
    }

    window.renderHand('player');
    console.log(`✅ ${card.name} (${type}) posizionata in campo`);
}

// ----------------------------------------
// POSIZIONA EQUIPAGGIAMENTO
// ----------------------------------------
function placeEquipment(itemCard, handIndex, classSlot) {
    const gs = window.GameState;

    // Controlla tipo conflitto e manda al "cimitero" se stesso tipo
    const existingEquipStr = classSlot.dataset.equip;
    if (existingEquipStr) {
        const existing = JSON.parse(existingEquipStr);
        if (window.getCardType(existing) === window.getCardType(itemCard)) {
            sendToMotherTree(existing);
        }
    }

    // Registra equip sullo slot
    let equips = [];

    if (classSlot.dataset.equip) {
        equips = JSON.parse(classSlot.dataset.equip);
    }

    // Rimuovi equip stesso tipo
    equips = equips.filter(e =>
        window.getCardType(e) !== window.getCardType(itemCard)
    );

    // Aggiungi nuovo
    equips.push(itemCard);

    classSlot.dataset.equip = JSON.stringify(equips);

    // Overlay visuale equip (piccola card sovrapposta)
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
// SUMMON ENTRY POINT (chiamato da renderHand)
// ----------------------------------------
window.trySummon = function (card, handIndex) {
    const gs = window.GameState;

    if (gs.currentPhase !== 2 || gs.turnOwner !== 'player') {
        alert('❌ Puoi schierare solo nella Fase di Schieramento!');
        return;
    }

    const type = window.getCardType(card);

    // Equip: non conta come "summon" del turno
    if (window.isEquipment(type)) {
        window.enterPlacementMode(card, handIndex);
        return;
    }

    // Unità: 1 sola per turno (combattimento + supporto separati)
    if (!window.isSupportNPC(card, type)) {
        // Unità da combattimento
        if (gs.hasSummonedThisTurn) {
            alert('❌ Puoi schierare solo 1 combattente per turno!');
            return;
        }
    }
    // Nota: support NPC non consuma il summon del turno

    window.enterPlacementMode(card, handIndex);
};

document.addEventListener("mouseover", (e) => {
    const cardSlot = e.target.closest("[data-card]");
    if (!cardSlot) return;

    // evita trigger multipli sui figli interni
    if (cardSlot.contains(e.relatedTarget)) return;

    const wrapper = cardSlot.querySelector(".card-wrapper");
    if (!wrapper || wrapper.classList.contains("flipped")) return;

    const cardData = JSON.parse(cardSlot.dataset.card);

    showCardInfo(cardData, cardSlot);
});

function showCardInfo(cardData, cardElement){
    hideCardInfo();

    showSidePanel(cardData, cardElement);
    showTopPreview(cardData);
}

document.addEventListener("mouseout", (e) => {
    const cardSlot = e.target.closest("[data-card]");
    if (!cardSlot) return;

    // se stai ancora andando su un figlio della stessa carta, non chiudere
    if (cardSlot.contains(e.relatedTarget)) return;

    const isOverPreview =
        e.relatedTarget?.closest("#card-hover-panel") ||
        e.relatedTarget?.closest("#card-preview-top");

    if (isOverPreview) return;

    hideCardInfo();
});

function showSidePanel(card, element){
    const panel = document.getElementById("card-hover-panel");
    panel.classList.add("hiddenn");

    const computed = computeCardStats(card, element);

    panel.innerHTML = `
        <h3>${card.name}</h3>
        <hr>

        ${computed.hp ? `<p>HP: ${computed.hp}</p>` : ""}
        ${computed.mana ? `<p>Mana: ${computed.mana}</p>` : ""}
        ${computed.stamina ? `<p>Stamina: ${computed.stamina}</p>` : ""}
        ${computed.lightAtk ? `<p>Light: ${computed.lightAtk}</p>` : ""}
        ${computed.heavyAtk ? `<p>Heavy: ${computed.heavyAtk}</p>` : ""}
        ${computed.charges ? `<p>Charges: ${computed.charges}</p>` : ""}
    `;

    const rect = element.getBoundingClientRect();

    panel.style.left = `${rect.right + 10}px`;
    panel.style.top = `${rect.top + window.scrollY}px`;
    panel.classList.remove("hiddenn");
}

function showTopPreview(card){
    const panel = document.getElementById("card-preview-top");
    panel.classList.add("hiddenn");

    const passivesHtml = (card.passives && card.passives.length > 0)
            ? card.passives.map(p => `
        <div class="flex justify-between">
            <span>${p.type}</span>
            <span class="opacity-70">${p.amount}%</span>
        </div>
    `).join("")
            : `<div class="opacity-40">None</div>`;

    panel.innerHTML = `
        <img src="${card.img}" />

        <div style="flex:1;color:white;">
            <h2>${card.name}</h2>
            <p>${card.desc || "No description"}</p>
            <p style="opacity:0.7; text-style:italic;">
                ${card.gamedesc || ""}
            </p>
            <div>${passivesHtml}</div>
        </div>
    `;

    panel.classList.remove("hiddenn");
}

function hideCardInfo(){
    hideSidePanel();
    const topPanel = document.getElementById("card-preview-top");
    if (topPanel) topPanel.classList.add("hiddenn");
}

function hideSidePanel(){
    const panel = document.getElementById("card-hover-panel");
    if (panel) panel.classList.add("hiddenn");
}

function computeCardStats(card, element){
    const type = window.getCardType(card);

    let stats = {};

    if(type === "classes"){
        // stats.hp = calculateClassHP(card);
        // stats.mana = calculateMana(card);
        // stats.stamina = calculateStamina(card);
        // stats.lightAtk = calculateLightAttack(card, element);
        // stats.heavyAtk = calculateHeavyAttack(card, element);
        stats.hp = "";
        stats.mana = "";
        stats.stamina = "";
        stats.lightAtk = "";
        stats.heavyAtk = "";
    }

    else if(type === "bosses" || type === "npcs" || type === "creatures"){
        stats.hp = card.hp;
    }

    else if(type === "weapons"){
        // stats.lightAtk = totalWeaponDamage(card);
        stats.lightAtk = "";
    }

    else if(type === "sorceries" || type === "incantations"){
        stats.mana = card.fpcost;
        stats.lightAtk = card.attack;
    }

    return stats;
}

function hideEquipPreview() {
    const existing = document.getElementById('equip-preview');
    if (existing) existing.remove();
}

document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.slot.battle')) {
        hideEquipPreview();
    }
});

// ----------------------------------------
// DRAG & DROP
// ----------------------------------------
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
    const gs = window.GameState;
    if (gs.currentPhase !== 2 || gs.turnOwner !== 'player') return;

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
        const { card, index } = JSON.parse(raw);
        // In drop mode, proviamo lo slot target diretto
        const targetSlot = e.target.closest('.slot.battle, .slot.support');
        if (targetSlot) {
            dropOnSlot(card, index, targetSlot);
        } else {
            window.trySummon(card, index);
        }
    } catch (err) {
        console.error('Drop error:', err);
    }
});

function dropOnSlot(card, handIndex, slot) {
    const gs = window.GameState;
    const type = window.getCardType(card);

    // Verifica che lo slot sia valido per questo tipo di carta
    const validSlots = getValidSlots(card);
    if (!validSlots.includes(slot)) {
        alert('❌ Slot non valido per questa carta!');
        return;
    }

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
            position: fixed; bottom: 90px; left: 50%;
            transform: translateX(-50%);
            background: rgba(237,215,171,0.9);
            color: #1a1a1a; padding: 10px 24px;
            border-radius: 20px; font-weight: bold;
            font-family: 'Cinzel', sans-serif;
            font-size: 1em; z-index: 5000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            pointer-events: none;
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
    mt.innerHTML = createCardImage(cardData, false);
    mt.dataset.card = JSON.stringify(cardData);
    console.log('📦 Carta → Albero Madre:', cardData.name);
}

// createCardImage richiede turn-manager.js caricato prima
function createCardImage(cardData, showBack = false) {
    if (window.createCardImage && window.createCardImage !== createCardImage) {
        return window.createCardImage(cardData, showBack);
    }
    const id = cardData.id;
    const front = `static/src/cards/front/${id}.png`;
    const back = `static/src/cards/back/back.png`;
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