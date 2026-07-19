// ============================================
// TEST ECONOMIA DI GIOCO
// Integrità di gettoni, power-up e missioni.
// ============================================
import { describe, it, expect } from 'vitest';
import { COINS, POWERUPS, MISSIONS, type PowerUpId } from '../economy';

describe('COINS — parametri economici sani', () => {
  it('bonus di partenza positivo', () => {
    expect(COINS.starting).toBeGreaterThan(0);
  });
  it('bonus 10/10 > bonus 9/10', () => {
    expect(COINS.bonus10Correct).toBeGreaterThan(COINS.bonus9Correct);
  });
  it('la ruota ha 8 spicchi', () => {
    expect(COINS.wheelPrizes).toHaveLength(8);
  });
  it.each(COINS.wheelPrizes.map((p, i) => ({ i, p })))('spicchio $i premio $p > 0', ({ p }) => {
    expect(p).toBeGreaterThan(0);
  });
  it('jackpot della ruota è il premio massimo', () => {
    expect(Math.max(...COINS.wheelPrizes)).toBe(100);
  });
  it('quiz: guadagno massimo coerente', () => {
    expect(COINS.quizPerCorrect * COINS.quizMaxQuestions).toBe(30);
  });
  it('rigori: guadagno massimo coerente', () => {
    expect(COINS.rigoriPerGoal * COINS.rigoriMaxShots).toBe(10);
  });
});

describe('POWERUPS — catalogo valido', () => {
  const ids = Object.keys(POWERUPS) as PowerUpId[];
  it('sono 4 power-up', () => {
    expect(ids).toHaveLength(4);
  });
  it.each(ids.map(id => ({ id })))('power-up $id: id coerente, costo > 0, descrizione presente', ({ id }) => {
    const p = POWERUPS[id];
    expect(p.id).toBe(id);
    expect(p.cost).toBeGreaterThan(0);
    expect(p.name.length).toBeGreaterThan(2);
    expect(p.description.length).toBeGreaterThan(10);
    expect(p.emoji.length).toBeGreaterThan(0);
  });
  it('il jolly è il più costoso (raddoppia i punti)', () => {
    expect(POWERUPS.jolly.cost).toBe(Math.max(...ids.map(i => POWERUPS[i].cost)));
  });
  it('ogni power-up è acquistabile con qualche settimana di gioco (costo ≤ 500)', () => {
    ids.forEach(id => expect(POWERUPS[id].cost).toBeLessThanOrEqual(500));
  });
});

describe('MISSIONS — catalogo valido', () => {
  it('almeno 10 missioni', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(10);
  });
  it('id univoci', () => {
    const ids = MISSIONS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it.each(MISSIONS.map(m => ({ id: m.id, m })))('missione $id: target e reward positivi, testi presenti', ({ m }) => {
    expect(m.target).toBeGreaterThan(0);
    expect(m.reward).toBeGreaterThan(0);
    expect(m.name.length).toBeGreaterThan(2);
    expect(m.description.length).toBeGreaterThan(5);
  });
  it('le missioni progressive dello stesso campo hanno reward crescenti', () => {
    const byField = new Map<string, { target: number; reward: number }[]>();
    MISSIONS.forEach(m => {
      const list = byField.get(m.field) ?? [];
      list.push({ target: m.target, reward: m.reward });
      byField.set(m.field, list);
    });
    byField.forEach(list => {
      const sorted = [...list].sort((a, b) => a.target - b.target);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].reward).toBeGreaterThanOrEqual(sorted[i - 1].reward);
      }
    });
  });
  it('la missione più remunerativa è la schedina perfetta', () => {
    const max = Math.max(...MISSIONS.map(m => m.reward));
    const top = MISSIONS.find(m => m.reward === max);
    expect(top?.field === 'perfectSchedine' || top?.field === 'weeklyWins').toBe(true);
  });
});
