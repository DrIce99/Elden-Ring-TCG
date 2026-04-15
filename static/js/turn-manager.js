// Stub per funzioni mancanti
function checkTribute(card) { return true; }  // Da implementare
function updateBattlefield() { return Array(5).fill(null); }  // Stub
function saveAction(slot, action) { console.log('Azione:', action); }  // Stub

// Rendi GameState globale
window.GameState = {
    currentPhase: 0, turnOwner: 'player', hasSummonedThisTurn: false,
    playerHand: [], opponentHand: [], playerRunes: 20, opponentRunes: 20,
    playerBattlefield: Array(5).fill(null), playerSupport: null,
    opponentBattlefield: Array(5).fill(null), opponentSupport: null,
    phases: [
        { id: 1, name: "Pesca (2 carte)" }, { id: 2, name: "Schieramento" },
        { id: 3, name: "Pianificazione" }, { id: 4, name: "Turno Avversario" },
        { id: 5, name: "Resa dei Conti" }
    ],
    checkWinCondition() {
        const playerLost = this.playerRunes <= 0 || (this.playerHand.length === 0 && window.DECK_DATA?.length === 0);
        const opponentLost = this.opponentRunes <= 0 || (this.opponentHand.length === 0 && window.OPPONENT_DECK_DATA?.length === 0);
        if (playerLost) return alert("Hai perso! Rune finite.");
        if (opponentLost) return alert("Hai vinto!");
        return false;
    }
};

// Funzione drawCards corretta (usa window.DECK_DATA)
function drawCards(count, target = 'player') {
    const deck = target === 'player' ? PLAYER_DECK_DATA : OPPONENT_DECK_DATA;
    const handKey = target === 'player' ? 'playerHand' : 'opponentHand';
    
    if (!deck || !Array.isArray(deck)) {
        console.error('❌ DECK non valido:', deck);
        return;
    }
    
    const hand = window.GameState[handKey];
    for (let i = 0; i < count; i++) {
        if (deck.length === 0) break;
        const cardData = deck.pop();
        hand.push(cardData);
    }
    window.renderHand(target);
    console.log(`✅ Pescate ${count} carte per ${target} - Mano: ${hand.length}`);
}

function getCardTypeFromId(cardId) {
    const idNum = String(cardId).slice(-2);  // Ultime 2 cifre
    const typeMap = {
        '01': 'ammos', '02': 'armors', '03': 'ashes', '04': 'bosses',
        '05': 'classes', '06': 'creatures', '07': 'gloves', '08': 'helmets',
        '09': 'incantations', '10': 'items', '11': 'leg_armors', '12': 'locations',
        '13': 'npcs', '14': 'shields', '15': 'sorceries', '16': 'spirits',
        '17': 'talismans', '18': 'weapons'
    };
    return typeMap[idNum] || 'unknown';
}

function trySummon(card, handIndex) {
    if (window.GameState.hasSummonedThisTurn) return alert("1 combattente/turno!");
    const cardType = getCardTypeFromId(card.id);
    const validTypes = ['classes', 'npcs', 'creatures', 'bosses'];
    console.log(card.type);
    if (!validTypes.includes(cardType)) return alert("Solo unità! (classes/npcs/creatures/bosses)");
    if (card.type === 'boss' && !checkTribute(card)) return alert("Tributo richiesto!");
    
    const isSupport = card.type === 'support' || card.category === 'npc';
    const slotSelector = `.player-area.player ${isSupport ? '.slot.support:empty' : '.slot.battle:empty'}`;
    const targetSlot = document.querySelector(slotSelector);
    if (!targetSlot) return alert("Slot pieno!");
    
    targetSlot.innerHTML = createCardImage(card, false);
    targetSlot.dataset.card = JSON.stringify(card);
    window.GameState.playerHand.splice(handIndex, 1);
    window.GameState.hasSummonedThisTurn = true;
    renderHand('player');
}

function updatePhaseDisplay() {
    const phaseName = window.GameState.phases[window.GameState.currentPhase - 1]?.name || 'Sconosciuta';
    const phaseEl = document.getElementById('current-phase');
    if (phaseEl) phaseEl.textContent = phaseName;
    document.getElementById('player-runes').textContent = window.GameState.playerRunes;
    document.getElementById('opponent-runes').textContent = window.GameState.opponentRunes;
    document.body.classList.toggle('player-turn', window.GameState.turnOwner === 'player');
}

function nextPhase() {
    window.GameState.currentPhase++;
    if (window.GameState.currentPhase > 5) {
        window.GameState.currentPhase = 1;
        window.GameState.hasSummonedThisTurn = false;
        window.GameState.turnOwner = window.GameState.turnOwner === 'player' ? 'opponent' : 'player';
        
        // Pesca SEMPRE 2 carte per player all'inizio del suo turno
        if (window.GameState.turnOwner === 'player') {
            drawCards(2, 'player');
        }
    } else if (window.GameState.currentPhase === 1 && window.GameState.turnOwner === 'player') {
        // Pesca extra solo se phase=1 E player turn (primo ciclo)
        drawCards(2, 'player');
    }
    updatePhaseDisplay();
    window.GameState.checkWinCondition();
}

function createCardImage(cardData, showBack = false) {
    const id = cardData.id;
    const front = `static/src/cards/front/${id}.png`;
    const back = `static/src/cards/back/back.png`;
    return `
        <div class="card-wrapper balatro-card ${showBack ? 'flipped' : ''}">
            <div class="card-inner">
                <div class="card face front">
                    <img src="${front}" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/300x400?text=${id}'">
                </div>
                <div class="card face back">
                    <img src="${back}" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/300x400?text=BACK'">
                </div>
            </div>
        </div>`;
}

// Inizializza al caricamento
document.addEventListener('DOMContentLoaded', () => {
    updatePhaseDisplay();
});