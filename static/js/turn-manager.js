// ========================================
// TURN MANAGER — Gestione fasi e pesca
// ========================================

// Stub per funzioni mancanti
function checkTribute(card) { return true; }
function saveAction(slot, action) { console.log('Azione:', action); }

// ----------------------------------------
// GAME STATE
// ----------------------------------------
window.GameState = {
    currentPhase: 0,
    turnOwner: 'player',
    hasSummonedThisTurn: false,
    playerHand: [],
    opponentHand: [],
    playerRunes: 20,
    opponentRunes: 20,
    playerBattlefield: Array(5).fill(null),
    playerSupport: null,
    opponentBattlefield: Array(5).fill(null),
    opponentSupport: null,
    phases: [
        { id: 1, name: "Pesca (clicca il mazzo)" },
        { id: 2, name: "Schieramento" },
        { id: 3, name: "Pianificazione" },
        { id: 4, name: "Turno Avversario" },
        { id: 5, name: "Resa dei Conti" }
    ],
    checkWinCondition() {
        const playerLost = this.playerRunes <= 0 ||
            (this.playerHand.length === 0 && window.playerDeck?.length === 0);
        const opponentLost = this.opponentRunes <= 0 ||
            (this.opponentHand.length === 0 && window.opponentDeck?.length === 0);
        if (playerLost) { alert("No more Runes — YOU LOST!"); return true; }
        if (opponentLost) { alert("YOU WON!"); return true; }
        return false;
    }
};

// ----------------------------------------
// DRAW — variabili di stato
// ----------------------------------------
const DRAW_PER_TURN = 2;
window.drawnThisTurn = 0;
window.isDrawing = false; // lock anti-doppio click

// ----------------------------------------
// PESCA SINGOLA CON ANIMAZIONE
// ----------------------------------------
window.drawOneCard = function (target = 'player') {
    if (window.isDrawing) return; // previeni click rapidi

    const deck = target === 'player' ? window.playerDeck : window.opponentDeck;
    if (!deck || deck.length === 0) {
        window.GameState.checkWinCondition();
        return;
    }

    window.isDrawing = true;

    const cardData = deck.pop(); // top card (ultima)

    // Aggiorna visuale mazzo SUBITO (prima dell'animazione)
    renderDeck(
        deck,
        target === 'player' ? '#player-deck' : '.slot.deck.enemy'
    );

    // Avvia animazione, poi aggiungi alla mano
    animateCardToHand(cardData, target, () => {
        const handKey = target === 'player' ? 'playerHand' : 'opponentHand';
        window.GameState[handKey].push(cardData);
        window.renderHand(target);
        window.isDrawing = false;

        // Emetti evento DRAW sull'event bus (se disponibile)
        if (window.EffectBus) {
            window.EffectBus.emit(window.EVENTS?.DRAW, {
                target,
                card: cardData,
                gameState: window.GameState
            });
        }

        if (target === window.GameState.turnOwner) {
            window.drawnThisTurn++;
            updatePhaseDisplay(); // aggiorna label

            if (window.drawnThisTurn >= DRAW_PER_TURN) {
                // Tutte le carte pescate → avanza automaticamente
                setTimeout(() => advanceToNextPhase(), 400);
            }
        }
    });
};

// ----------------------------------------
// ANIMAZIONE: carta vola dal mazzo alla mano
// ----------------------------------------
function animateCardToHand(cardData, target, onComplete) {
    const deckSelector = target === 'player' ? '#player-deck' : '.slot.deck.enemy';
    const handSelector = target === 'player' ? '#player-hand' : '#opponent-hand';

    const deckEl = document.querySelector(deckSelector);
    const handEl = document.querySelector(handSelector);

    if (!deckEl || !handEl) {
        onComplete();
        return;
    }

    const deckRect = deckEl.getBoundingClientRect();
    const handRect = handEl.getBoundingClientRect();

    // Crea la carta animata
    const flyCard = document.createElement('div');
    flyCard.className = 'card-wrapper balatro-card fly-card';
    flyCard.innerHTML = `
        <div class="card-inner">
            <div class="card face back">
                <img src="static/src/cards/back/back.png"
                     style="width:100%;height:100%;object-fit:contain"
                     onerror="this.src='https://placehold.co/140x200?text=BACK'">
            </div>
        </div>`;

    // Partenza: centro dello slot mazzo
    const startX = deckRect.left + deckRect.width / 2 - 70;
    const startY = deckRect.top + deckRect.height / 2 - 100;

    // Arrivo: centro della zona mano
    const endX = handRect.left + handRect.width / 2 - 70;
    const endY = target === 'player'
        ? handRect.top + 10
        : handRect.bottom - 210;

    flyCard.style.cssText = `
        position: fixed;
        width: 140px;
        height: 200px;
        left: ${startX}px;
        top: ${startY}px;
        z-index: 9999;
        pointer-events: none;
        transition: left 0.55s cubic-bezier(0.22,1,0.36,1),
                    top  0.55s cubic-bezier(0.22,1,0.36,1),
                    transform 0.55s ease;
        transform: scale(1.1) rotate(${Math.random() * 10 - 5}deg);
    `;

    document.body.appendChild(flyCard);

    // Forza reflow poi anima
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            flyCard.style.left = `${endX}px`;
            flyCard.style.top = `${endY}px`;
            flyCard.style.transform = 'scale(0.85) rotate(0deg)';
        });
    });

    setTimeout(() => {
        flyCard.remove();
        onComplete();
    }, 600);
}

// ----------------------------------------
// PESCA INIZIALE (5 carte senza animazione, per velocità)
// ----------------------------------------
window.initHands = function () {
    // Previeni doppia chiamata accidentale
    if (window._handsDealt) return;
    window._handsDealt = true;

    const drawSilent = (target, count) => {
        const deck = target === 'player' ? window.playerDeck : window.opponentDeck;
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

    if (gs.currentPhase > 5) {
        // Nuovo turno
        gs.currentPhase = 1;
        gs.hasSummonedThisTurn = false;
        gs.turnOwner = gs.turnOwner === 'player' ? 'opponent' : 'player';
        window.drawnThisTurn = 0;

        // Emetti TURN_START
        if (window.EffectBus) {
            window.EffectBus.emit(window.EVENTS?.TURN_START, {
                turnOwner: gs.turnOwner,
                gameState: gs
            });
        }
    }

    // Emetti eventi di fase
    if (window.EffectBus && window.EVENTS) {
        const phaseEvents = {
            3: window.EVENTS.BEFORE_ACTION,
            4: window.EVENTS.AFTER_ACTION,
            5: window.EVENTS.RESOLUTION_START
        };
        if (phaseEvents[gs.currentPhase]) {
            window.EffectBus.emit(phaseEvents[gs.currentPhase], { gameState: gs });
        }
        if (gs.currentPhase === 5) {
            setTimeout(() => {
                window.EffectBus.emit(window.EVENTS.RESOLUTION_END, { gameState: gs });
            }, 2000);
        }
    }

    updatePhaseDisplay();
    gs.checkWinCondition();

    const phaseBtn = document.querySelector('.phase-button');

    if (gs.currentPhase === 1) {
        // Fase pesca: nascondi bottone, aspetta click sul mazzo
        if (phaseBtn) phaseBtn.classList.add('hidden');
        if (gs.turnOwner === 'opponent') {
            setTimeout(() => {
                window.drawOneCard('opponent');
            }, 300);
        }
    } else {
        // Altre fasi: mostra bottone
        if (phaseBtn) phaseBtn.classList.remove('hidden');

        // Emetti TURN_END quando si arriva alla fase 5
        if (gs.currentPhase === 5 && window.EffectBus) {
            window.EffectBus.emit(window.EVENTS?.TURN_END, { gameState: gs });
        }
    }

    console.log(`📍 Fase ${gs.currentPhase} — ${gs.phases[gs.currentPhase - 1]?.name}`);
};

// Alias per compatibilità col bottone HTML
window.nextPhaseAuto = window.advanceToNextPhase;

// ----------------------------------------
// HUD
// ----------------------------------------
window.updatePhaseDisplay = function () {
    const gs = window.GameState;
    const phaseName = gs.phases[gs.currentPhase - 1]?.name || '—';

    let label = phaseName;
    if (gs.currentPhase === 1 && gs.turnOwner === 'player') {
        const remaining = DRAW_PER_TURN - window.drawnThisTurn;
        label += ` — ancora ${remaining}`;
    }

    const phaseEl = document.getElementById('current-phase');
    if (phaseEl) phaseEl.textContent = label;

    const playerRunes = document.getElementById('player-runes');
    const opponentRunes = document.getElementById('opponent-runes');
    if (playerRunes) playerRunes.textContent = gs.playerRunes;
    if (opponentRunes) opponentRunes.textContent = gs.opponentRunes;

    document.body.classList.toggle('player-turn', gs.turnOwner === 'player');
};

// ----------------------------------------
// CLICK SUL MAZZO (fase pesca)
// ----------------------------------------
document.addEventListener('click', (e) => {
    const deckSlot = e.target.closest('#player-deck');
    if (!deckSlot) return;

    const gs = window.GameState;
    if (gs.currentPhase !== 1 || gs.turnOwner !== 'player') return;
    if (window.drawnThisTurn >= DRAW_PER_TURN) return;
    if (window.isDrawing) return;

    window.drawOneCard('player');
});

// ----------------------------------------
// TYPE UTILS (duplicati qui per autonomia)
// ----------------------------------------
function getCardTypeFromId(cardId) {
    const idNum = String(cardId).slice(-2);
    const typeMap = {
        '01': 'ammos', '02': 'armors', '03': 'ashes', '04': 'bosses',
        '05': 'classes', '06': 'creatures', '07': 'gloves', '08': 'helmets',
        '09': 'incantations', '10': 'items', '11': 'leg_armors', '12': 'locations',
        '13': 'npcs', '14': 'shields', '15': 'sorceries', '16': 'spirits',
        '17': 'talismans', '18': 'weapons'
    };
    return typeMap[idNum] || 'unknown';
}

// ----------------------------------------
// CARD IMAGE HELPER
// ----------------------------------------
window.createCardImage = function (cardData, showBack = false) {
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
};

// ----------------------------------------
// INIT
// ----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    updatePhaseDisplay();
});