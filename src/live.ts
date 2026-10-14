// Writing in public: the folder is watched. Each file that starts changing is announced as `writing`;
// once the folder has been quiet for a moment, `saved` follows and open pages type out what's new.
import { watch } from 'node:fs';
import { CONTENT_DIR, invalidate } from './content.ts';

export type Change = { event: 'writing' | 'saved'; files: string[] }; // files relative to CONTENT_DIR

const QUIET = 2_000; // LiveSync lands a change every second or so while I type; a pause this long means I stopped
const listeners = new Set<(change: Change) => void>();
const emit = (change: Change) => listeners.forEach((fn) => fn(change));

/** Calls `fn` on every change to the folder. Returns a function that stops listening. */
export function onChange(fn: (change: Change) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Starts watching the folder (once, from server.ts). Without a folder there's nothing to watch. */
export function watchFolder() {
  const changing = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  try {
    watch(CONTENT_DIR, { recursive: true }, (_, file) => {
      if (file && !changing.has(file)) {
        changing.add(file);
        emit({ event: 'writing', files: [file] });
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        invalidate();
        emit({ event: 'saved', files: [...changing] });
        changing.clear();
      }, QUIET);
    });
  } catch (e) {
    console.warn(`not watching ${CONTENT_DIR}: ${(e as Error).message}`);
  }
}
