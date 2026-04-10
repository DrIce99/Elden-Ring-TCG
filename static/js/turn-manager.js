const GameState = {
    currentPhase: 1, // 1: Pesca, 2: Schieramento, 3: Pianificazione...
    turnOwner: 'player', // 'player' o 'opponent'
    hasSummonedThisTurn: false,
    playerHand: [],
    opponentHand: [],
    
    // Configurazione fasi
    phases: [
        { id: 1, name: "Pesca" },
        { id: 2, name: "Schieramento" },
        { id: 3, name: "Pianificazione" },
        { id: 4, name: "Turno Avversario" },
        { id: 5, name: "Resa dei Conti" }
    ]
};

// Funzione per pescare (Sposta dal mazzo alla mano)
function drawCards(count, target = 'player') {
    for (let i = 0; i < count; i++) {
        const cardData = (target === 'player') ? DECK_DATA.pop() : OPPONENT_DECK_DATA.pop();
        if (!cardData) break;

        if (target === 'player') GameState.playerHand.push(cardData);
        else GameState.opponentHand.push(cardData);

        renderHand(target);
    }
}

// Renderizzazione della mano
function renderHand(target) {
    const containerId = target === 'player' ? 'player-hand' : 'opponent-hand';
    let container = document.getElementById(containerId);
    
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const hand = target === 'player' ? GameState.playerHand : GameState.opponentHand;

    hand.forEach((card, index) => {
        const cardObj = new Card(card);
        const cardElement = document.createElement('div');
        cardElement.className = 'hand-card-wrapper';
        
        // Se è avversario, mostra il retro. Se è player, mostra il fronte.
        const html = (card.atk || card.attacks) ? cardObj.renderWeapon() : cardObj.renderCharacter();
        cardElement.innerHTML = html;
        
        if (target === 'opponent') {
            cardElement.querySelector('.card-wrapper').classList.add('flipped');
        }

        // Click per schierare (Solo se fase 2 e turno player)
        cardElement.addEventListener('click', () => {
            if (GameState.currentPhase === 2 && GameState.turnOwner === 'player' && target === 'player') {
                trySummon(card, index);
            }
        });

        container.appendChild(cardElement);
    });
}

// Logica di Schieramento
function trySummon(card, handIndex) {
    if (GameState.hasSummonedThisTurn) {
        alert("Puoi evocare solo un combattente per turno!");
        return;
    }
    if (card.atk || card.category?.toLowerCase().includes('weapon')) {
        alert("Le armi devono essere equipaggiate!");
        return;
    }

    const isSupport = card.type === 'support' || card.category === 'NPC';
    const slotSelector = `.player-area.player ${isSupport ? '.slot.support' : '.slot.battle'}:empty`;
    const targetSlot = document.querySelector(slotSelector);

    if (!targetSlot) {
        alert(`Nessuno slot ${isSupport ? 'supporto' : 'battaglia'} libero!`);
        return;
    }

    // Evoca!
    const cardObj = new Card(card);
    targetSlot.innerHTML = cardObj.renderCharacter();
    targetSlot.dataset.card = JSON.stringify(card);  // Salva dati per future interazioni

    GameState.playerHand.splice(handIndex, 1);
    GameState.hasSummonedThisTurn = true;
    renderHand('player');
    console.log('Evocato:', card.name);
}

function updatePhaseDisplay() {
    const phaseName = GameState.phases[GameState.currentPhase - 1]?.name || 'Sconosciuta';
    document.getElementById('current-phase').textContent = phaseName;
    document.querySelector('.phase-button').textContent = 
        GameState.currentPhase > 4 ? 'Nuovo Turno' : 'Prossima Fase';
}

function nextPhase() {
    GameState.currentPhase++;
    if (GameState.currentPhase > 5) {
        GameState.currentPhase = 1;
        GameState.hasSummonedThisTurn = false;
        GameState.turnOwner = GameState.turnOwner === 'player' ? 'opponent' : 'player';
    }
    updatePhaseDisplay();
    console.log(`Fase: ${GameState.phases[GameState.currentPhase - 1].name} | Turno: ${GameState.turnOwner}`);
}