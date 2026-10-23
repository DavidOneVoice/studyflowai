import { useId } from "react";
import AccessibleModal from "./AccessibleModal";
import "./ConfirmModal.css";

export default function ConfirmModal({
  open,
  title = "Confirm Action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const id = useId();

  return (
    <AccessibleModal
      open={open}
      onClose={onCancel}
      labelledBy={`${id}-title`}
      describedBy={`${id}-message`}
      overlayClassName="cmOverlay"
      className="cmCard"
    >
      <div className="cmHeader">
        <h3 className="cmTitle" id={`${id}-title`}>{title}</h3>
      </div>

      <div className="cmBody">
        <p className="cmMessage" id={`${id}-message`}>{message}</p>
        {error && <p className="appAlert" role="alert">{error}</p>}
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
    </AccessibleModal>
  );
}
