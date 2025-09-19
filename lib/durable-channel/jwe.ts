export function jweEncrypt(
  data: Record<string, string | number | boolean | null | undefined>
) {
  return JSON.stringify(data);
}

export function jweDecrypt<T>(data: string): T {
  return JSON.parse(data);
}
