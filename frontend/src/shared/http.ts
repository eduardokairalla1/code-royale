/**
 * Http client for the backend api.
 */

// --- IMPORTS ---
import { config } from '../config.ts';
import { ApiError } from './errors.ts';
import { isErrorBody } from './errors.ts';

// --- CODE ---
/**
 * Call the backend and return its json body.
 *
 * @param {string} method The http method.
 * @param {string} path The path under the api, e.g. "/rooms".
 * @param {unknown} body The json body, if any.
 *
 * @returns {Promise<T>} The response body.
 *
 * @throws {ApiError} When the backend answers an error or cannot be reached.
 */
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {

  let response: Response;

  // unreachable: tell it apart from the backend's own errors
  try {
    response = await fetch(config.apiUrl + path, {
      method,
      headers: body === undefined
        ? {}
        : { 'Content-Type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network_error');
  }

  const data: unknown = await response.json().catch(() => null);

  // the backend refused: keep its slug
  if (!response.ok) {
    throw new ApiError(
      isErrorBody(data) ? data.error : 'http_error',
      response.status,
    );
  }

  return data as T;
}
