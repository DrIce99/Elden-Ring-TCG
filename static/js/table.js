// ========================================
// TABLE.JS — Rendering, UI, Preview, Init
// ========================================

// ----------------------------------------
// BACKGROUND CASUALE
// ----------------------------------------
function setRandomLocation() {
    const count = 22;
    const randomIndex = Math.floor(Math.random() * count) + 1;
    const table = document.getElementById('game-table');
    if (table) {
        table.style.backgroundImage = `url('static/src/locations/${randomIndex}.png')`;
    }
}
window.onload = setRandomLocation;

// ----------------------------------------
// RENDER MAZZO (pile visuale)
// ----------------------------------------
window.renderDeck = function (cards = [], containerSelector = null) {
    let deckContainer;
    if (typeof containerSelector === 'string') {
        deckContainer = document.querySelector(containerSelector);
    } else {
        deckContainer = containerSelector;
    }

    if (!deckContainer) {
        console.error('❌ Deck container not found:', containerSelector);
        return;
    }

    deckContainer.innerHTML = '';

    if (!cards || cards.length === 0) {
        deckContainer.innerHTML = '<div style="color:#edd7ab;font-size:0.8em;text-align:center;padding-top:80px;">Vuoto</div>';
        return;
    }

    // Mostra MAX 8 carte per performance (effetto pila)
    const visible = cards.slice(-Math.min(cards.length, 8));

    visible.forEach((cardData, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'deck-card-wrapper';
        wrapper.dataset.card = JSON.stringify(cardData);

        wrapper.innerHTML = window.createCardImage
            ? window.createCardImage(cardData, true)
            : `<div class="card-wrapper balatro-card flipped"><div class="card-inner">
                   <div class="card face back"><img src="static/src/cards/back/back.png"
                   style="width:100%;height:100%;object-fit:contain"></div>
               </div></div>`;

        // Offset per effetto pila
        const rotation = (i - visible.length / 2) * 1.5;
        const offsetX = (i - visible.length / 2) * 1;
        const offsetY = -(i * 1.5);

        wrapper.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))
                       rotate(${rotation}deg);
            z-index: ${i};
            width: 140px;
            height: 200px;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        // Solo l'ultima carta (top) è cliccabile
        if (i === visible.length - 1) {
            wrapper.style.cursor = 'pointer';
            wrapper.style.pointerEvents = 'auto';
            wrapper.title = `${cards.length} cards`;
        } else {
            wrapper.style.pointerEvents = 'none';
        }

        deckContainer.appendChild(wrapper);
    });
};

// ----------------------------------------
// RENDER MANO
// ----------------------------------------
window.renderHand = function (target) {
    const containerId = target === 'player' ? 'player-hand' : 'opponent-hand';
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const hand = target === 'player'
        ? window.GameState.playerHand
        : window.GameState.opponentHand;

    const totalCards = hand.length;

    hand.forEach((card, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'hand-card-wrapper';
        wrapper.draggable = true;
        wrapper.dataset.card = JSON.stringify(card);

        // Ventaglio: ruota le carte
        let fanAngle = totalCards > 1
            ? ((index / (totalCards - 1)) - 0.5) * Math.min(totalCards * 5, 30)
            : 0;

        if (target === 'opponent') {
            fanAngle *= -1;
        }
        const fanY = Math.abs(fanAngle) * 1.2;

        wrapper.style.cssText = `
            transform: rotate(${fanAngle}deg) translateY(${fanY}px);
            transform-origin: bottom center;
            margin-left: ${index === 0 ? '0' : '-30px'};
            transition: transform 0.2s ease, margin 0.2s ease;
            z-index: ${index};
        `;

        wrapper.addEventListener('mouseenter', () => {
            wrapper.style.transform = `rotate(${fanAngle}deg) translateY(-20px) scale(1.08)`;
            wrapper.style.zIndex = 500;
        });
        wrapper.addEventListener('mouseleave', () => {
            wrapper.style.transform = `rotate(${fanAngle}deg) translateY(${fanY}px)`;
            wrapper.style.zIndex = index;
        });

        // Drag & drop
        wrapper.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ card, index }));
        });

        // Render carta (avversario: coperta)
        wrapper.innerHTML = window.createCardImage
            ? window.createCardImage(card, target === 'opponent')
            : `<div class="card-wrapper balatro-card"><div class="card-inner"><div class="card face front">
                   <img src="static/src/cards/front/${card.id}.png"
                        style="width:100%;height:100%;object-fit:contain">
               </div></div></div>`;

        if (target === 'opponent') {
            const inner = wrapper.querySelector('.card-inner');
            if (inner) {
                inner.style.transform = 'rotate(180deg)';
            }
        }

        // Click: schiera in fase 2
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.GameState.currentPhase === 2 &&
                window.GameState.turnOwner === 'player' &&
                target === 'player') {
                window.trySummon(card, index);
            }
        });

        container.appendChild(wrapper);
    });
};

// ----------------------------------------
// PREVIEW CARTA
// ----------------------------------------
let selectedCardEl = null;
let selectedCardData = null;
let previewOpen = false;

/**
 * Mostra il pannello preview per una carta.
 * @param {object} cardData  - dati della carta
 * @param {HTMLElement} containerEl - wrapper cliccato (hand-card-wrapper o .card-wrapper)
 */
function showPreview(cardData, containerEl) {
    // Rimuovi selezione precedente
    document.querySelectorAll('.card-wrapper.selected')
        .forEach(el => el.classList.remove('selected'));
 
    // Trova il vero .card-wrapper per evidenziarlo (potrebbe essere containerEl stesso
    // oppure un figlio se containerEl è un hand-card-wrapper / slot)
    const cardWrapper = containerEl.classList.contains('card-wrapper')
        ? containerEl
        : containerEl.querySelector('.card-wrapper');
 
    if (cardWrapper) cardWrapper.classList.add('selected');
 
    selectedCardEl = cardWrapper || containerEl;
    selectedCardData = cardData;
    previewOpen = true;
 
    const previewEl = document.getElementById('card-preview');
    if (!previewEl) return;
 
    const imgEl = document.getElementById('preview-img');
    const nameEl = document.getElementById('preview-name');
    const descEl = document.getElementById('preview-desc');
    const statsDiv = document.getElementById('preview-stats');
 
    if (imgEl) imgEl.src = `static/src/cards/front/${cardData.id}.png`;
    if (nameEl) nameEl.textContent = cardData.name || 'Sconosciuta';
    if (descEl) descEl.textContent = cardData.description || '';
 
    if (statsDiv) {
        statsDiv.innerHTML = '';
        ['hp', 'atk', 'def', 'speed', 'cost', 'fp'].forEach(stat => {
            if (cardData[stat] !== undefined && cardData[stat] !== null) {
                const badge = document.createElement('div');
                badge.className = 'stat-badge';
                badge.innerHTML = `<strong>${stat.toUpperCase()}:</strong> ${cardData[stat]}`;
                statsDiv.appendChild(badge);
            }
        });
    }
 
    previewEl.style.display = 'flex';
}

// ----------------------------------------
// INIT — Avvia il gioco
// ----------------------------------------
let _gameInitialized = false;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 table.js caricato, avvio inizializzazione...');

    // Aspetta che tutti gli script siano caricati
    const tryInit = () => {
        if (_gameInitialized) return; // guard
 
        if (!window.GameState || !window.playerDeck || !window.opponentDeck) {
            setTimeout(tryInit, 100);
            return;
        }

        _gameInitialized = true;

        // Render mazzi
        window.renderDeck(window.playerDeck, '#player-deck');
        window.renderDeck(window.opponentDeck, '.slot.deck.enemy');

        // Distribuisci mani iniziali
        window.drawnThisTurn = 0;
        window.initHands();

        // Inizia fase 1
        window.GameState.currentPhase = 1;
        window.GameState.hasSummonedThisTurn = false;
        window.updatePhaseDisplay();

        // Nascondi bottone fase (fase 1 = pesca manuale)
        const phaseBtn = document.querySelector('.phase-button');
        if (phaseBtn) phaseBtn.classList.add('hidden');

        console.log('✅ Gioco inizializzato — clicca il mazzo per pescare!');
    };

    setTimeout(tryInit, 200);
});

window.animateCardToHand = function(cardData, target, onComplete) {
    const deckSelector = target === 'player'
        ? '#player-deck'
        : '.slot.deck.enemy';

    const handSelector = target === 'player'
        ? '#player-hand'
        : '#opponent-hand';

    const deckEl = document.querySelector(deckSelector);
    const handEl = document.querySelector(handSelector);

    if (!deckEl || !handEl) {
        onComplete();
        return;
    }

    const deckRect = deckEl.getBoundingClientRect();
    const handRect = handEl.getBoundingClientRect();

    const flyCard = document.createElement('div');
    flyCard.className = 'fly-card';

    flyCard.innerHTML = window.createCardImage(cardData, true);

    document.body.appendChild(flyCard);

    gsap.set(flyCard, {
        position: "fixed",
        width: 140,
        height: 200,
        left: deckRect.left,
        top: deckRect.top,
        zIndex: 9999
    });

    gsap.to(flyCard, {
        left: handRect.left + handRect.width / 2,
        top: handRect.top,
        rotation: gsap.utils.random(-20, 20),
        scale: 0.8,
        duration: 0.7,
        ease: "power3.out",
        onComplete: () => {
            flyCard.remove();
            onComplete();
        }
    });
};

window.animateCardToBattlefield = function(cardEl, slotEl, callback) {
    const cardRect = cardEl.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();

    const clone = cardEl.cloneNode(true);
    document.body.appendChild(clone);

    gsap.set(clone, {
        position: "fixed",
        left: cardRect.left,
        top: cardRect.top,
        width: cardRect.width,
        height: cardRect.height,
        zIndex: 9999
    });

    gsap.to(clone, {
        left: slotRect.left,
        top: slotRect.top,
        duration: 0.6,
        ease: "power2.out",
        scale: 1.05,
        onComplete: () => {
            clone.remove();
            callback();
        }
    });
};

window.animateAttack = function(attackerEl, targetEl, callback) {
    const attackerRect = attackerEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    gsap.to(attackerEl, {
        x: targetRect.left - attackerRect.left,
        y: targetRect.top - attackerRect.top,
        duration: 0.25,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
        onComplete: callback
    });
};

window.animateDestroyCard = function(cardEl, callback) {
    gsap.to(cardEl, {
        scale: 0,
        rotation: 180,
        opacity: 0,
        duration: 0.5,
        ease: "back.in",
        onComplete: () => {
            cardEl.remove();
            callback?.();
        }
    });
};

// Esponi renderHand globalmente
window.renderHand = window.renderHand || function () { };