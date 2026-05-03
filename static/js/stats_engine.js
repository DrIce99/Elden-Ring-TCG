// ============================================================
// STATS ENGINE — Elden Ring–faithful stat calculations
// ============================================================
// Handles: HP · FP · Stamina · Equip Load · Poise
//          Defense (Physical / Magic / Fire / Lightning / Holy)
//          Damage Negation (multiplicative stacking)
//          Attack Power (base + stat scaling)
//          Final damage resolution (atk²/(atk+def) × negation)
// All user-facing strings are in English.
// ============================================================

// ------------------------------------------------------------
// SCALING GRADE → approximate multiplier
// (fraction of the weapon's base that is added as stat bonus)
// Based on Elden Ring soft-cap contribution rates.
// ------------------------------------------------------------
const SCALING_MULTIPLIER = {
    S: 1.00,
    A: 0.75,
    B: 0.55,
    C: 0.35,
    D: 0.20,
    E: 0.10,
};

// ------------------------------------------------------------
// STAT-LEVEL → ATTRIBUTE DEFENSE BONUS (linear approximation)
// Source: per-stat rates given in the project spec.
// ------------------------------------------------------------
const STAT_DEF_RATE = {
    physical:  0.33,   // from Strength
    magic:     2.00,   // from Intelligence
    fire:      0.66,   // from Vigor
    lightning: 0.00,   // no scaling stat
    holy:      2.00,   // from Arcane
};

// ------------------------------------------------------------
// BASE DEFENSE from rune level (same for all damage types)
// Elden Ring piecewise formula.
// ------------------------------------------------------------
function calcBaseDefense(runeLevel) {
    const l = Math.max(1, runeLevel);
    if      (l < 72)  return 40  + (l + 78)         / 2.483;
    else if (l < 92)  return 29  + l;
    else if (l < 161) return 120 + (l - 91)          / 4.667;
    else              return 135 + (l - 161)          / 27.6;
}

// ------------------------------------------------------------
// HP from Vigor — piecewise curve matching Elden Ring values.
// Key points: vig1=300, vig25=1020, vig40=1468, vig60=1900, vig99=2100
// ------------------------------------------------------------
function calcHP(vigor) {
    const v = clampStat(vigor);
    if      (v <= 1)  return 300;
    else if (v <= 25) return Math.round(300  + (v -  1) * (720  / 24));
    else if (v <= 40) return Math.round(1020 + (v - 25) * (448  / 15));
    else if (v <= 60) return Math.round(1468 + (v - 40) * (432  / 20));
    else              return Math.round(1900 + (v - 60) * (200  / 39));
}

// ------------------------------------------------------------
// FP from Mind — piecewise curve.
// Key points: mind1=40, mind15=193, mind35=343, mind60=593, mind99=700
// ------------------------------------------------------------
function calcFP(mind) {
    const m = clampStat(mind);
    if      (m <= 1)  return 40;
    else if (m <= 15) return Math.round(40  + (m -  1) * (153 / 14));
    else if (m <= 35) return Math.round(193 + (m - 15) * (150 / 20));
    else if (m <= 60) return Math.round(343 + (m - 35) * (250 / 25));
    else              return Math.round(593 + (m - 60) * (107 / 39));
}

// ------------------------------------------------------------
// Stamina from Endurance — piecewise curve.
// Key points: end1=80, end15=118, end35=143, end60=230, end99=240
// ------------------------------------------------------------
function calcStamina(endurance) {
    const e = clampStat(endurance);
    if      (e <= 1)  return 80;
    else if (e <= 15) return Math.round(80  + (e -  1) * (38  / 14));
    else if (e <= 35) return Math.round(118 + (e - 15) * (25  / 20));
    else if (e <= 60) return Math.round(143 + (e - 35) * (87  / 25));
    else              return Math.round(230 + (e - 60) * (10  / 39));
}

// ------------------------------------------------------------
// Equip Load from Endurance.
// end1=45, end25=93.5, end60=168.9, end99=170 (approx)
// ------------------------------------------------------------
function calcEquipLoad(endurance) {
    const e = clampStat(endurance);
    if      (e <= 1)  return 45.0;
    else if (e <= 25) return +(45.0  + (e -  1) * (48.5 / 24)).toFixed(1);
    else if (e <= 60) return +(93.5  + (e - 25) * (75.4 / 35)).toFixed(1);
    else              return +(168.9 + (e - 60) * (1.1  / 39)).toFixed(1);
}

// ------------------------------------------------------------
// Total defense for each damage type.
// total = base(runeLevel) + stat * per_level_rate
// ------------------------------------------------------------
function calcAllDefenses(stats, runeLevel) {
    const base = calcBaseDefense(runeLevel);
    return {
        physical:  Math.round(base + stats.strength     * STAT_DEF_RATE.physical),
        magic:     Math.round(base + stats.intelligence  * STAT_DEF_RATE.magic),
        fire:      Math.round(base + stats.vigor         * STAT_DEF_RATE.fire),
        lightning: Math.round(base),                           // no stat
        holy:      Math.round(base + stats.arcane        * STAT_DEF_RATE.holy),
    };
}

// ------------------------------------------------------------
// Poise from armor pieces (sum of poise resistance values).
// ------------------------------------------------------------
function calcPoise(armorPieces) {
    return armorPieces.reduce((sum, armor) => {
        const poiseEntry = armor?.resistance?.find(r => r.name === 'Poise');
        return sum + (poiseEntry?.amount || 0);
    }, 0);
}

// ------------------------------------------------------------
// Status resistances from armor (sum of each type).
// ------------------------------------------------------------
function calcStatusResistances(armorPieces) {
    const types  = ['Immunity', 'Robustness', 'Focus', 'Vitality'];
    const result = {};
    types.forEach(t => {
        result[t.toLowerCase()] = armorPieces.reduce((sum, armor) => {
            const entry = armor?.resistance?.find(r => r.name === t);
            return sum + (entry?.amount || 0);
        }, 0);
    });
    return result;
}

// ------------------------------------------------------------
// Damage Negation (multiplicative stacking across all armor).
// Returns an object: { physical, strike, slash, pierce,
//                      magic, fire, lightning, holy } as 0-100 %.
// ------------------------------------------------------------
function calcDamageNegation(armorPieces) {
    const types = ['Phy', 'Strike', 'Slash', 'Pierce', 'Magic', 'Fire', 'Ligt', 'Holy'];
    const result = {};

    types.forEach(type => {
        // Collect each piece's negation for this damage type (default 0)
        const negations = armorPieces.map(armor => {
            const entry = armor?.dmgNegation?.find(d => d.name === type);
            return entry?.amount || 0;
        });

        // Multiplicative stacking: remaining = product of (1 - neg_i / 100)
        const remaining = negations.reduce((acc, n) => acc * (1 - n / 100), 1);
        result[type.toLowerCase()] = +((1 - remaining) * 100).toFixed(2);
    });

    // Normalize Lightning key alias ('ligt' → 'lightning' for readability)
    result.lightning = result.ligt;

    return result;
}

// ------------------------------------------------------------
// Weapon Attack Power.
// Total = sum of each damage-type base attack
//       + sum of scaling bonuses (based on scalesWith grades)
// Scaling bonus for each attribute = base_Phy * SCALING_MULTIPLIER[grade]
//                                    * (stat_value / STAT_SCALE_DIVISOR)
// STAT_SCALE_DIVISOR is 150 (roughly mimics ER's soft-cap curve).
// ------------------------------------------------------------
const STAT_SCALE_DIVISOR = 150;
const SCALING_STAT_MAP   = {
    Str: 'strength',
    Dex: 'dexterity',
    Int: 'intelligence',
    Fai: 'faith',
    Arc: 'arcane',
};

function calcWeaponAttack(weapon, classStats) {
    if (!weapon) return { total: 0, breakdown: {} };

    // Sum all base attack values
    const baseTotal = (weapon.attack || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const basePhy   = (weapon.attack || []).find(a => a.name === 'Phy')?.amount || 0;

    // Check attribute requirements
    const meetsRequirements = (weapon.requiredAttributes || []).every(req => {
        const statName  = SCALING_STAT_MAP[req.name] || req.name.toLowerCase();
        const playerStat = classStats[statName] || 0;
        return playerStat >= req.amount;
    });

    // Penalty if requirements not met: ~40% of base
    const reqMult = meetsRequirements ? 1.0 : 0.4;

    // Scaling bonus (applied to physical base, which is how ER handles it)
    let scalingBonus = 0;
    (weapon.scalesWith || []).forEach(scale => {
        const statName = SCALING_STAT_MAP[scale.name];
        if (!statName) return;
        const statValue = classStats[statName] || 0;
        const mult      = SCALING_MULTIPLIER[scale.scaling] || 0;
        scalingBonus   += basePhy * mult * (statValue / STAT_SCALE_DIVISOR);
    });

    const total = Math.round((baseTotal + scalingBonus) * reqMult);

    return {
        total,
        base:           baseTotal,
        scalingBonus:   Math.round(scalingBonus),
        meetsReq:       meetsRequirements,
        lightAtk:       total,                          // light attack = full weapon power
        heavyAtk:       Math.round(total * 1.5),        // heavy gets ×1.5 (requires charge)
        passives:       weapon.passives || [],
        atkType:        weapon.atktype || 'Physical',
        range:          weapon.range   || 1,
    };
}

// ------------------------------------------------------------
// FINAL DAMAGE FORMULA
// Elden Ring: raw = atk² / (atk + def)
// Then:       final = raw × (1 − totalNegation/100)
// Returns an integer.
// ------------------------------------------------------------
function calcFinalDamage(attackPower, defense, negationPercent) {
    if (attackPower <= 0) return 0;
    const rawDmg   = (attackPower * attackPower) / (attackPower + Math.max(1, defense));
    const afterNeg = rawDmg * (1 - Math.max(0, Math.min(negationPercent, 99.9)) / 100);
    return Math.max(1, Math.round(afterNeg));
}

// ------------------------------------------------------------
// RESOLVE ATTACK — combines attacker and defender stats.
// atkType: 'physical' | 'magic' | 'fire' | 'lightning' | 'holy'
// physSubType: 'strike' | 'slash' | 'pierce' (only for physical)
// Returns { damage, isCrit, blocked }
// ------------------------------------------------------------
window.resolveAttack = function (attackerStats, defenderStats, atkType = 'physical', physSubType = null) {
    // 1. Pick attack power
    const atk = attackerStats.attackPower?.total || attackerStats.lightAtk || 2;

    // 2. Pick defender's defense for this damage type
    const defenseKey = atkType === 'physical' ? 'physical' : atkType;
    const def        = defenderStats.defense?.[defenseKey] || defenderStats.physDef || 10;

    // 3. Pick negation: physical attacks use the sub-type negation if available
    let negKey = atkType;
    if (atkType === 'physical' && physSubType) {
        negKey = physSubType; // 'strike' / 'slash' / 'pierce'
    }
    const neg = defenderStats.negation?.[negKey] ?? defenderStats.negation?.phy ?? 0;

    // 4. Poise check (attacker's heavy vs defender's poise)
    // If defender's poise > attacker's poise damage, attack won't stagger them.
    // For simplicity we just calculate damage here; stagger is handled in turn-manager.

    const damage = calcFinalDamage(atk, def, neg);
    return { damage, atkType, negKey, atk, def, neg };
};

// ------------------------------------------------------------
// MASTER FUNCTION — compute all stats for a unit on the field.
// classCard  : the class card object (has .stats, .id, .name)
// equippedItems : array of equipped item cards (weapons & armor)
// Returns a comprehensive stats object used by turn-manager.
// ------------------------------------------------------------
window.computeUnitStats = function (classCard, equippedItems = []) {
    if (!classCard) return _defaultUnitStats();

    // Parse class base stats (stored as strings in the JSON)
    const raw    = classCard.stats || {};
    const stats  = {
        level:        parseInt(raw.level        || '1'),
        vigor:        parseInt(raw.vigor        || '10'),
        mind:         parseInt(raw.mind         || '10'),
        endurance:    parseInt(raw.endurance    || '10'),
        strength:     parseInt(raw.strength     || '10'),
        dexterity:    parseInt(raw.dexterity    || '10'),
        intelligence: parseInt(raw.intelligence || '7'),
        faith:        parseInt(raw.faith        || '7'),
        arcane:       parseInt(raw.arcane       || '7'),
    };

    // Separate equipped items by category
    const armorTypes  = ['armors', 'gloves', 'leg_armors', 'helmets'];
    const armorPieces = equippedItems.filter(i =>
        i && armorTypes.includes(window.getCardType?.(i) || ''));
    const weapon      = equippedItems.find(i =>
        i && window.getCardType?.(i) === 'weapons') || null;

    // Core vitals
    const hp       = calcHP(stats.vigor);
    const fp       = calcFP(stats.mind);
    const stamina  = calcStamina(stats.endurance);
    const equipLoad = calcEquipLoad(stats.endurance);

    // Defense
    const defense = calcAllDefenses(stats, stats.level);

    // Negation (from armor only)
    const negation = calcDamageNegation(armorPieces);

    // Poise & status resistances
    const poise       = calcPoise(armorPieces);
    const resistances = calcStatusResistances(armorPieces);

    // Weapon attack power
    const attackPower = calcWeaponAttack(weapon, stats);

    // Equip load ratio for roll type
    const currentLoad = equippedItems.reduce((s, i) => s + (i?.weight || 0), 0);
    const loadRatio   = currentLoad / equipLoad;
    const rollType    = loadRatio < 0.30 ? 'Light Roll'
                     :  loadRatio < 0.70 ? 'Medium Roll'
                     :  loadRatio < 1.00 ? 'Heavy Roll'
                     :                     'Overloaded';

    return {
        // Identity
        name:    classCard.name,
        classId: classCard.id,

        // Core stats (for turn-manager)
        hp,
        maxHp:   hp,
        fp,
        maxFp:   fp,
        stamina,
        maxStamina: stamina,
        charges:    0,
        dodgedLastTurn: false,

        // Full Elden Ring stats
        baseStats:    stats,
        defense,
        negation,
        poise,
        resistances,
        equipLoad,
        currentLoad: +currentLoad.toFixed(1),
        loadRatio:   +loadRatio.toFixed(2),
        rollType,
        attackPower,

        // Convenience shortcuts used by turn-manager
        lightAtk:  attackPower.lightAtk,
        heavyAtk:  attackPower.heavyAtk,
        atkType:   attackPower.atkType,
        passives:  attackPower.passives,
        range:     attackPower.range,
    };
};

// ------------------------------------------------------------
// COMPUTE STATS FOR OPPONENT CARD (creatures / npcs / bosses)
// These cards have raw hp/atk fields rather than class stats.
// ------------------------------------------------------------
window.computeEnemyStats = function (card, equippedItems = []) {
    const baseHp  = card.hp  || 8;
    const baseAtk = card.atk || card.attack || 2;
    const level   = card.level || 1;

    const armorTypes  = ['armors', 'gloves', 'leg_armors', 'helmets'];
    const armorPieces = equippedItems.filter(i =>
        i && armorTypes.includes(window.getCardType?.(i) || ''));
    const weapon      = equippedItems.find(i =>
        i && window.getCardType?.(i) === 'weapons') || null;

    const baseDefense = calcBaseDefense(level);
    const negation    = calcDamageNegation(armorPieces);
    const poise       = calcPoise(armorPieces);
    const passives    = card.passives || [];

    const atk = weapon
        ? calcWeaponAttack(weapon, {}).total
        : baseAtk;

    return {
        name:           card.name,
        hp:             baseHp,
        maxHp:          baseHp,
        fp:             0,
        maxFp:          0,
        stamina:        100,
        maxStamina:     100,
        charges:        0,
        dodgedLastTurn: false,
        defense: {
            physical:  Math.round(baseDefense),
            magic:     Math.round(baseDefense),
            fire:      Math.round(baseDefense),
            lightning: Math.round(baseDefense),
            holy:      Math.round(baseDefense),
        },
        negation,
        poise,
        lightAtk:  atk,
        heavyAtk:  Math.round(atk * 1.5),
        atkType:   'Physical',
        passives,
        range:     card.range  || 1,
        attackPower: { total: atk, lightAtk: atk, heavyAtk: Math.round(atk * 1.5) },
    };
};

// ------------------------------------------------------------
// DAMAGE LABEL HELPER — human-readable breakdown for UI
// ------------------------------------------------------------
window.formatDamageBreakdown = function (attackerStats, defenderStats, isHeavy = false) {
    const atk     = isHeavy ? attackerStats.heavyAtk : attackerStats.lightAtk;
    const atkType = (attackerStats.atkType || 'Physical').toLowerCase();
    const def     = defenderStats.defense?.[atkType] || defenderStats.defense?.physical || 10;
    const neg     = defenderStats.negation?.phy ?? 0;
    const dmg     = calcFinalDamage(atk, def, neg);

    return {
        label:    `${isHeavy ? '⚒ Heavy' : '⚔ Light'}: ${dmg} dmg`,
        atk, def, neg, dmg,
        passives: attackerStats.passives || [],
    };
};

// ------------------------------------------------------------
// STATS TOOLTIP — formatted string for hover panel
// ------------------------------------------------------------
window.formatStatsTooltip = function (unitStats) {
    if (!unitStats) return '';
    const d = unitStats.defense || {};
    const n = unitStats.negation || {};
    const ap = unitStats.attackPower || {};

    return [
        `HP ${unitStats.hp}  |  FP ${unitStats.fp}  |  Stamina ${unitStats.stamina}`,
        `─────────────────────────`,
        `Attack Power: ${ap.total || unitStats.lightAtk || '—'}`,
        `  Light: ${unitStats.lightAtk}   Heavy: ${unitStats.heavyAtk}`,
        `─────────────────────────`,
        `Defense`,
        `  Phy ${d.physical || '—'}  Mag ${d.magic || '—'}  Fire ${d.fire || '—'}`,
        `  Ligt ${d.lightning || '—'}  Holy ${d.holy || '—'}`,
        `─────────────────────────`,
        `Damage Negation`,
        `  Phy ${(n.phy || 0).toFixed(1)}%  Mag ${(n.magic || 0).toFixed(1)}%`,
        `  Fire ${(n.fire || 0).toFixed(1)}%  Ligt ${(n.lightning || 0).toFixed(1)}%`,
        `  Holy ${(n.holy || 0).toFixed(1)}%`,
        `─────────────────────────`,
        `Poise: ${unitStats.poise || 0}`,
        `Load: ${unitStats.currentLoad || '?'} / ${unitStats.equipLoad || '?'} (${unitStats.rollType || '—'})`,
    ].join('\n');
};

// ------------------------------------------------------------
// INTEGRATION HOOK — called by game_rules.js after a unit
// is placed. Computes and stores full stats in unitStates.
// ------------------------------------------------------------
window.initUnitStats = function (owner, slotIndex, card, equippedItems = []) {
    const gs      = window.GameState;
    const key     = owner + '_' + slotIndex;
    const isClass = window.getCardType?.(card) === 'classes';

    const computed = isClass
        ? window.computeUnitStats(card, equippedItems)
        : window.computeEnemyStats(card, equippedItems);

    // Merge into existing state (may already have charges etc.)
    gs.unitStates[key] = Object.assign(gs.unitStates[key] || {}, computed);

    // Update HP badge
    const slots     = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    const slotEl    = slots[slotIndex];
    if (slotEl && window._showHPBadge) {
        window._showHPBadge(slotEl, computed.hp);
    }

    console.log(`📊 Stats initialised [${key}]: HP ${computed.hp}  Atk ${computed.lightAtk}  PhyDef ${computed.defense?.physical}`);
    return gs.unitStates[key];
};

// ------------------------------------------------------------
// EQUIP UPDATE — recalculate stats when armor/weapon changes.
// ------------------------------------------------------------
window.updateUnitStatsOnEquip = function (owner, slotIndex) {
    const gs      = window.GameState;
    const key     = owner + '_' + slotIndex;
    const slots   = [...document.querySelectorAll(`.player-area.${owner} .slot.battle`)];
    const slotEl  = slots[slotIndex];
    if (!slotEl?.dataset.card) return;

    let card = null;
    try { card = JSON.parse(slotEl.dataset.card); } catch { return; }

    let equips = [];
    try { equips = slotEl.dataset.equip ? JSON.parse(slotEl.dataset.equip) : []; } catch {}

    // Preserve current HP (don't reset mid-battle)
    const currentHp     = gs.unitStates[key]?.hp ?? null;
    const currentHpMax  = gs.unitStates[key]?.maxHp ?? null;

    window.initUnitStats(owner, slotIndex, card, equips);

    // Keep current HP if lower than new max (equipment change mid-battle)
    if (currentHp !== null) {
        const newMax = gs.unitStates[key].maxHp;
        gs.unitStates[key].hp    = Math.min(currentHp, newMax);
        gs.unitStates[key].maxHp = newMax;
        if (slotEl && window._showHPBadge) {
            window._showHPBadge(slotEl, gs.unitStates[key].hp);
        }
    }
};

// ------------------------------------------------------------
// INTERNAL HELPERS
// ------------------------------------------------------------
function clampStat(v, min = 1, max = 99) {
    return Math.max(min, Math.min(max, parseInt(v) || 1));
}

function _defaultUnitStats() {
    return {
        hp: 10, maxHp: 10, fp: 0, maxFp: 0,
        stamina: 80, maxStamina: 80, charges: 0, dodgedLastTurn: false,
        defense: { physical: 50, magic: 50, fire: 50, lightning: 50, holy: 50 },
        negation: { phy: 0, magic: 0, fire: 0, lightning: 0, holy: 0 },
        poise: 0, lightAtk: 2, heavyAtk: 3, atkType: 'Physical', passives: [],
        attackPower: { total: 2, lightAtk: 2, heavyAtk: 3 },
    };
}

// Expose internals for testing
window._statsEngine = {
    calcBaseDefense, calcHP, calcFP, calcStamina, calcEquipLoad,
    calcAllDefenses, calcDamageNegation, calcPoise, calcWeaponAttack,
    calcFinalDamage, SCALING_MULTIPLIER,
};