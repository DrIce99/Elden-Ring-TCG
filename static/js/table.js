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
        console.error('❌ Deck container non trovato:', containerSelector);
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
            wrapper.title = `${cards.length} carte nel mazzo — clicca per pescare`;
        } else {
            wrapper.style.pointerEvents = 'none';
        }

        deckContainer.appendChild(wrapper);
    });

    // Badge contatore
    let badge = deckContainer.querySelector('.deck-count-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'deck-count-badge';
        badge.style.cssText = `
            position: absolute; bottom: -30px; left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #edd7ab;
            font-size: 0.75em;
            padding: 2px 8px;
            border-radius: 10px;
            border: 1px solid #edd7ab55;
            pointer-events: none;
            white-space: nowrap;
        `;
        deckContainer.appendChild(badge);
    }
    badge.textContent = `${cards.length} carte`;
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

        wrapper.addEventListener('mouseenter', () => {
            if (window.placementState) return;

            showPreview(card, wrapper);
        });

        wrapper.addEventListener('mouseleave', () => {
            if (!previewOpen) return;
            window.closePreview();
        });
    });
};

// ----------------------------------------
// PREVIEW CARTA
// ----------------------------------------
let selectedCardEl = null;
let selectedCardData = null;
let previewOpen = false;

function showPreview(cardData, cardElement) {
    document.querySelectorAll('.card-wrapper.selected')
        .forEach(el => el.classList.remove('selected'));

    cardElement.classList.add('selected');
    selectedCardEl = cardElement;
    selectedCardData = cardData;
    previewOpen = true;

    const previewEl = document.getElementById('card-preview');
    if (!previewEl) return;

    document.getElementById('preview-img').src =
        `static/src/cards/front/${cardData.id}.png`;
    document.getElementById('preview-name').textContent = cardData.name || 'Sconosciuta';
    document.getElementById('preview-desc').textContent = cardData.description || '';

    const statsDiv = document.getElementById('preview-stats');
    statsDiv.innerHTML = '';

    ['hp', 'atk', 'def', 'speed', 'cost', 'fp'].forEach(stat => {
        if (cardData[stat] !== undefined && cardData[stat] !== null) {
            const badge = document.createElement('div');
            badge.className = 'stat-badge';
            badge.innerHTML = `<strong>${stat.toUpperCase()}:</strong> ${cardData[stat]}`;
            statsDiv.appendChild(badge);
        }
    });

    previewEl.style.display = 'flex';
}

window.closePreview = function () {
    const previewEl = document.getElementById('card-preview');
    if (previewEl) previewEl.style.display = 'none';

    if (selectedCardEl) {
        selectedCardEl.classList.remove('selected');
        selectedCardEl = null;
        selectedCardData = null;
    }
    previewOpen = false;
};

// Click su carta per preview (delegato)
document.addEventListener('click', (e) => {
    // Ignora se siamo in placement mode
    if (window.placementState) return;  // nota: placementState è privato in game_rules, va esposto
    if (e.target.closest('.slot')) return;
    // Ignora se click su bottone fase o hint
    if (e.target.closest('.phase-button, #placement-hint, #card-preview')) return;

    const cardWrapper = e.target.closest('.card-wrapper');

    // Click fuori da qualsiasi carta → chiudi preview
    if (!cardWrapper) {
        if (previewOpen) window.closePreview();
        return;
    }

    // Escludi carte nel mazzo
    if (cardWrapper.closest('.deck-card-wrapper')) return;

    // Cerca il dato della carta
    const source = cardWrapper.closest('.slot') ||
        cardWrapper.closest('.hand-card-wrapper');
    const cardDataStr = source?.dataset.card;

    if (!cardDataStr) return;

    try {
        const cardData = JSON.parse(cardDataStr);

        if (previewOpen && selectedCardData?.id === cardData.id) {
            // Stessa carta → chiudi
            window.closePreview();
        } else {
            if (previewOpen) window.closePreview();
            showPreview(cardData, cardWrapper);
        }
    } catch (err) {
        console.error('Preview error:', err);
    }
});

// ESC chiude preview
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.closePreview();
    }
});

// ----------------------------------------
// INIT — Avvia il gioco
// ----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 table.js caricato, avvio inizializzazione...');

    // Aspetta che tutti gli script siano caricati
    const tryInit = () => {
        if (!window.GameState || !window.playerDeck || !window.opponentDeck) {
            setTimeout(tryInit, 100);
            return;
        }

        // Render mazzi
        window.renderDeck(window.playerDeck, '#player-deck');
        window.renderDeck(window.opponentDeck, '.slot.deck.enemy');

        // Distribuisci mani iniziali
        window.initHands();

        // Inizia fase 1
        window.GameState.currentPhase = 1;
        window.drawnThisTurn = 0;
        window.updatePhaseDisplay();

        // Nascondi bottone fase (fase 1 = pesca manuale)
        const phaseBtn = document.querySelector('.phase-button');
        if (phaseBtn) phaseBtn.classList.add('hidden');

        console.log('✅ Gioco inizializzato — clicca il mazzo per pescare!');
    };

    setTimeout(tryInit, 200);
});

// Esponi renderHand globalmente
window.renderHand = window.renderHand || function () { };