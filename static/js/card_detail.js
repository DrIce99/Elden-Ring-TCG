let currentType = 'character';

class Card {
    constructor(data) {
        this.data = data || {};
    }

    renderWeapon() {
        // FIX: Se l'immagine manca, usa un placeholder
        const imageSrc = (this.data.img && this.data.img !== "")
            ? this.data.img
            : "https://placehold.co";

        const typeColors = {
            "Phy": "border-gray-500",
            "Mag": "border-blue-500",
            "Fire": "border-red-600",
            "Ligt": "border-yellow-400",
            "Holy": "border-yellow-100"
        };

        const atk = this.data.attack || [];
        const def = this.data.defence || [];

        const getStat = (list, name) => {
            const item = list.find(i => i.name.toLowerCase().startsWith(name.toLowerCase()));
            return item ? item.amount : "0";
        };

        const statsTypes = ["Phy", "Mag", "Fire", "Ligt", "Holy"];

        // 2. Logica attributi (Str, Dex, Int, Fth, Arc)
        const attributes = ["Str", "Dex", "Int", "Fai", "Arc"];
        const scaling = this.data.scalesWith || [];
        const required = this.data.requiredAttributes || [];

        let range = "";
        if (this.data.range == 1) {
            range = "Single";
        } else if (this.data.range == 2) {
            range = "Area";
        } else {
            range = "Ranged";
        }

        const rarityClass = `rarity-${this.data.rarity || "common"}`;

        let cardType = "";
        if (this.data.id % 100 == 18) {
            cardType = "WEAPON";
        } else if (this.data.id % 100 == 14) {
            cardType = "SHIELD";
        }

        const passivesHtml = (this.data.passives && this.data.passives.length > 0)
            ? this.data.passives.map(p => `
        <div class="flex justify-between">
            <span>${p.type}</span>
            <span class="opacity-70">${p.amount}%</span>
        </div>
    `).join("")
            : `<div class="opacity-40">None</div>`;

        const attributeSlotsHtml = attributes.map(attr => {
            const s = scaling.find(i => i.name.startsWith(attr))?.scaling || "-";
            const r = required.find(i => i.name.startsWith(attr))?.amount || "-";
            return `
        <div class="flex-1 border border-[#edd7ab]/40 rounded-lg p-1 flex flex-col items-center justify-center bg-[#1c1b1b]" style="width:60px; height:80px; margin:8px; pointer-events: none;">
            <div class="text-[14px] text-[#edd7ab] font-bold">${attr.toUpperCase()}</div>
            <div class="text-[16px] text-white font-bold">${s}</div>
            <div class="text-[12px] opacity-40">${r}</div>
        </div>`;
        }).join("");
        return `
    <div class="card-wrapper balatro-card">
        <div class="card-inner">

            <!-- FRONT -->
            <div class="card face front relative ${rarityClass}" style="overflow: visible !important;">
                <div class="attributes-container">
                    <div class="flex-column gap-10 mb-4">
                        ${attributeSlotsHtml}
                    </div>
                </div>
                    <!-- 5 Slot Attributi -->
                <div class="card-content">

                    <!-- CORNER -->
                    <div class="corner top left"></div>
                    <div class="corner top right"></div>
                    <div class="corner bottom left"></div>
                    <div class="corner bottom right"></div>

                    <div class="corner top1 left1"></div>
                    <div class="corner top1 right1"></div>
                    <div class="corner bottom1 left1"></div>
                    <div class="corner bottom1 right1"></div>

                    <div class="middle hor left"></div>
                    <div class="middle hor right"></div>
        
                    <!-- HEADER: Category a SX, AtkType a DX -->
                    <div class="mb-2 px-1 topprpr" style="display: grid;grid-template-columns: 1fr auto 1fr;align-items: center;width: 100%; grid-gap: 20px;">
                        <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="text-align:center;">
                            ${this.data.category || '-'}
                        </div>
                        <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm" style="text-align: center;">
                            ${cardType}    
                        </div>
                        <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="text-align:center;">
                            ${this.data.atktype || '-'}
                        </div>
                    </div>

                    <!-- SEZIONE CENTRALE (Atk | Immagine | Def) -->
                    <div class="flex gap-2 h-64 mb-1">
                        <!-- Colonna ATK con bordi colorati -->
                        <div class="w-1/5 flex flex-col gap-1">
                            <div class="text-center text-[10px] font-bold opacity-50 uppercase">Atk</div>
                            ${statsTypes.map(t => `<div class="bg-[#1c1b1b] border-l-4 ${typeColors[t]} rounded-r h-7 flex items-center justify-center text-[10px]">${getStat(atk, t)}</div>`).join('')}
                            <div class="bg-white/10 rounded h-5 flex items-center justify-center text-[9px] mt-10">W: ${this.data.weight || '-'}</div>
                            </div>

                        <!-- Immagine -->
                        <div class="flex-1 bg-[#d1d1d109] rounded-2xl overflow-hidden border border-white/10">
                            <img src="${imageSrc}" class="w-full h-full object-contain p-4">
                        </div>

                        <!-- Colonna DEF con bordi colorati -->
                        <div class="w-1/5 flex flex-col gap-1">
                            <div class="text-center text-[10px] font-bold opacity-50 uppercase">Def</div>
                            ${statsTypes.map(t => `<div class="bg-[#1c1b1b] border-r-4 ${typeColors[t]} rounded-l h-7 flex items-center justify-center text-[10px]">${getStat(def, t)}</div>`).join('')}
                            <div class="bg-white/10 rounded h-5 flex items-center justify-center text-[9px] mt-10">R: ${range || '-'}</div>
                        </div>
                    </div>

                    <!-- Barra Grigia (Weight e Range) -->
                    <div class="flex gap-2 mb-4 px-1" style="top:-20px;">
                        
                        <div class="flex-1"></div>
                        
                    </div>

                    <!-- NOME -->
                    <div class="relative">
                        <div class="name-banner flex items-center justify-center">
                            <h2 class="text-2xl font-bold text-center py-1 tracking-wide uppercase">${this.data.name}</h2>
                        </div>
                    </div>

                    <!-- Game Description -->
                    <div class="ninepatch">
                        <div class="flex-1 space-y-4 px-2 overflow-y-auto">
                            <p class="text-[11px] text-white/60 italic leading-relaxed" style="text-align: justify;text-justify:inter-word;background:transparent;">${this.data.desc || '...'}</p>
                        </div>
                    </div>

                    <!-- Attacchi (Mostra Danno) -->
                    <div class="flex gap-2 mb-2">
                        <div class="flex-1 border border-[#edd7ab]/40 rounded-lg p-2 bg-[#1c1b1b]">
                            <div class="text-[7px] text-[#edd7ab] font-bold uppercase">Light Atk</div>
                            <div class="text-sm font-bold text-white">${this.data.attacks?.lightDmg || '0'}</div>
                        </div>
                        <div class="flex-1 border border-[#edd7ab]/40 rounded-lg p-2 bg-[#1c1b1b]">
                            <div class="text-[7px] text-[#edd7ab] font-bold uppercase">Heavy Atk</div>
                            <div class="text-sm font-bold text-white">${this.data.attacks?.heavyDmg || '0'}</div>
                        </div>
                    </div>

                    <!-- Passive Effects (Rettangolo Rosso) -->
                    <div class="border border-red-900/40 bg-red-950/20 rounded-lg p-2 mb-1">
                        <div class="text-[7px] text-red-400 font-bold uppercase">Passive Effects</div>
                        <div class="text-[10px] text-red-100/90">
                            ${passivesHtml}
                        </div>
                    </div>

                    <div class="flex justify-between items-end mt-4 px-1 opacity-40">
                        <div class="text-[10px]"></div>
                        <div class="text-right text-[10px]">ID: ${this.data.id}</div>
                    </div>
                </div>
            </div>
        <!-- BACK -->
            <div class="card face back">
                <img src="/static/src/page_bg_raw.jpg" class="back-img">
            </div>
        </div>
    </div>`;
    }

    renderArmor() {
        // FIX: Se l'immagine manca, usa un placeholder
        const imageSrc = (this.data.img && this.data.img !== "")
            ? this.data.img
            : "https://placehold.co";

        const dmgNegation = this.data.dmgNegation || [];

        const typeColors = {
            "Phy": "border-gray-500",
            "Strike": "border-gray-500",
            "Slash": "border-gray-500",
            "Pierce": "border-gray-500",
            "Magic": "border-blue-500",
            "Fire": "border-red-600",
            "Ligt": "border-yellow-400",
            "Holy": "border-yellow-100"
        };

        const getStat = (list, name) => {
            const item = list.find(i => i.name.toLowerCase().startsWith(name.toLowerCase()));
            return item ? item.amount : "0";
        };

        // 2. Logica attributi (Str, Dex, Int, Fth, Arc)
        const physicalTypes = ["Phy", "Strike", "Slash", "Pierce"];
        const elementalTypes = ["Magic", "Fire", "Ligt", "Holy"];

        const rarityClass = `rarity-${this.data.rarity || "common"}`;

        let cardType = "";
        if (this.data.id % 100 == 2) cardType = "CHEST";
        else if (this.data.id % 100 == 7) cardType = "GAUNTLETS";
        else if (this.data.id % 100 == 11) cardType = "LEGS";
        else if (this.data.id % 100 == 8) cardType = "HELMET";

        const passivesHtml = (this.data.passives && this.data.passives.length > 0)
            ? this.data.passives.map(p => `
        <div class="flex justify-between">
            <span>${p.type}</span>
            <span class="opacity-70">${p.amount}%</span>
        </div>
    `).join("")
            : `<div class="opacity-40">None</div>`;
        return `
    <div class="card-wrapper balatro-card">
        <div class="card-inner">

            <!-- FRONT -->
            <div class="card face front relative ${rarityClass}" style="overflow: visible !important;">
                <div class="card-content">

                    <!-- CORNER -->
                    <div class="corner top left"></div>
                    <div class="corner top right"></div>
                    <div class="corner bottom left"></div>
                    <div class="corner bottom right"></div>

                    <div class="corner top1 left1"></div>
                    <div class="corner top1 right1"></div>
                    <div class="corner bottom1 left1"></div>
                    <div class="corner bottom1 right1"></div>

                    <div class="middle hor left"></div>
                    <div class="middle hor right"></div>
        
                    <!-- HEADER: Category a SX, AtkType a DX -->
                    <div class="mb-2 px-1 topprpr" style="display: flex; align-items: center;width: 100%; justify-content:center;">
                        <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm" style="text-align: center;">
                            ${cardType}    
                        </div>
                    </div>

                    <!-- SEZIONE CENTRALE (Atk | Immagine | Def) -->
                    <div class="flex gap-2 h-64 mb-1">
                        <!-- PHYSICAL -->
                        <div class="w-1/5 flex flex-col gap-1">
                            <div class="text-center text-[10px] opacity-50">Phys</div>
                            ${physicalTypes.map(t => `
                                <div class="bg-[#1c1b1b] border-l-4 ${typeColors[t]} rounded h-7 flex items-center justify-center text-[10px]">
                                    ${t}: ${getStat(dmgNegation, t)}
                                </div>
                            `).join("")}
                            <div class="bg-white/10 rounded h-5 flex items-center justify-center text-[9px] mt-10">W: ${this.data.weight || '-'}</div>
                        </div>

                        <!-- Immagine -->
                        <div class="flex-1 bg-[#d1d1d109] rounded-2xl overflow-hidden border border-white/10">
                            <img src="${imageSrc}" class="w-full h-full object-contain p-4">
                        </div>

                        <!-- ELEMENTAL -->
                        <div class="w-1/5 flex flex-col gap-1">
                            <div class="text-center text-[10px] opacity-50">Elem</div>
                            ${elementalTypes.map(t => `
                                <div class="bg-[#1c1b1b] border-r-4 ${typeColors[t]} rounded h-7 flex items-center justify-center text-[10px]">
                                    ${t}: ${getStat(dmgNegation, t)}
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <!-- Barra Grigia (Weight e Range) -->
                    <div class="flex gap-2 mb-4 px-1" style="top:-20px;">
                        
                        <div class="flex-1"></div>
                        
                    </div>

                    <!-- NOME -->
                    <div class="relative">
                        <div class="name-banner flex items-center justify-center">
                            <h2 class="text-2xl font-bold text-center py-1 tracking-wide uppercase">${this.data.name}</h2>
                        </div>
                    </div>

                    <!-- Game Description -->
                    <div class="ninepatch">
                        <div class="flex-1 space-y-4 px-2 overflow-y-auto">
                            <p class="text-[11px] text-white/60 italic leading-relaxed" style="text-align: justify;text-justify:inter-word;background:transparent;">${this.data.desc || '...'}</p>
                        </div>
                    </div>

                    <!-- Passive Effects (Rettangolo Rosso) -->
                    <div class="border border-red-900/40 bg-red-950/20 rounded-lg p-2 mb-1">
                        <div class="text-[7px] text-red-400 font-bold uppercase">Passive Effects</div>
                        <div class="text-[10px] text-red-100/90">
                            ${passivesHtml}
                        </div>
                    </div>

                    <div class="flex justify-between items-end mt-4 px-1 opacity-40">
                        <div class="text-[10px]"></div>
                        <div class="text-right text-[10px]">ID: ${this.data.id}</div>
                    </div>
                </div>
            </div>
        <!-- BACK -->
            <div class="card face back">
                <img src="/static/src/page_bg_raw.jpg" class="back-img">
            </div>
        </div>
    </div>`;
    }

    renderCharacter() {
        // Dividiamo gli oggetti per tipo: 
        // Assumiamo che i primi 3 siano armi/item e i successivi armatura (o logica simile)
        const imageSrc = (this.data.img && this.data.img !== "")
            ? this.data.img
            : "https://placehold.co";

        const allItems = this.data.items || [];

        // Filtra slot vuoti ed evita crash se items non è un array
        const validItems = Array.isArray(allItems) ? allItems.filter(i => i.name && i.name !== "") : [];

        const leftColumn = [];
        const rightColumn = [];
        for (let i = 0; i < validItems.length; i++) {
            if (validItems[i].id % 100 == 2 || validItems[i].id % 100 == 7 || validItems[i].id % 100 == 8 || validItems[i].id % 100 == 11) {
                rightColumn.push(validItems[i]);
            } else {
                leftColumn.push(validItems[i]);
            }
        }

        // Riempie fino a 3 slot per colonna
        const fill = (arr) => {
            while (arr.length < 3) arr.push({ name: "" });
            return arr;
        };

        const type = this.data.support == 1 ? "filter: hue-rotate(108deg);" : "filter: hue-rotate(0deg);";

        const finalLeft = fill(leftColumn);
        const finalRight = fill(rightColumn);

        const rarityClass = `rarity-${this.data.rarity || "common"}`;

        let desc = "";
        if (this.data.desc != "") {
            desc = `
                    <div class="text-xs text-white/90" style="text-align: justify;text-justify:inter-word; background:transparent;">
                        ${this.data.desc || ''}
                    </div>
                    `;
        }

        const gameDesc = "";

        const cardType = "NPC";

        // Per leggendaria:
        // <div class="middle ver left"></div>
        // <div class="middle ver right"></div>

        return `
    <div class="card-wrapper balatro-card">
        <div class="card-inner">
        <div class="card face front relative ${rarityClass}">
        <div class="card-content">
            <div class="corner top left"></div>
            <div class="corner top right"></div>
            <div class="corner bottom left"></div>
            <div class="corner bottom right"></div>
            <div class="corner top1 left1"></div>
            <div class="corner top1 right1"></div>
            <div class="corner bottom1 left1"></div>
            <div class="corner bottom1 right1"></div>

            <div class="middle hor left"></div>
            <div class="middle hor right"></div>
            
            <!-- HEADER (HP e Slot Vuoto per Star-up) -->
            <div class="mb-2 px-1 topprpr" style="display: grid;grid-template-columns: 1fr auto 1fr;align-items: center;width: 100%; grid-gap: 20px;">
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="display:flex;justify-content:space-between;box-shadow:inset 0 0 30px 30px rgba(0, 0, 0, 0, 0);">
                </div>
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm" style="text-align: center;">
                    ${cardType}    
                </div>
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="text-align: right; display:flex;justify-content:space-between;">
                </div>
            </div>

            <!-- SEZIONE CENTRALE (3 Colonne) -->
            <div class="flex gap-2 h-64 mb-4" style="max-height:80%;">
                <!-- COLONNA SX: ARMI / ITEMS -->
                <div class="w-1/4 p-2 flex flex-col gap-2 ninepatchshadow">
                    ${finalLeft.map(item => item.name ?
            `<div class="text-[9px] leading-tight opacity-80 border-b border-white/5 pb-1" style="text-align:center;">${item.name}</div>` :
            `<div class="h-4 bg-white/5 rounded"></div>`).join('')}
                </div>

                <!-- CENTRO: IMMAGINE -->
                <div class="flex-1 bg-[#d1d1d109] rounded-2xl overflow-hidden shadow-inner border border-white/10">
                    <img src="${this.data.img}" class="w-full h-full object-cover">
                </div>

                <!-- COLONNA DX: ARMATURA -->
                <div class="w-1/4 p-2 flex flex-col gap-2 ninepatchshadow">
                    ${finalRight.map(item => item.name ?
                `<div class="text-[9px] leading-tight opacity-80 border-b border-white/5 pb-1" style="text-align:center;">${item.name}</div>` :
                `<div class="h-4 bg-white/5 rounded"></div>`).join('')}
                </div>
            </div>

            <!-- NOME (Incastonato tra due barre) -->
            <div class="relative">
                <div class="name-banner flex items-center justify-center" style="${type}">
                <h2 class="text-2xl font-bold text-center py-1 tracking-wide uppercase">${this.data.name}</h2>
                </div>
            </div>

            <!-- DESCRIZIONI -->
            <div class="ninepatch">
                <div class="flex-1 space-y-4 px-2 overflow-y-auto">
                    ${desc}
                    <div class="text-[11px] text-white/60 italic leading-relaxed" style="text-align: justify;text-justify:inter-word;background:transparent;">
                        ${this.data.gamedesc || ''}
                    </div>
                </div>
            </div>

            <!-- FOOTER (Loot e ID) -->
            <div class="flex justify-between items-end mt-4 px-1 opacity-40">
                <div class="flex content-between gap-1 align-middle">
                    <div class="text-[10px] align-middle" style="vertical-align:center;">Runes: ${this.data.loot || 0}</div>
                    <div><img src="https://eldenring.wiki.fextralife.com/file/Elden-Ring/runes-currency-elden-ring-wiki-guide-18.png" class="size-3"></div>
                </div>
                <div class="text-[10px]">ID: ${this.data.id}</div>
            </div>
        </div>
        </div>
        
        <div class="card face back">
            <img src="/static/src/page_bg_raw.jpg" class="back-img">
        </div>
        <div>
        </div>
    </div>
    `;
    };

    renderClass() {
        // Dividiamo gli oggetti per tipo: 
        // Assumiamo che i primi 3 siano armi/item e i successivi armatura (o logica simile)
        const imageSrc = (this.data.img && this.data.img !== "")
            ? this.data.img
            : "https://placehold.co";

        const allItems = this.data.items || [];

        // Filtra slot vuoti ed evita crash se items non è un array
        const validItems = Array.isArray(allItems) ? allItems.filter(i => i.name && i.name !== "") : [];

        const leftColumn = validItems.slice(0, 3);
        const rightColumn = validItems.slice(3, 6);

        // Riempie fino a 3 slot per colonna
        const fill = (arr) => {
            while (arr.length < 3) arr.push({ name: "" });
            return arr;
        };

        const type = this.data.support == 1 ? "filter: hue-rotate(108deg);" : "filter: hue-rotate(0deg);";

        const finalLeft = fill(leftColumn);
        const finalRight = fill(rightColumn);

        const rarityClass = `rarity-${this.data.rarity || "common"}`;

        let desc = "";
        if (this.data.desc != "") {
            desc = `
                <div class="text-xs text-white/90" style="text-align: justify;text-justify:inter-word; background:transparent;">
                    ${this.data.desc || ''}
                </div>
                `;
        }

        const gameDesc = "";

        const cardType = "Class";

        const attributes = [
            { full: "Vigor", short: "VIG" },
            { full: "Mind", short: "MND" },
            { full: "Endurance", short: "END" },
            { full: "Strength", short: "STR" },
            { full: "Dexterity", short: "DEX" },
            { full: "Intelligence", short: "INT" },
            { full: "Faith", short: "FAI" },
            { full: "Arcane", short: "ARC" }
        ];
        const stats = this.data.stats || {};

        const getStatValue = (statName) => {
            return stats[statName.toLowerCase()] || "0";
        };

        const statsHtml = attributes.map(attr => {
            const value = getStatValue(attr.full);
            return `
                        <div class="flex-1 stat border border-[#edd7ab]/40 rounded-lg p-1 flex flex-col items-center justify-center bg-[#1c1c1c]" style="width:70px; height:85px; margin:4px;">
                            <div class="text-[12px] text-[#edd7ab] font-bold">${attr.short}</div>
                            <div class="text-[18px] text-white font-bold mt-1">${value}</div>
                        </div>
                    `;
        }).join("");

        // Per leggendaria:
        // <div class="middle ver left"></div>
        // <div class="middle ver right"></div>

        return `
    <div class="card-wrapper balatro-card">
        <div class="card-inner">
        <div class="card face front relative ${rarityClass}">
            <div class="attributes-container">
                <div class="flex-column gap-10 mb-4">
                    ${statsHtml}
                </div>
            </div>
        <div class="card-content">
            <div class="corner top left"></div>
            <div class="corner top right"></div>
            <div class="corner bottom left"></div>
            <div class="corner bottom right"></div>
            <div class="corner top1 left1"></div>
            <div class="corner top1 right1"></div>
            <div class="corner bottom1 left1"></div>
            <div class="corner bottom1 right1"></div>

            <div class="middle hor left"></div>
            <div class="middle hor right"></div>

            <div class="middle ver left"></div>
            <div class="middle ver right"></div>
            
            <!-- HEADER (HP e Slot Vuoto per Star-up) -->
            <div class="mb-2 px-1 topprpr" style="display: grid;grid-template-columns: 1fr auto 1fr;align-items: center;width: 100%; grid-gap: 20px;">
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="display:flex;justify-content:space-between;box-shadow:inset 0 0 30px 30px rgba(0, 0, 0, 0, 0);">
                </div>
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm" style="text-align: center;">
                    ${cardType}    
                </div>
                <div class="bg-[#1c1b1b] px-4 py-1 text-[#edd7ab] font-bold text-sm w-30" style="text-align: right; display:flex;justify-content:space-between;">
                </div>
            </div>

            <!-- SEZIONE CENTRALE (3 Colonne) -->
            <div class="flex gap-2 h-64 mb-4" style="max-height:80%;">
                <!-- COLONNA SX: ARMI / ITEMS -->
                <div class="w-1/4 p-2 flex flex-col gap-2 ninepatchshadow">
                    ${finalLeft.map(item => item.name ?
            `<div class="text-[9px] leading-tight opacity-80 border-b border-white/5 pb-1">${item.name}</div>` :
            `<div class="h-4 bg-white/5 rounded"></div>`).join('')}
                </div>

                <!-- CENTRO: IMMAGINE -->
                <div class="flex-1 bg-[#d1d1d109] rounded-2xl overflow-hidden shadow-inner border border-white/10">
                    <img src="${this.data.img}" class="w-full h-full object-cover">
                </div>

                <!-- COLONNA DX: ARMATURA -->
                <div class="w-1/4 p-2 flex flex-col gap-2 ninepatchshadow">
                    ${finalRight.map(item => item.name ?
                `<div class="text-[9px] leading-tight opacity-80 border-b border-white/5 pb-1">${item.name}</div>` :
                `<div class="h-4 bg-white/5 rounded"></div>`).join('')}
                </div>
            </div>

            <!-- NOME (Incastonato tra due barre) -->
            <div class="relative">
                <div class="name-banner flex items-center justify-center" style="${type}">
                <h2 class="text-2xl font-bold text-center py-1 tracking-wide uppercase">${this.data.name}</h2>
                </div>
            </div>

            <!-- DESCRIZIONI -->
            <div class="ninepatch">
                <div class="flex-1 space-y-4 px-2 overflow-y-auto">
                    ${desc}
                    <div class="text-[11px] text-white/60 italic leading-relaxed" style="text-align: justify;text-justify:inter-word;background:transparent;">
                        ${this.data.gamedesc || ''}
                    </div>
                </div>
            </div>

            <!-- FOOTER (Loot e ID) -->
            <div class="flex justify-between items-end mt-4 px-1 opacity-40">
                <div class="flex content-between gap-1 align-middle">
                    <div class="text-[10px] align-middle" style="vertical-align:center;">Runes: ${this.data.loot || 0}</div>
                    <div><img src="https://eldenring.wiki.fextralife.com/file/Elden-Ring/runes-currency-elden-ring-wiki-guide-18.png" class="size-3"></div>
                </div>
                <div class="text-[10px]">ID: ${this.data.id}</div>
            </div>
        </div>
        </div>
        
        <div class="card face back" id="backdownloader">
            <img src="/static/src/page_bg_raw.jpg" class="back-img">
        </div>
        <div>
        </div>
    </div>
    `;
    };
}


function render() {
    const container = document.getElementById('cardContainer');
    if (!container) return;

    const cardObj = new Card(ITEM);

    if (TYPE === 'character') container.innerHTML = cardObj.renderCharacter();
    else if (TYPE === 'weapon') container.innerHTML = cardObj.renderWeapon();
    else if (TYPE === 'class') container.innerHTML = cardObj.renderClass();
    else if (TYPE === 'armor') container.innerHTML = cardObj.renderArmor();

    document.querySelectorAll('.balatro-card').forEach((wrapper) => {
        const inner = wrapper.querySelector('.card-inner');

        // SKEW SEMPRE ATTIVO (Sul Wrapper)
        wrapper.addEventListener('mousemove', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;

            // Lo skew sul wrapper non deve includere rotateY(180) 
            // perché quello lo fa già il CSS sulla classe .flipped
            wrapper.style.transform = `
        scale(1.2)
        perspective(1200px)
        rotateY(${x * 12}deg) 
        rotateX(${y * -12}deg) 
        skew(${x * 5}deg, ${y * 2}deg)
    `;
        });

        wrapper.addEventListener('mouseleave', () => {
            wrapper.style.transform = ''; // Torna alla posizione base
        });

        // FLIP (Sul Inner)
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            wrapper.classList.toggle('flipped');
        });
    });
}


function setType(type) {
    currentType = type;
    render();
}

function saveCardAsPng(elementId) {
    const node = document.getElementById(elementId);
    // const node = document.getElementById("backdownloader");

    const fileName = `${ITEM.id}.png`;

    htmlToImage.toPng(node, {
        cacheBust: true, // Evita problemi di cache del browser
        skipFonts: false,
    })
        .then(function (dataUrl) {
            const link = document.createElement('a');
            link.download = `${ITEM.id}.png`;
            link.href = dataUrl;
            link.click();
        })
        .catch(function (error) {
            console.error("Dettaglio errore:", error);
            // Se l'errore è un evento, prova a ispezionare il target
            if (error.target) console.log("Elemento che ha causato l'errore:", error.target);
        });
}

render();