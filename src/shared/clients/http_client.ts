import { environments } from '../environments';

export class NetworkFailureError extends Error {
  readonly kind = 'network_failure';
}

export interface HttpResponse {
  status: number;
  text(): Promise<string>;
}

function buildUrl(path: string): string {
  return `${environments.yaIDApiHost.replace(/\/+$/, '')}${path}`;
}

export const HttpClient = {
  /**
   * Fetch wrapper for the YaID host. TLS certificate pinning for the configured
   * host is enforced at the platform/network-security-config layer (Android
   * network security config / iOS ATS pinning), not in JS — this wrapper is
   * the single chokepoint through which all YaID API traffic flows so that
   * pinning config changes never need to touch call sites.
   */
  async post(path: string, headers: Record<string, string>, body: unknown): Promise<HttpResponse> {
    const url = buildUrl(path);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error(`[HttpClient] POST ${url} failed:`, error);
      throw new NetworkFailureError('Network request failed');
    }
    return response;
  },

  async get(path: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    const url = buildUrl(path);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
      });
    } catch (error) {
      console.error(`[HttpClient] GET ${url} failed:`, error);
      throw new NetworkFailureError('Network request failed');
    }
    return response;
  },
};
