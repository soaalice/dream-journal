export interface HeaderOptions {
  apiOrigin?: string;
  avatarHosts?: string[];
  production?: boolean;
}

export function buildCsp(options?: HeaderOptions): string;
export function securityHeaders(options?: HeaderOptions): Record<string, string>;
export function originOf(url: string | undefined): string;
export function renderHeadersFile(options?: HeaderOptions): string;
