import "./ConfirmModal.css";

export default function ConfirmModal({
  open,
  title = "Confirm Action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="cmOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div className="cmCard" onClick={(e) => e.stopPropagation()}>
        <div className="cmHeader">
          <h3 className="cmTitle">{title}</h3>
        </div>

        <div className="cmBody">
          <p className="cmMessage">{message}</p>
        </div>

        <div className="cmActions">
          <button className="cmBtn" type="button" onClick={onCancel}>
            {cancelText}
          </button>

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
