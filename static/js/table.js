const table = document.getElementById('game-table');

console.log('DECK_DATA:', window.DECK_DATA);
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

        // Effetto pila
        const offset = i * 2;
        cardElement.style.position = 'absolute';
        cardElement.style.bottom = `${offset}px`;
        cardElement.style.right = `${offset}px`;
        cardElement.style.zIndex = i;
        cardElement.style.transform.scale = 0.45;

        deckContainer.appendChild(cardElement);
    });
}

function createCardImage(cardData) {
    const id = cardData.id;

    const front = `static/src/cards/front/${id}.png`;
    const back = `static/src/cards/back/back.png`;

    return `
        <div class="card-wrapper balatro-card flipped">
            <div class="card-inner">
                <div class="card face front">
                    <div class="w-full h-full relative overflow-visible">
                        <img src="${front}" 
                            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                                    max-w-none max-h-none scale-125">
                    </div>
                </div>
                <div class="card face back">
                    <div class="w-full h-full relative overflow-visible">
                        <img src="${back}" 
                            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                                    max-w-none max-h-none scale-125">
                    </div>
                </div>
            </div>
        </div>
    `;
}

// CHIAMATA ALLA FUNZIONE
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inizializzazione gioco...');
    renderDeck(DECK_DATA);  // Player deck
    renderDeck(OPPONENT_DECK_DATA, document.querySelector('.slot.deck.enemy'));  // Enemy deck
    drawCards(5, 'player');
    drawCards(5, 'opponent');
    updatePhaseDisplay();  // Aggiungi visuale fase
});