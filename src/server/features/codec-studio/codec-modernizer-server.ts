const legacy = new Set(['h264', 'avc', 'mpeg4', 'mpeg2video', 'mpeg2', 'vc1']);
const targets = {
  hevc: { key: 'hevc', label: 'HEVC', encoder: 'libx265' },
  av1: { key: 'av1', label: 'AV1', encoder: 'libsvtav1' },
  vp9: { key: 'vp9', label: 'VP9', encoder: 'libvpx-vp9' },
};

export function isLegacyCodec(codec) {
  return legacy.has(String(codec || '').toLowerCase());
}
export function conversionTarget(value) {
  const target = targets[String(value || 'hevc').toLowerCase()];
  if (!target) throw new Error('Choose HEVC, AV1 or VP9 as the target codec.');
  return target;
}
export function videoArguments(value, settings: any = {}) {
  const target = conversionTarget(value);
  if (target.key === 'vp9')
    return ['-c:v:0', target.encoder, '-crf', '30', '-b:v', '0', '-deadline', 'good', '-cpu-used', '2'];
  if (target.key === 'av1')
    return [
      '-c:v:0',
      target.encoder,
      '-preset',
      '6',
      '-crf',
      String(Math.min(38, Math.max(24, Number(settings.crf || 20) + 8))),
    ];
  return ['-c:v:0', target.encoder, '-preset', settings.preset || 'medium', '-crf', String(settings.crf || 20)];
}
export function supportedTargets(encoderOutput = '') {
  return Object.values(targets).map((target) => ({
    ...target,
    available: String(encoderOutput).includes(target.encoder),
  }));
}
