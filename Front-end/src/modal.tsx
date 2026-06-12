import React, { useCallback, useEffect, useState } from 'react';

export type ModalVariant = 'info' | 'success' | 'error';

export interface AlertOptions {
  title?: string;
  variant?: ModalVariant;
  confirmLabel?: string;
}

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
}

type ModalRequest =
  | {
      type: 'alert';
      message: string;
      options?: AlertOptions;
      resolve: () => void;
    }
  | {
      type: 'confirm';
      message: string;
      options?: ConfirmOptions;
      resolve: (confirmed: boolean) => void;
    };

type ActiveModal = ModalRequest;

let pushModal: ((request: ModalRequest) => void) | null = null;

export const registerModalHandler = (handler: (request: ModalRequest) => void) => {
  pushModal = handler;
};

export const unregisterModalHandler = () => {
  pushModal = null;
};

export const appAlert = (message: string, options?: AlertOptions): Promise<void> =>
  new Promise(resolve => {
    if (!pushModal) {
      window.alert(message);
      resolve();
      return;
    }
    pushModal({ type: 'alert', message, options, resolve });
  });

export const appConfirm = (message: string, options?: ConfirmOptions): Promise<boolean> =>
  new Promise(resolve => {
    if (!pushModal) {
      resolve(window.confirm(message));
      return;
    }
    pushModal({ type: 'confirm', message, options, resolve });
  });

const defaultTitles: Record<ModalVariant, string> = {
  info: 'Notice',
  success: 'Success',
  error: 'Something went wrong',
};

const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<ActiveModal | null>(null);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  const handleAlert = useCallback(() => {
    if (!modal || modal.type !== 'alert') return;
    modal.resolve();
    closeModal();
  }, [closeModal, modal]);

  const handleConfirm = useCallback(
    (confirmed: boolean) => {
      if (!modal || modal.type !== 'confirm') return;
      modal.resolve(confirmed);
      closeModal();
    },
    [closeModal, modal]
  );

  useEffect(() => {
    registerModalHandler(request => {
      setModal(request);
    });
    return unregisterModalHandler;
  }, []);

  useEffect(() => {
    if (!modal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (modal.type === 'alert') {
        handleAlert();
      } else {
        handleConfirm(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleAlert, handleConfirm, modal]);

  const variant: ModalVariant =
    modal?.type === 'alert'
      ? modal.options?.variant || 'info'
      : modal?.type === 'confirm'
        ? modal.options?.variant || 'info'
        : 'info';

  const title =
    modal?.type === 'alert'
      ? modal.options?.title || defaultTitles[variant]
      : modal?.type === 'confirm'
        ? modal.options?.title || 'Confirm'
        : '';

  return (
    <>
      {children}
      {modal && (
        <div className="app-modal" role="presentation">
          <button
            type="button"
            className="app-modal__backdrop"
            aria-label="Close dialog"
            onClick={() =>
              modal.type === 'alert' ? handleAlert() : handleConfirm(false)
            }
          />
          <div
            className={`app-modal__dialog app-modal__dialog--${variant}`}
            role={modal.type === 'alert' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby="app-modal-title"
            aria-describedby="app-modal-message"
          >
            <h2 id="app-modal-title" className="app-modal__title">
              {title}
            </h2>
            <p id="app-modal-message" className="app-modal__message">
              {modal.message}
            </p>
            <div className="app-modal__actions">
              {modal.type === 'confirm' && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handleConfirm(false)}
                >
                  {modal.options?.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                className={`btn ${
                  modal.type === 'confirm' ? 'btn--danger' : 'btn--primary'
                }`}
                onClick={() =>
                  modal.type === 'alert' ? handleAlert() : handleConfirm(true)
                }
                autoFocus
              >
                {modal.type === 'alert'
                  ? modal.options?.confirmLabel || 'OK'
                  : modal.options?.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModalProvider;
