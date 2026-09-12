import { describe, expect, it } from 'vitest';
import { teamColor } from '../teamColors';

// I nomi delle squadre in home e nel live sono colorati con il colore
// sociale: una sigla sconosciuta deve avere un colore leggibile, non un
// buco, e la ricerca non deve dipendere da maiuscole e minuscole.
describe('teamColor', () => {
  it('conosce le sigle della Serie A', () => {
    expect(teamColor('JUV')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(teamColor('NAP')).not.toBe(teamColor('JUV'));
  });

  it('non distingue maiuscole e minuscole', () => {
    expect(teamColor('juv')).toBe(teamColor('JUV'));
    expect(teamColor('Nap')).toBe(teamColor('NAP'));
  });

  it('per una sigla sconosciuta o mancante usa il colore neutro', () => {
    const neutro = teamColor(undefined);
    expect(neutro).toMatch(/^#[0-9a-f]{6}$/i);
    expect(teamColor('ZZZ')).toBe(neutro);
    expect(teamColor('')).toBe(neutro);
  });
});
