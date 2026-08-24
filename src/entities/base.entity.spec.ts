import { StringIdEntity, BaseEntity, BaseBusinessEntity, BaseBusinessEntityWithAccountBook } from './base.entity';

describe('Base Entities', () => {
  describe('StringIdEntity', () => {
    it('should auto-generate id on BeforeInsert when empty', () => {
      const entity = new (class extends StringIdEntity {})();
      entity.id = '';
      entity.generateId();
      expect(entity.id).toHaveLength(32);
    });

    it('should not overwrite existing id', () => {
      const entity = new (class extends StringIdEntity {})();
      entity.id = 'existing-id';
      entity.generateId();
      expect(entity.id).toBe('existing-id');
    });
  });

  describe('BaseEntity', () => {
    it('should set createdAt and updatedAt on BeforeInsert', () => {
      const entity = new (class extends BaseEntity {})();
      const before = Date.now();
      entity.setTimestamps();
      const after = Date.now();

      expect(entity.createdAt).toBeGreaterThanOrEqual(before);
      expect(entity.createdAt).toBeLessThanOrEqual(after);
      expect(entity.updatedAt).toBe(entity.createdAt);
    });

    it('should update only updatedAt on BeforeUpdate', () => {
      const entity = new (class extends BaseEntity {})();
      entity.createdAt = 1000;
      entity.updatedAt = 1000;

      const before = Date.now();
      entity.updateTimestamp();

      expect(entity.createdAt).toBe(1000); // unchanged
      expect(entity.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('BaseBusinessEntity', () => {
    it('should have createdBy and updatedBy fields', () => {
      const entity = new (class extends BaseBusinessEntity {})();
      entity.createdBy = 'user1';
      entity.updatedBy = 'user2';
      expect(entity.createdBy).toBe('user1');
      expect(entity.updatedBy).toBe('user2');
    });
  });

  describe('BaseBusinessEntityWithAccountBook', () => {
    it('should have accountBookId field', () => {
      const entity = new (class extends BaseBusinessEntityWithAccountBook {})();
      entity.accountBookId = 'book1';
      expect(entity.accountBookId).toBe('book1');
    });
  });
});
