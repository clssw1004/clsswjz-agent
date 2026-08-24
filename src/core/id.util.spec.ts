import { generateId, generateToken } from './id.util';

const VALID_ALPHABET = '123456789abcdefghijkmnpqrstuvwxyz';

describe('id.util', () => {
  describe('generateId', () => {
    it('should return a string of length 32', () => {
      expect(generateId()).toHaveLength(32);
    });

    it('should only contain valid alphabet characters', () => {
      const id = generateId();
      for (const ch of id) {
        expect(VALID_ALPHABET).toContain(ch);
      }
    });

    it('should generate unique ids', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) ids.add(generateId());
      expect(ids.size).toBe(100);
    });
  });

  describe('generateToken', () => {
    it('should return a string of length 128', () => {
      expect(generateToken()).toHaveLength(128);
    });

    it('should only contain valid alphabet characters', () => {
      const token = generateToken();
      for (const ch of token) {
        expect(VALID_ALPHABET).toContain(ch);
      }
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) tokens.add(generateToken());
      expect(tokens.size).toBe(50);
    });
  });
});
