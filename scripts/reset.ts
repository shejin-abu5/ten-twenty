/**
 * Empties every table, leaving the assumptions in place.
 *
 *   npm run db:reset
 */
import { clearAll } from '@/lib/db/repository';

clearAll();
console.log('All uploaded data removed. Run `npm run seed` to reload the sample year.');
