const isAdultSurface = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('[data-adult="true"]'));

export function installKidSafeGuardrails(): () => void {
  let lastTouchEnd = 0;

  const blockGesture = (event: Event) => {
    if (!isAdultSurface(event.target)) event.preventDefault();
  };

  const blockMultiTouch = (event: TouchEvent) => {
    if (!isAdultSurface(event.target) && event.touches.length > 1) event.preventDefault();
  };

  const blockDoubleTap = (event: TouchEvent) => {
    if (isAdultSurface(event.target)) return;
    const now = Date.now();
    if (now - lastTouchEnd < 300) event.preventDefault();
    lastTouchEnd = now;
  };

  const blockZoomKeys = (event: KeyboardEvent) => {
    if (isAdultSurface(event.target)) return;
    if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
  };

  const blockZoomWheel = (event: WheelEvent) => {
    if (!isAdultSurface(event.target) && event.ctrlKey) event.preventDefault();
  };

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });
  document.addEventListener('touchmove', blockMultiTouch, { passive: false });
  document.addEventListener('touchend', blockDoubleTap, { passive: false });
  document.addEventListener('dblclick', blockGesture, { passive: false });
  document.addEventListener('contextmenu', blockGesture, { passive: false });
  document.addEventListener('selectstart', blockGesture, { passive: false });
  document.addEventListener('dragstart', blockGesture, { passive: false });
  document.addEventListener('copy', blockGesture, { passive: false });
  document.addEventListener('cut', blockGesture, { passive: false });
  document.addEventListener('paste', blockGesture, { passive: false });
  document.addEventListener('keydown', blockZoomKeys);
  document.addEventListener('wheel', blockZoomWheel, { passive: false });

  return () => {
    document.removeEventListener('gesturestart', blockGesture);
    document.removeEventListener('gesturechange', blockGesture);
    document.removeEventListener('gestureend', blockGesture);
    document.removeEventListener('touchmove', blockMultiTouch);
    document.removeEventListener('touchend', blockDoubleTap);
    document.removeEventListener('dblclick', blockGesture);
    document.removeEventListener('contextmenu', blockGesture);
    document.removeEventListener('selectstart', blockGesture);
    document.removeEventListener('dragstart', blockGesture);
    document.removeEventListener('copy', blockGesture);
    document.removeEventListener('cut', blockGesture);
    document.removeEventListener('paste', blockGesture);
    document.removeEventListener('keydown', blockZoomKeys);
    document.removeEventListener('wheel', blockZoomWheel);
  };
}
