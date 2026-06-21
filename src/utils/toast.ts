export const toastEvent = new EventTarget();

export const showToast = (message: string) => {
  toastEvent.dispatchEvent(new CustomEvent('show-toast', { detail: message }));
};
