type ToastType = "success" | "error" | "info" | "warning";

interface ToastEvent {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

const TOAST_EVENT = "app:toast";

function emit(type: ToastType, message: string, duration = 4000) {
  const id = Math.random().toString(36).slice(2, 9);
  window.dispatchEvent(
    new CustomEvent<ToastEvent>(TOAST_EVENT, {
      detail: { id, type, message, duration },
    })
  );
}

export const toast = {
  success: (msg: string, duration?: number) => emit("success", msg, duration),
  error: (msg: string, duration?: number) => emit("error", msg, duration ?? 6000),
  info: (msg: string, duration?: number) => emit("info", msg, duration),
  warning: (msg: string, duration?: number) => emit("warning", msg, duration ?? 5000),
};

export { TOAST_EVENT, type ToastEvent };
