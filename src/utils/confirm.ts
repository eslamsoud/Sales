class ConfirmEmitter extends EventTarget {}
export const confirmEvents = new ConfirmEmitter();

export const confirmDialog = (message: string, isAlert: boolean = false): Promise<boolean> => {
  return new Promise((resolve) => {
    const event = new CustomEvent('show-confirm', {
      detail: { message, isAlert, resolve }
    });
    confirmEvents.dispatchEvent(event);
  });
};