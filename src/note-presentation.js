// Presentation only: give brief thoughts and longer prose their own reading scale.
export function noteTextClass(text) {
  if (text.length <= 80 && !text.includes('\n')) return 'note-copy note-brief';
  if (text.length > 240 || text.split('\n').length > 3) return 'note-copy note-prose';
  return 'note-copy';
}
