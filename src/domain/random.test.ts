import { describe, it, expect } from 'vitest';
import { generateId, SeededRandom, hashSeed } from './random';

describe('Random Utility Library', () => {
  describe('generateId', () => {
    it('should generate a string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs sequentially', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('hashSeed', () => {
    it('should return a 32-bit positive integer hash of a string', () => {
      const hash1 = hashSeed('hello');
      const hash2 = hashSeed('world');
      expect(typeof hash1).toBe('number');
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).not.toBe(hash2);
    });

    it('should be deterministic', () => {
      const hashA = hashSeed('deterministic-seed-test');
      const hashB = hashSeed('deterministic-seed-test');
      expect(hashA).toBe(hashB);
    });
  });

  describe('SeededRandom (Mulberry32)', () => {
    it('should generate deterministic random values', () => {
      const prng1 = new SeededRandom('fixed-seed');
      const prng2 = new SeededRandom('fixed-seed');

      const val1_A = prng1.next();
      const val1_B = prng1.next();

      const val2_A = prng2.next();
      const val2_B = prng2.next();

      expect(val1_A).toBe(val2_A);
      expect(val1_B).toBe(val2_B);
      expect(val1_A).not.toBe(val1_B);
    });

    it('should generate different values for different seeds', () => {
      const prng1 = new SeededRandom('seed-1');
      const prng2 = new SeededRandom('seed-2');

      const val1 = prng1.next();
      const val2 = prng2.next();

      expect(val1).not.toBe(val2);
    });

    it('should roll integers within specified boundaries', () => {
      const prng = new SeededRandom('boundary-test');
      for (let i = 0; i < 100; i++) {
        const val = prng.nextInt(1, 6);
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });
});
