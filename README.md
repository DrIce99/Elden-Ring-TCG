## 🛡️ Elden Ring TCG
Un gioco di carte tattico e collezionabile (Gacha) basato sull'universo di Elden Ring. Colleziona boss, potenzia le tue classi e sfida altri Senzaluce in combattimenti strategici basati sul posizionamento e sulla gestione delle Rune.
## 📌 Visione del Progetto
Il gioco si divide in due anime:

   1. Gacha & Management: Un sistema di "Album" dove collezionare carte tramite Banner che ciclano, livellare l'equipaggiamento e buildare deck ottimizzati sfruttando i duplicati per lo "Star Up".
   2. Tactical Combat: Uno scontro 1v1 su un campo di battaglia a slot, dove le azioni vengono pianificate contemporaneamente e risolte in una fase di "Resa dei Conti".
   3. Ladder/Casual: si può giocare online in partite casuali/amichevoli (non si perde o guadagna rune) o ladder/competitive (ogni vittoria conferisce tot. coppe e ogni sconfitta sottrae tot coppe.)
   4. La competitiva è suddivisa in arene in base al numero di coppe (non si può scendere sotto l'arena "checkpoint")

------------------------------
## 🎮 Meccaniche di Gioco (Gameplay)## Setup della Partita

* Scommessa iniziale: I giocatori mettono in palio un numero di Rune (max 75% del patrimonio del giocatore più povero). La media delle scommesse diventa l'HP del Player.
* Lancio della Moneta: Marika o Radagon decide chi inizia.
* Mano Iniziale: 5 carte a testa.

## Il Campo di Battaglia
Ogni giocatore dispone di:

* 5 Slot "Campo di Battaglia" per i combattenti.
* 1 Slot Supporto (NPC non combattenti con abilità passive).
* 1 Slot Mazzo.
* 1 Slot Albero Madre (Cimitero: dove finiscono le carte sconfitte o gli equipaggiamenti sostituiti).

## Struttura del Turno

   1. Fase 1 (Pesca): Si pescano 2 carte.
   2. Fase 2 (Schieramento): Si può evocare max 1 combattente per turno (max 1 Boss in campo) e gestire gli equipaggiamenti (Armi, Armature, Talismani, Incantesimi).
   3. Fase 3 (Pianificazione): Si selezionano le azioni per ogni unità (Movimento, Schivata, Attacchi Leggeri/Pesanti, Magie, Riposo, Recupero HP/MP). Le azioni non vengono eseguite subito.
   4. Fase 4 (Turno Avversario): L'avversario esegue le sue fasi 1-3.
   5. Fase 5 (Resa dei Conti): Tutte le azioni si attivano simultaneamente.

------------------------------
## 🛠️ Roadmap di Sviluppo

## To Do List (Core Engine)

* Data Mapping: Suddivisione dei dati JSON per aree geografiche (partendo da Limgrave).
* Stat Scaling: Associare HP, Armature e Armi agli NPC (Dati da Fextralife).
* Rarity System: Assegnazione rarità a ogni elemento (Comune ➡️ Leggendario).
* Move-set Engine: Implementazione tipi di attacco, percentuali di successo e raggio d'azione (Singolo/Area).
* Role Separation: Dividere NPC Combattenti da NPC Support.

## Versioni e Milestone

* v1.0.0 (Limgrave Edition): Solo zona 1, attacchi base, niente scudi o armi a distanza.
* v1.1.0 (Pressure Update): Introduzione dei timer per il turno.
* v1.5.0 (Stamina & Shields): Aggiunta scudi (parata 100% con riduzione danno) e sistema Stamina.
* v1.6.0 (Range Update): Introduzione archi e armi a distanza.
* v2.0.0 (The Lands Between): Ash of War e abilità speciali.

------------------------------
## 🧬 Note Tecniche per i Developer

* Scalabilità ID: La nomenclatura degli ID segue lo schema [ID_OGGETTO][ID_CATEGORIA] per facilitare l'aggiunta modulare di nuovi contenuti.
* Sincronizzazione: Gli attacchi melee colpiscono solo le 3 caselle più vicine.
* Economia delle Rune: Uccidere una carta nemica conferisce "Loot" (Rune dirette al player), mentre i colpi ai danni del giocatore sottraggono le "Rune in palio".
* Lacrime: Non possono agire da sole, devono avere una classe in campo.
* Lacrima Riflessa: Eredita le statistiche dalla classe più forte in campo.

## Info json:

* All:
    - (Binario) *dupl*: può essere un duplicato
    - (Binario) *find*: può essere trovato nei banner
* Positionable cards:
    - (Binario) *support*: è di tipo support
* Items:
    - (Binario) *consumable*: è un consumabile
* Locations:
    - (Binario) *check*: checkpoint sotto al quale non si può scendere di arena