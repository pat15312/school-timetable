export function CalendarOptions({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox-label calendar-options">
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Include fixed periods
        <small>
          Include activities such as registration, breaks, and lunch in both the
          preview and calendar file.
        </small>
      </span>
    </label>
  );
}
