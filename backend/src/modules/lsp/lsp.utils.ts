/**
 * Lsp tickets: base64url json payload, HMAC-SHA256 signed.
 */

// --- IMPORTS ---
import type { TicketClaims } from './lsp.types.js';
import { createHmac } from 'node:crypto';

// --- CODE ---
/**
 * Sign a ticket.
 *
 * @param {string} secret The secret shared with the lsp service.
 * @param {TicketClaims} claims What the ticket grants.
 *
 * @returns {string} The ticket.
 */
export function signTicket(secret: string, claims: TicketClaims): string {

  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}
