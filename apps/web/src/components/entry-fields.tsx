// The same three labeled rows on every entry, with an explicit empty value (tasks/lessons.md).
// Shared by the journal and the appointment summary, which shows entries in the journal's layout.
export function EntryFields({
  entry,
}: {
  entry: {
    food: string | null;
    symptom: string | null;
    severity: string | null;
    context: string[];
  };
}) {
  const none = <dd className="v none">None noted</dd>;
  return (
    <dl className="fields">
      <dt className="k">Food</dt>
      {entry.food ? <dd className="v">{entry.food}</dd> : none}
      <dt className="k">Symptoms</dt>
      {entry.symptom ? (
        <dd className="v">
          {entry.symptom}
          {entry.severity && (
            <>
              {" "}
              <span className="sev-note">· Severity {entry.severity}</span>
            </>
          )}
        </dd>
      ) : (
        none
      )}
      <dt className="k">Context</dt>
      {entry.context.length > 0 ? (
        <dd className="v">
          {entry.context.map((c) => c[0]?.toUpperCase() + c.slice(1)).join(", ")}
        </dd>
      ) : (
        <dd className="v none">None</dd>
      )}
    </dl>
  );
}
