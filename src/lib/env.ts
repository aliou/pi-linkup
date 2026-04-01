export function hasLinkupApiKey(): boolean {
  return !!process.env.LINKUP_API_KEY;
}

export function getLinkupApiKey(): string {
  const apiKey = process.env.LINKUP_API_KEY;
  if (!apiKey) {
    throw new Error("LINKUP_API_KEY environment variable is not set");
  }
  return apiKey;
}
