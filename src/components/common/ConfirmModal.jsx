import "./ConfirmModal.css";

/**
 * Reusable confirmation modal component.
 *
 * Props:
 * - open: controls visibility of the modal.
 * - title: modal heading text.
 * - message: body message displayed to the user.
 * - confirmText: label for the confirm button.
 * - cancelText: label for the cancel button.
 * - danger: applies danger styling for destructive actions.
 * - onConfirm: callback triggered when user confirms.
 * - onCancel: callback triggered when user cancels or closes modal.
 */
export default function ConfirmModal({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Yes, continue",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  // Do not render anything if modal is not open.
  if (!open) return null;

  return (
    <div
      className="cmOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Clicking the overlay (outside the card) closes the modal.
      onClick={onCancel}
    >
      {/* Stop click propagation so clicking inside the modal does not close it */}
      <div className="cmCard" onClick={(e) => e.stopPropagation()}>
        <div className="cmHeader">
          <h3 className="cmTitle">{title}</h3>
        </div>

        <div className="cmBody">
          <p className="cmMessage">{message}</p>
        </div>

        <div className="cmActions">
          {/* Cancel button */}
          <button className="cmBtn" type="button" onClick={onCancel}>
            {cancelText}
          </button>

          {/* Confirm button (styled as danger for destructive actions) */}
          <button
            className={danger ? "cmBtn cmDanger" : "cmBtn cmPrimary"}
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
