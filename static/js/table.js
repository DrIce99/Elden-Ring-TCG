const table = document.getElementById('game-table');

console.log('DECK_DATA:', DECK_DATA);
console.log('player-deck:', document.getElementById('player-deck'));

function setRandomLocation() {
    const locations = [
        '1.png',
        '2.png',
        '3.png',
        '4.png',
        '5.png',
        '6.png',
        '7.png',
        '8.png',
        '9.png',
        '10.png',
        '11.png',
        '12.png',
        '13.png',
        '14.png',
        '15.png',
        '16.png',
        '17.png',
        '18.png',
        '19.png',
        '20.png',
        '21.png',
        '22.png'
    ];

    const randomIndex = Math.floor(Math.random() * locations.length);
    const selectedBg = locations[randomIndex];

    const table = document.getElementById('game-table');
    if (table) {
        table.style.backgroundImage = `url('static/src/locations/${selectedBg}')`;
    }
}

// Esegui al caricamento
window.onload = setRandomLocation;

function renderDeck(cards = [], container = null) {
    const deckContainer = container || document.getElementById('player-deck');
    console.log('Rendering deck:', cards?.length || 0, 'cards in', deckContainer?.id || 'custom');

    if (!deckContainer) {
        console.error("❌ Deck container NON trovato!");
        return;
    }
    if (!cards || cards.length === 0) {
        deckContainer.innerHTML = '<div class="text-white text-xl">Mazzo Vuoto</div>';
        return;
    }

    deckContainer.innerHTML = '';
    cards.forEach((cardData, i) => {
        console.log(`Carta ${i}:`, cardData.name);

        const html = createCardImage(cardData, true);

        const cardElement = document.createElement('div');
        cardElement.innerHTML = html;
        cardElement.dataset.card = JSON.stringify(cardData);

        // Effetto pila
        const offset = i * 2;
        cardElement.style.position = 'absolute';
        cardElement.style.left = `50%`;
        cardElement.style.top = `50%`;
        cardElement.style.zIndex = i;
        cardElement.style.transform = `translate(-50%, -50%) rotate(${i * 2}deg)`;

        deckContainer.appendChild(cardElement);
    });
}

// function createCardImage(cardData) {
//     const id = cardData.id;

//     const front = `static/src/cards/front/${id}.png`;
//     const back = `static/src/cards/back/back.png`;

//     return `
//         <div class="card-wrapper balatro-card flipped">
//             <div class="card-inner">
//                 <div class="card face front">
//                     <div class="w-full h-full relative overflow-visible">
//                         <img src="${front}" 
//                             class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
//                                     max-w-none max-h-none scale-125">
//                     </div>
//                 </div>
//                 <div class="card face back">
//                     <div class="w-full h-full relative overflow-visible">
//                         <img src="${back}" 
//                             class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
//                                     max-w-none max-h-none scale-125">
//                     </div>
//                 </div>
//             </div>
//         </div>
//     `;
// }

// CHIAMATA ALLA FUNZIONE
document.addEventListener('DOMContentLoaded', () => {
    
    setTimeout(() => {
        if (window.GameState) {
            renderDeck(DECK_DATA);  
            renderDeck([...DECK_DATA].reverse(), document.querySelector('.slot.deck.enemy'));  
            window.drawCards(5, 'player');
            window.drawCards(5, 'opponent');
            window.updatePhaseDisplay();
            console.log('🎮 Gioco pronto - Ora nextPhase funziona!');
        }
    }, 100);
});

let selectedCard = null;
let selectedCardData = null;

let selected = false;

// Event delegation per tutte le carte
document.addEventListener('click', (e) => {
    if (!selected) {
        selected = true;
        const cardWrapper = e.target.closest('.card-wrapper');
        if (!cardWrapper || cardWrapper.closest('.deck-card-wrapper')) return;  // Escludi mazzo

        // Seleziona nuova carta
        const cardDataStr = cardWrapper.closest('.slot')?.dataset.card ||
            cardWrapper.closest('.hand-card-wrapper')?.dataset.card;

        if (cardDataStr) {
            selectedCardData = JSON.parse(cardDataStr);
            showPreview(selectedCardData, cardWrapper);
        }
    } else {
        closePreview();
        const cardWrapper = e.target.closest('.card-wrapper');
        if (!cardWrapper || cardWrapper.closest('.deck-card-wrapper')) return;

        const oldCardData = selectedCardData;
        const cardDataStr = cardWrapper.closest('.slot')?.dataset.card ||
            cardWrapper.closest('.hand-card-wrapper')?.dataset.card;

        if (cardDataStr) {
            if (oldCardData !== JSON.parse(cardDataStr)) {
                selectedCardData = JSON.parse(cardDataStr);
                showPreview(selectedCardData, cardWrapper);
            }
        } else {
            selected = false;
        }
    }
});


function showPreview(cardData, cardElement) {
    // Rimuovi selected da precedente
    document.querySelectorAll('.card-wrapper.selected').forEach(el =>
        el.classList.remove('selected'));

    // Aggiungi selected
    cardElement.classList.add('selected');
    selectedCard = cardElement;

    // Popola preview
    document.getElementById('preview-img').src = `static/src/cards/front/${cardData.id}.png`;
    document.getElementById('preview-name').textContent = cardData.name || 'Sconosciuta';
    document.getElementById('preview-desc').textContent = cardData.description || '';

    const statsDiv = document.getElementById('preview-stats');
    statsDiv.innerHTML = '';

    // Stats dinamiche dal JSON
    ['hp', 'atk', 'def', 'speed', 'cost'].forEach(stat => {
        if (cardData[stat]) {
            const badge = document.createElement('div');
            badge.className = 'stat-badge';
            badge.innerHTML = `<strong>${stat.toUpperCase()}:</strong> ${cardData[stat]}`;
            statsDiv.appendChild(badge);
        }
    });

    document.getElementById('card-preview').style.display = 'flex';
}

function closePreview() {
    document.getElementById('card-preview').style.display = 'none';
    if (selectedCard) {
        selectedCard.classList.remove('selected');
        selectedCard = null;
        selectedCardData = null;
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
        const cardElement = document.createElement('div');
        cardElement.className = 'hand-card-wrapper';
        cardElement.draggable = true;
        cardElement.dataset.card = JSON.stringify(card);

        cardElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                card,
                index
            }));
        });

        if (card.category?.includes('weapon') || card.category?.includes('armor')) {
            // Drag solo su slot con Classi
            const validSlots = [...document.querySelectorAll('.slot.battle')]
                .filter(slot => {
                    if (!slot.dataset.card) return false;
                    const data = JSON.parse(slot.dataset.card);
                    return data.type === 'class';
                });
        }

        const html = createCardImage(card, target === 'opponent');
        cardElement.innerHTML = html;


        // Click per schierare
        cardElement.addEventListener('click', () => {
            if (GameState.currentPhase === 2 && GameState.turnOwner === 'player' && target === 'player') {
                trySummon(card, index);
            }
        });

        container.appendChild(cardElement);
    });
}

document.querySelectorAll('.slot.battle, .slot.support').forEach(slot => {
    slot.addEventListener('dragover', e => e.preventDefault());
    slot.addEventListener('drop', e => {
        if (GameState.currentPhase !== 2 || GameState.turnOwner !== 'player') return;
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        trySummon(data.card, data.index);
    });
});

// Chiudi con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePreview();
});

window.renderHand = renderHand;