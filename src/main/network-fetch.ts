export function installNetworkFetch(fetchImplementation: typeof fetch): void {
  globalThis.fetch = fetchImplementation;
}
