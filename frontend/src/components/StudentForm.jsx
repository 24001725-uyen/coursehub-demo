export default function StudentForm({
  draftId,
  value,
  studentId,
  busy = false,
  loading = false,
  disabled = false,
  onDraftChange,
  onChange,
  onSubmit,
  onRefresh,
}) {
  const inputValue = draftId !== undefined ? draftId : (value ?? "");
  const isBusy = busy || disabled;
  const isRefreshDisabled = isBusy || loading;

  function handleChange(e) {
    if (onDraftChange) {
      onDraftChange(e.target.value);
    } else if (onChange) {
      onChange(e);
    }
  }

  return (
    <>
      <form className="student-form" onSubmit={onSubmit}>
        <label htmlFor="student-id">Mã sinh viên</label>
        <input
          id="student-id"
          value={inputValue}
          maxLength={8}
          required
          inputMode="numeric"
          onChange={handleChange}
          disabled={isBusy}
        />
        <button type="submit" disabled={isBusy}>
          Xem đăng ký
        </button>
        <button
          type="button"
          className="secondary"
          disabled={isRefreshDisabled}
          onClick={onRefresh}
        >
          Tải lại dữ liệu
        </button>
      </form>
      {studentId !== undefined && (
        <p className="muted">
          Dữ liệu đang xem: <strong>{studentId}</strong>. Mã mẫu: 22000001–22000004.
        </p>
      )}
    </>
  );
}

