import { describe, expect, it } from 'vitest';
import { abrirLinkNoSistema } from './sistema';

describe('abrir link', () => {
  it('só abre https (nada de javascript:, file: ou http puro)', async () => {
    expect(await abrirLinkNoSistema('javascript:alert(1)')).toBe(false);
    expect(await abrirLinkNoSistema('file:///etc/passwd')).toBe(false);
    expect(await abrirLinkNoSistema('http://exemplo.com')).toBe(false);
  });
});
