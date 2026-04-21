/**
 * ELDEN RING TCG — Deck Rules
 * Centralizza le regole del mazzo: limiti di copie per rarità o per carta specifica.
 * Modifica questi valori per bilanciare il gioco.
 */

const DECK_RULES = {

    /** Numero massimo di carte in un mazzo */
    MAX_DECK_SIZE: 40,

    /** Copie massime di default (se la carta non ha una regola specifica) */
    DEFAULT_MAX_COPIES: 2,

    /**
     * Limite di copie per rarità.
     * Chiave = codice rarità usato nel JSON (es. "Com", "Unc", "Rar", "Epi", "Leg")
     * Valore = numero massimo di copie consentite in mazzo
     */
    RARITY_LIMITS: {
        "Com": 3,   // Comune      → fino a 3 copie
        "Unc": 3,   // Non comune  → fino a 3 copie
        "Rar": 2,   // Raro        → fino a 2 copie
        "Epi": 2,   // Epico       → fino a 2 copie
        "Leg": 1    // Leggendario → 1 sola copia
    },

    /**
     * Limite per SINGOLA CARTA (sovrascrive il limite di rarità).
     * Chiave = id della carta (come stringa), Valore = max copie.
     * Esempio: carta "42" è Rara ma unica in assoluto → 1 copia.
     *
     * Aggiungi qui eccezioni specifiche per bilanciamento.
     */
    CARD_OVERRIDES: {
        "213": 1
        // "7":  3,
    },

    /**
     * Categorie di carte che non possono essere inserite nel mazzo.
     * Utile per escludere carte "boss" o decorative.
     */
    BANNED_CATEGORIES: [
        // "bosses"
    ],

    // ──────────────────────────────────────────────────────────────
    //  METODI DI UTILITÀ
    // ──────────────────────────────────────────────────────────────

    /**
     * Restituisce il numero massimo di copie consentite per una carta.
     * @param {Object} card - Oggetto carta con proprietà `id`, `rarity`, `category`
     * @returns {number}
     */
    getMaxCopies(card) {
        const id = String(card.id);

        // 1. Override specifico per carta
        if (Object.prototype.hasOwnProperty.call(this.CARD_OVERRIDES, id)) {
            return this.CARD_OVERRIDES[id];
        }

        // 2. Limite per rarità
        const rarity = card.rarity || "";
        if (Object.prototype.hasOwnProperty.call(this.RARITY_LIMITS, rarity)) {
            return this.RARITY_LIMITS[rarity];
        }

        // 3. Default
        return this.DEFAULT_MAX_COPIES;
    },

    /**
     * Controlla se una carta può essere aggiunta al mazzo dato.
     * @param {Object} card - Carta da aggiungere
     * @param {Array}  deckCards - Array degli oggetti {id, count} nel mazzo corrente
     * @param {number} currentTotal - Totale carte nel mazzo
     * @returns {{ allowed: boolean, reason: string }}
     */
    canAdd(card, deckCards, currentTotal) {
        // Categoria bannata
        if (this.BANNED_CATEGORIES.includes(card.category)) {
            return { allowed: false, reason: `"${card.category}" cards are not allowed in the deck.` };
        }

        // Mazzo pieno
        if (currentTotal >= this.MAX_DECK_SIZE) {
            return { allowed: false, reason: `Deck is full (max ${this.MAX_DECK_SIZE} cards).` };
        }

        // Copie già presenti
        const existing = deckCards.find(c => String(c.id) === String(card.id));
        const currentCount = existing ? existing.count : 0;
        const maxCopies = this.getMaxCopies(card);

        if (currentCount >= maxCopies) {
            return {
                allowed: false,
                reason: `You can add max ${maxCopies} cop${maxCopies === 1 ? "y" : "ies"} of "${card.name}".`
            };
        }

        return { allowed: true, reason: "" };
    },

    /**
     * Etichetta testuale per la rarità.
     * @param {string} rarity
     * @returns {string}
     */
    rarityLabel(rarity) {
        const labels = {
            "Com": "Common",
            "Unc": "Uncommon",
            "Rar": "Rare",
            "Epi": "Epic",
            "Leg": "Legendary"
        };
        return labels[rarity] || rarity || "—";
    },

    /**
     * Colore CSS associato alla rarità (per badge/bordi).
     * @param {string} rarity
     * @returns {string}
     */
    rarityColor(rarity) {
        const colors = {
            "Com":  "#9ca3af",   // grigio
            "Unc":  "#34d399",   // verde
            "Rar":  "#60a5fa",   // blu
            "Epi":  "#a78bfa",   // viola
            "Leg":  "#fbbf24"    // oro
        };
        return colors[rarity] || "#9ca3af";
    }
};

// Rende disponibile come modulo (se usato con bundler) o come globale
if (typeof module !== "undefined") {
    module.exports = DECK_RULES;
}