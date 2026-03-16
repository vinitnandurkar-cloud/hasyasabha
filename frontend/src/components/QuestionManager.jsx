import { useState } from "react";

const STATUS_COLOR = { pending: "#78909C", active: "#FF6B00", done: "#66BB6A" };
const STATUS_LABEL = { pending: "Pending", active: "● Live", done: "Done" };

export default function QuestionManager({
  questions,
  activeQuestionId,
  onActivate,
  onDelete,
  onEdit,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const startEdit = (q) => {
    setEditingId(q.id);
    setEditText(q.text);
  };

  const saveEdit = (id) => {
    if (editText.trim()) onEdit(id, editText.trim());
    setEditingId(null);
  };

  if (questions.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyIcon}>📝</p>
        <p>No questions yet. Add one above.</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {questions.map((q, idx) => {
        const isActive = q.id === activeQuestionId;
        return (
          <div
            key={q.id}
            style={{
              ...styles.card,
              borderColor: isActive ? "#FF6B00" : "rgba(255,255,255,0.2)",
              background: isActive
                ? "rgba(255,107,0,0.18)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <div style={styles.cardTop}>
              <span style={styles.qNumber}>Q{idx + 1}</span>
              <span
                style={{
                  ...styles.statusBadge,
                  background: STATUS_COLOR[q.status],
                }}
              >
                {STATUS_LABEL[q.status]}
              </span>
            </div>

            {editingId === q.id ? (
              <div style={styles.editBlock}>
                <textarea
                  style={styles.editInput}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  autoFocus
                />
                <div style={styles.editActions}>
                  <button style={styles.saveBtn} onClick={() => saveEdit(q.id)}>
                    Save
                  </button>
                  <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={styles.questionText}>{q.text}</p>
                {q.textMr && <p style={styles.questionTextMr}>{q.textMr}</p>}
              </div>
            )}

            <div style={styles.actions}>
              {q.status !== "active" && (
                <button style={styles.activateBtn} onClick={() => onActivate(q.id)}>
                  ▶ Activate
                </button>
              )}
              {q.status === "active" && (
                <span style={styles.liveIndicator}>🔴 Active</span>
              )}
              <button style={styles.editBtn} onClick={() => startEdit(q)}>
                ✏ Edit
              </button>
              <button style={styles.deleteBtn} onClick={() => onDelete(q.id)}>
                🗑 Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  list: { display: "flex", flexDirection: "column", gap: "10px" },
  empty: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "14px",
    textAlign: "center",
    marginTop: "30px",
    lineHeight: "1.8",
  },
  emptyIcon: { fontSize: "36px", marginBottom: "6px" },
  card: {
    border: "2px solid",
    borderRadius: "14px",
    padding: "14px 16px",
    transition: "all 0.2s",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  qNumber: {
    fontSize: "12px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "1px",
  },
  statusBadge: {
    fontSize: "11px",
    color: "white",
    padding: "3px 10px",
    borderRadius: "10px",
    fontWeight: "700",
  },
  questionText: {
    margin: "0 0 4px 0",
    fontSize: "14px",
    color: "white",
    lineHeight: "1.5",
  },
  questionTextMr: {
    margin: "0 0 10px 0",
    fontSize: "13px",
    color: "rgba(255,210,120,0.85)",
    lineHeight: "1.5",
    fontStyle: "italic",
  },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  activateBtn: {
    background: "#FF6B00",
    color: "white",
    border: "none",
    padding: "7px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
  },
  liveIndicator: {
    color: "#FF6B00",
    fontWeight: "700",
    fontSize: "13px",
    alignSelf: "center",
  },
  editBtn: {
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "none",
    padding: "7px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "13px",
  },
  deleteBtn: {
    background: "rgba(198,40,40,0.3)",
    color: "#EF9A9A",
    border: "none",
    padding: "7px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "13px",
  },
  editBlock: { marginBottom: "10px" },
  editInput: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "7px",
    border: "none",
    fontFamily: "inherit",
    fontSize: "14px",
    boxSizing: "border-box",
    resize: "vertical",
    outline: "none",
  },
  editActions: { display: "flex", gap: "8px", marginTop: "6px" },
  saveBtn: {
    background: "#66BB6A",
    color: "white",
    border: "none",
    padding: "7px 16px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "700",
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.15)",
    color: "white",
    border: "none",
    padding: "7px 16px",
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "13px",
  },
};
