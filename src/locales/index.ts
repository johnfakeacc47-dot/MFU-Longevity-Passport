import { th } from './th';
import { en } from './en';

export type Language = 'th' | 'en';

export const translations: Record<Language, Record<string, string>> = {
  th,
  en,
};
