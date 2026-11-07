import { describe, expect, it } from 'vitest';
import { formaDoSelo, hash } from './selo';

describe('selo', () => {
  it('o mesmo título dá sempre o mesmo desenho, títulos diferentes dão desenhos diferentes', () => {
    expect(formaDoSelo('Dom Casmurro|Machado')).toEqual(formaDoSelo('Dom Casmurro|Machado'));
    expect(formaDoSelo('Dom Casmurro|Machado')).not.toEqual(formaDoSelo('Iracema|Alencar'));
    expect(hash('')).toBe(0x811c9dc5);
  });
});
