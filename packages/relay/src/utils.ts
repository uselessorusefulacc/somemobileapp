export function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max) + "...";
}
