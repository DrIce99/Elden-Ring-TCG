class Card {
    constructor(data) {
        this.data = data;
    }

    renderExtended() {
        return `
        <div class="glass rounded-xl p-6 flex gap-4">
            <img src="${this.data.img}" class="w-32 h-32 object-contain">
            <div>
                <h2 class="text-xl font-bold">${this.data.name}</h2>
                <p class="text-sm opacity-70">${this.data.description || ''}</p>
            </div>
        </div>`;
    }

    renderCard() {
        return `
        <div class="card-item glass rounded-xl p-4 border border-white/10 hover:scale-105 transition">
            <img src="${this.data.img}" class="w-full h-32 object-contain mb-2">
            <h3 class="text-sm font-bold">${this.data.name}</h3>
            <p class="text-xs opacity-60">${this.data.banner || ''}</p>
        </div>`;
    }
}

let currentView = "extended";

function renderItems() {
    const container = document.getElementById("itemsContainer");

    if (currentView === "card") {
        container.className = "grid grid-cols-2 md:grid-cols-4 gap-4";
    } else {
        container.className = "space-y-6";
    }

    container.innerHTML = ITEMS.map(item => {
        const card = new Card(item);
        return currentView === "card"
            ? card.renderCard()
            : card.renderExtended();
    }).join("");
}

function setView(view) {
    currentView = view;
    renderItems();
}

document.addEventListener("DOMContentLoaded", renderItems);

class WeaponCard extends Card { }
class CharacterCard extends Card { }

function createCard(data) {
    if (data.category === "weapons") return new WeaponCard(data);
    if (data.category === "characters") return new CharacterCard(data);
    return new Card(data);
}