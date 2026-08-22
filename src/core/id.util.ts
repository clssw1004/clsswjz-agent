import { customAlphabet } from 'nanoid';

const ALPHABET = '123456789abcdefghijkmnpqrstuvwxyz';
const nanoid = customAlphabet(ALPHABET);

export function generateId(): string {
  return nanoid(32);
}

export function generateToken(): string {
  return nanoid(128);
}
