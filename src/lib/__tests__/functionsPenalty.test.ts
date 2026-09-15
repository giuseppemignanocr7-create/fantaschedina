// Test del motore rigori server-side. L'esito assegna gettoni, quindi
// interessano: validazione dell'input, limiti di probabilità e assenza di
// scorciatoie sfruttabili dal client (es. power fuori scala).
import { describe, it, expect } from 'vitest';
import {
  resolveShot,
  simulateOpponentShot,
  estimateSkillFromProfile,
  isValidZone,
  PENALTY_ZONES,
  type PenaltyZone,
} from '../../../functions/src/penalty';

describe('isValidZone', () => {
  it('accetta tutte le zone previste', () => {
    for (const z of PENALTY_ZONES) expect(isValidZone(z)).toBe(true);
  });

  it('respinge input non validi provenienti dal client', () => {
    const invalid = ['tl', 'XX', '', null, undefined, 42, {}, [], 'TL '];
    for (const v of invalid) expect(isValidZone(v)).toBe(false);
  });
});

describe('resolveShot', () => {
  it('restituisce sempre una struttura coerente', () => {
    for (const zone of PENALTY_ZONES) {
      const r = resolveShot(zone, 50);
      expect(r.shot).toBe(zone);
      expect(PENALTY_ZONES).toContain(r.keeper);
      expect(typeof r.goal).toBe('boolean');
      expect(r.power).toBe(50);
    }
  });

  it('vincola il power tra 0 e 100 anche con valori assurdi dal client', () => {
    expect(resolveShot('TL', -500).power).toBe(0);
    expect(resolveShot('TL', 99999).power).toBe(100);
    expect(resolveShot('TL', 33.7).power).toBe(34);
  });

  it('non garantisce mai il gol, nemmeno con power massimo sull\'angolo migliore', () => {
    // Il tetto è 0,95: senza di esso un client potrebbe rendere il gol certo.
    let saves = 0;
    for (let i = 0; i < 4000; i++) if (!resolveShot('TL', 100).goal) saves++;
    expect(saves).toBeGreaterThan(0);
  });

  it('non rende mai il gol impossibile, nemmeno nel caso peggiore', () => {
    let goals = 0;
    for (let i = 0; i < 4000; i++) if (resolveShot('BC', 0).goal) goals++;
    expect(goals).toBeGreaterThan(0);
  });

  it('premia gli angoli rispetto al centro', () => {
    const rate = (zone: PenaltyZone) => {
      let goals = 0;
      for (let i = 0; i < 4000; i++) if (resolveShot(zone, 80).goal) goals++;
      return goals / 4000;
    };
    expect(rate('TL')).toBeGreaterThan(rate('BC'));
  });

  it('premia un timing migliore a parità di zona', () => {
    const rate = (power: number) => {
      let goals = 0;
      for (let i = 0; i < 4000; i++) if (resolveShot('BL', power).goal) goals++;
      return goals / 4000;
    };
    expect(rate(100)).toBeGreaterThan(rate(0));
  });
});

describe('simulateOpponentShot', () => {
  it('produce sempre zona valida e power in scala', () => {
    for (const skill of [0, 0.25, 0.5, 0.75, 1]) {
      for (let i = 0; i < 500; i++) {
        const shot = simulateOpponentShot(skill);
        expect(PENALTY_ZONES).toContain(shot.zone);
        expect(shot.power).toBeGreaterThanOrEqual(0);
        expect(shot.power).toBeLessThanOrEqual(100);
      }
    }
  });

  it('normalizza livelli di abilità fuori scala', () => {
    for (const skill of [-10, 42]) {
      const shot = simulateOpponentShot(skill);
      expect(PENALTY_ZONES).toContain(shot.zone);
      expect(shot.power).toBeLessThanOrEqual(100);
    }
  });

  it('un avversario più forte cerca gli angoli più spesso', () => {
    const cornerRate = (skill: number) => {
      const corners: PenaltyZone[] = ['TL', 'TR', 'BL', 'BR'];
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        if (corners.includes(simulateOpponentShot(skill).zone)) hits++;
      }
      return hits / 3000;
    };
    expect(cornerRate(1)).toBeGreaterThan(cornerRate(0));
  });
});

describe('estimateSkillFromProfile', () => {
  it('usa una baseline per i profili nuovi', () => {
    expect(estimateSkillFromProfile(0, 0)).toBe(0.4);
    expect(estimateSkillFromProfile(50, -1)).toBe(0.4);
  });

  it('resta nell\'intervallo 0-1 anche con dati incoerenti', () => {
    // Più pronostici corretti che pronostici possibili: non deve sforare.
    expect(estimateSkillFromProfile(9999, 1)).toBe(1);
    expect(estimateSkillFromProfile(-50, 5)).toBe(0);
  });

  it('cresce con l\'accuratezza reale', () => {
    const scarso = estimateSkillFromProfile(10, 10); // 10/100
    const bravo = estimateSkillFromProfile(70, 10);  // 70/100
    expect(bravo).toBeGreaterThan(scarso);
    expect(scarso).toBeCloseTo(0.1, 5);
    expect(bravo).toBeCloseTo(0.7, 5);
  });
});

// ---------- Rigori Duello: tiro (zona + potenza) contro tuffo (zona) ----------
import {
  resolveDuelShot,
  duelMissChance,
  duelSaveChance,
  botDuelShot,
  botDuelKeeper,
  zoneFromLegacyTarget,
} from '../../../functions/src/penalty';

describe('resolveDuelShot', () => {
  const rate = (zone: PenaltyZone, power: number, keeper: PenaltyZone, n = 4000) => {
    let goals = 0;
    for (let i = 0; i < n; i++) if (resolveDuelShot(zone, power, keeper).goal) goals++;
    return goals / n;
  };

  it('restituisce sempre una struttura coerente e vincola la potenza', () => {
    for (const zone of PENALTY_ZONES) {
      for (const keeper of PENALTY_ZONES) {
        const r = resolveDuelShot(zone, 999, keeper);
        expect(r.shot).toBe(zone);
        expect(r.keeper).toBe(keeper);
        expect(r.power).toBe(100);
        expect(['goal', 'saved', 'miss', 'post']).toContain(r.outcome);
        expect(r.goal).toBe(r.outcome === 'goal');
      }
    }
    expect(resolveDuelShot('TL', Number.NaN, 'BR').power).toBe(0);
    expect(resolveDuelShot('TL', -5, 'BR').power).toBe(0);
  });

  it('il portiere che indovina la zona para quasi sempre, ma non sempre', () => {
    const r = rate('BL', 100, 'BL');
    expect(r).toBeLessThan(0.45);
    expect(r).toBeGreaterThan(0.05);
  });

  it('il portiere dalla parte sbagliata prende gol quasi sempre, ma non sempre', () => {
    const r = rate('BL', 100, 'BR');
    expect(r).toBeGreaterThan(0.85);
    expect(r).toBeLessThan(1);
  });

  it('stessa colonna ma altezza sbagliata: parata possibile ma meno probabile', () => {
    expect(rate('TL', 80, 'BL')).toBeGreaterThan(rate('TL', 80, 'TL'));
    expect(rate('TL', 80, 'BL')).toBeLessThan(rate('TL', 80, 'BR'));
  });

  it('un tiro tirato male sull\'angolo alto finisce spesso fuori, anche senza portiere', () => {
    expect(rate('TL', 0, 'BR')).toBeLessThan(rate('TL', 100, 'BR') - 0.2);
    expect(duelMissChance('TL', 0)).toBeGreaterThan(duelMissChance('BC', 0));
    expect(duelMissChance('TL', 1)).toBeLessThan(0.05);
  });

  it('fuori e palo sono esiti senza gol', () => {
    let fuori = 0;
    let pali = 0;
    for (let i = 0; i < 4000; i++) {
      const r = resolveDuelShot('TL', 0, 'BR');
      if (r.outcome === 'miss') fuori++;
      if (r.outcome === 'post') pali++;
      if (r.outcome === 'miss' || r.outcome === 'post') expect(r.goal).toBe(false);
    }
    expect(fuori).toBeGreaterThan(0);
    expect(pali).toBeGreaterThan(0);
  });

  it('la potenza riduce la chance di parata, entro limiti sensati', () => {
    expect(duelSaveChance('BL', 'BL', 1)).toBeLessThan(duelSaveChance('BL', 'BL', 0));
    expect(duelSaveChance('BL', 'BL', 1)).toBeGreaterThan(0.5);
    expect(duelSaveChance('BC', 'TC', 0.5)).toBeGreaterThan(duelSaveChance('BL', 'TL', 0.5));
    expect(duelSaveChance('BL', 'TR', 1)).toBeLessThan(0.1);
  });
});

describe('bot del duello', () => {
  it('tira e para sempre in zone valide, con potenza in scala', () => {
    for (let i = 0; i < 500; i++) {
      const t = botDuelShot();
      expect(PENALTY_ZONES).toContain(t.zone);
      expect(t.power).toBeGreaterThanOrEqual(45);
      expect(t.power).toBeLessThanOrEqual(95);
      expect(PENALTY_ZONES).toContain(botDuelKeeper());
    }
  });

  it('non tira solo al centro e non si tuffa sempre dalla stessa parte', () => {
    const zoneTiro = new Set<PenaltyZone>();
    const zonePara = new Set<PenaltyZone>();
    for (let i = 0; i < 600; i++) {
      zoneTiro.add(botDuelShot().zone);
      zonePara.add(botDuelKeeper());
    }
    expect(zoneTiro.size).toBe(6);
    expect(zonePara.size).toBe(6);
  });
});

describe('zoneFromLegacyTarget', () => {
  it('accetta le sei zone e le tre vecchie direzioni', () => {
    for (const z of PENALTY_ZONES) expect(zoneFromLegacyTarget(z)).toBe(z);
    expect(zoneFromLegacyTarget('left')).toBe('BL');
    expect(zoneFromLegacyTarget('center')).toBe('BC');
    expect(zoneFromLegacyTarget('right')).toBe('BR');
  });

  it('respinge tutto il resto', () => {
    for (const v of ['up', '', null, undefined, 3, {}]) expect(zoneFromLegacyTarget(v)).toBeNull();
  });
});
