/**
 * Language server ticket types.
 */

// --- CODE ---
/**
 * What a ticket grants, in the field names the lsp service reads.
 */
export interface TicketClaims {
  lang: string;
  sub: string;
  exp: number;
  jti: string;
  end: number;
}

/**
 * A ticket as handed to the client.
 */
export interface Ticket {
  ticket: string;
  expiresAt: number;
}
