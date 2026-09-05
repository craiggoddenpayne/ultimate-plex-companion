export function plexItemUrl(machineIdentifier, ratingKey) {
  const machine = String(machineIdentifier || '').trim();
  const key = String(ratingKey || '').trim();
  if (!machine) throw new Error('Plex did not provide a server identifier.');
  if (!/^\d+$/.test(key)) throw new Error('Invalid Plex item identifier.');
  const metadataKey = encodeURIComponent(`/library/metadata/${key}`);
  return `https://app.plex.tv/desktop/#!/server/${encodeURIComponent(machine)}/details?key=${metadataKey}`;
}
