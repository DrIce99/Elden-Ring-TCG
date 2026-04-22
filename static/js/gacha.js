// GLOBALI
let allCards = [];
let userPity = { legendary: 0, epic: 0 };
let userRunes = 10000;
let selectedBanner = null;
let selectedPrice = 0;

const RARITY_COLORS = {
    "Leg": "#ffd700",
    "Epi": "#ff69b4", 
    "Rar": "#00bfff",
    "Unc": "#90ee90",
    "Com": "#ccc"
};

// 🔑 CARICA DATI ALL'AVVIO
async function loadGameData() {
    try {
        // Carte
        const cardsRes = await fetch('/api/cards');
        allCards = await cardsRes.json();
        
        // User data
        const userRes = await fetch('/api/user/runes');
        const userData = await userRes.json();
        userRunes = userData.runes;
        userPity = userData.pity;
        
        updateRunesUI();
        updatePityUI();
        console.log('✅ Dati caricati:', {cards: allCards.length, runes: userRunes, pity: userPity});
    } catch (e) {
        console.error('Errore caricamento dati:', e);
    }
}

function updateRunesUI() {
    const runeEl = document.getElementById('userRunes');
    if (runeEl) runeEl.textContent = userRunes.toLocaleString();
}

function updatePityUI() {
    const legBar = document.getElementById('legPityBar');
    const epiBar = document.getElementById('epiPityBar');
    const legText = document.getElementById('legPityText');
    const epiText = document.getElementById('epiPityText');
    
    if (legBar) legBar.style.width = `${Math.min(userPity.legendary / 80 * 100, 100)}%`;
    if (epiBar) epiBar.style.width = `${Math.min(userPity.epic / 20 * 100, 100)}%`;
    if (legText) legText.textContent = `${userPity.legendary} / 80`;
    if (epiText) epiText.textContent = `${userPity.epic} / 20`;
    
    // Highlight hard pity
    if (userPity.legendary >= 70) document.body.classList.add('pity-warning');
    else document.body.classList.remove('pity-warning');
}

// 🎯 PRINCIPALI FUNZIONI GACHA
function openBanner(name, price, img) {
    selectedBanner = name;
    selectedPrice = price;
    document.getElementById("bannerName").textContent = name;
    document.getElementById("bannerPrice").textContent = price.toLocaleString();
    document.getElementById("bannerImg").src = img;
    document.getElementById("bannerModal").classList.remove("hidden");
    updatePityUI();
}

async function buyAndSummon() {
    if (!selectedBanner) return alert('Seleziona un banner');
    if (userRunes < selectedPrice) return alert(`Rune insufficienti!\nNecessarie: ${selectedPrice.toLocaleString()}\nDisponibili: ${userRunes.toLocaleString()}`);

    try {
        document.querySelector('.gacha-btn').textContent = 'SUMMONING...';
        
        const res = await fetch("/api/summon", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({banner: selectedBanner, cost: selectedPrice})
        });

        const data = await res.json();

        if (!data.success) {
            alert(data.message);
            return;
        }

        // ✅ AGGIORNA TUTTO
        userRunes = data.runes_remaining;
        userPity = { legendary: 0, epic: 0 }; // Backend aggiorna pity
        
        updateRunesUI();
        updatePityUI();
        
        // Animazione
        playPackOpenAnimation(data.pack);
        closeBanner();
        
    } catch (error) {
        console.error('Summon error:', error);
        alert('Errore server. Controlla console.');
    } finally {
        document.querySelector('.gacha-btn').textContent = 'SUMMON ×5';
    }
}

function closeBanner() {
    document.getElementById("bannerModal").classList.add("hidden");
    selectedBanner = null;
    selectedPrice = 0;
}

// ANIMAZIONI (usa quelle esistenti)
function playPackOpenAnimation(pack) {
    const container = document.getElementById("pack-animation") || createAnimationContainer();

    container.innerHTML = `
        <div class="pack-opening">
            <div class="pack-box">
                PACK
            </div>
        </div>
    `;

    setTimeout(() => {
        showPackAnimation(pack);
    }, 1400);
}

function createAnimationContainer() {
    const container = document.createElement('div');
    container.id = 'pack-animation';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.8);';
    document.body.appendChild(container);
    return container;
}

function showPackAnimation(pack) {
    const container = document.getElementById("pack-animation");

    container.innerHTML = `
        <div id="cardRevealContainer">
            <div id="stack"></div>
        </div>
    `;

    const stack = document.getElementById("stack");

    // crea stack sovrapposto
    pack.forEach((card, i) => {
        const div = document.createElement("div");
        div.className = "reward-card";
        div.dataset.index = i;

        // usa immagine reale carta
        div.innerHTML = `
            <img src="/static/src/cards/front/${card.id}.png"
                 onerror="this.src='${card.img}'">
        `;

        // effetto sovrapposto
        div.style.zIndex = pack.length - i;
        div.style.transform = `translateY(${i * 5}px) scale(${1 - i * 0.03})`;

        stack.appendChild(div);
    });

    let currentIndex = 0;
    const cards = document.querySelectorAll(".reward-card");

    cards.forEach((cardEl, index) => {
        cardEl.addEventListener("click", () => {
            if (index !== currentIndex) return;

            // slide via
            cardEl.style.pointerEvents = "none";

            const baseTransform = cardEl.style.transform;

            cardEl.style.transform = `
                ${baseTransform}
                translateX(-120vw)
                rotate(-15deg)
            `;

            cardEl.style.opacity = "0";

            currentIndex++;

            // ultima carta -> mostra recap
            if (currentIndex >= pack.length) {
                setTimeout(() => {
                    showFinalResults(pack);
                }, 700);
            }
        });
    });
}

function showFinalResults(pack) {
    const container = document.getElementById("pack-animation");

    container.innerHTML = `
        <div class="final-results">
            <h2>Summon Results</h2>
            <div class="results-grid"></div>
            <button class="close-results" onclick="closeResults()">
                Continue
            </button>
        </div>
    `;

    const grid = container.querySelector(".results-grid");

    pack.forEach(card => {
        const div = document.createElement("div");
        div.className = "result-card";

        div.innerHTML = `
            <img src="/static/src/cards/front/${card.id}.png"
                 onerror="this.src='${card.img}'">
        `;

        grid.appendChild(div);
    });
}

function closeResults() {
    const container = document.getElementById("pack-animation");

    if (container) {
        container.remove();
    }
}

// INIT
document.addEventListener('DOMContentLoaded', loadGameData);