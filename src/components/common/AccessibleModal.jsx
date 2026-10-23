import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./AccessibleModal.css";

const modalStack = [];
let previousBodyOverflow = "";

function focusableElements(dialog) {
  return Array.from(
    dialog.querySelectorAll(
      'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getClientRects().length > 0 &&
      !element.closest("[hidden], [inert]") &&
      window.getComputedStyle(element).visibility !== "hidden",
  );
}

/** Keep dialogs outside animated pages and contain keyboard focus while open. */
export default function AccessibleModal({
  open,
  onClose,
  label,
  labelledBy,
  describedBy,
  overlayClassName = "",
  className = "",
  children,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!dialog) return;

    if (modalStack.length === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    modalStack.push(dialog);

    const focusFirst = () => (focusableElements(dialog)[0] || dialog).focus();
    focusFirst();

    function onKeyDown(event) {
      if (modalStack.at(-1) !== dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = focusableElements(dialog);
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !elements.includes(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !elements.includes(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(event) {
      if (modalStack.at(-1) === dialog && !dialog.contains(event.target)) {
        focusFirst();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const index = modalStack.indexOf(dialog);
      if (index !== -1) modalStack.splice(index, 1);
      if (modalStack.length === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`modalOverlay ${overlayClassName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`modalDialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
