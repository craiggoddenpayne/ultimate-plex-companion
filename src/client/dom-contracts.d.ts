/**
 * Browser surface contract used by the progressively enhanced UI modules.
 *
 * Most controls are rendered from templates before their feature initializer
 * runs. These members describe that established contract while individual
 * features migrate toward selector-specific generic element types.
 */
interface Element {
  checked: boolean;
  click(): void;
  readonly dataset: DOMStringMap;
  disabled: boolean;
  elements: any;
  focus(options?: FocusOptions): void;
  getContext(contextId: '2d', options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D | null;
  hidden: boolean | 'until-found';
  height: number;
  onchange: ((this: GlobalEventHandlers, event: Event) => unknown) | null;
  onclick: ((this: GlobalEventHandlers, event: MouseEvent) => unknown) | null;
  oninput: ((this: GlobalEventHandlers, event: Event) => unknown) | null;
  onmouseleave: ((this: GlobalEventHandlers, event: MouseEvent) => unknown) | null;
  onmousemove: ((this: GlobalEventHandlers, event: MouseEvent) => unknown) | null;
  onsubmit: ((this: GlobalEventHandlers, event: SubmitEvent) => unknown) | null;
  style: CSSStyleDeclaration;
  title: string;
  value: any;
  width: number;
}

interface Event {
  key: string;
}

interface EventTarget {
  checked: boolean;
  closest(selectors: string): Element | null;
  tagName: string;
  value: string;
}

interface Document {
  matches(selectors: string): boolean;
}

interface PromiseRejectedResult {
  value?: never;
}

interface Window {
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<{
    createWritable(): Promise<WritableStream>;
  }>;
}
