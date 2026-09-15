import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { newId, type PeriodCategory } from "../domain/model";
import {
  deletePeriodCategory,
  savePeriodCategory,
} from "../domain/periodCategories";
import type { SettingsProps } from "./Setup";
import { Field, Modal, Notice } from "./ui";

export function PeriodCategories({
  project,
  update,
  onClose,
}: SettingsProps & { onClose: () => void }) {
  const [draft, setDraft] = useState<PeriodCategory | null>(null);
  const [deleting, setDeleting] = useState<PeriodCategory | null>(null);
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const existing =
    draft &&
    project.periodCategories.find((category) => category.id === draft.id);
  const used = deleting
    ? project.periods.filter((period) => period.categoryId === deleting.id)
        .length
    : 0;
  const replacements = project.periodCategories.filter(
    (category) => category.id !== deleting?.id,
  );
  const back = () => {
    setDraft(null);
    setDeleting(null);
    setError("");
  };
  return (
    <Modal
      title={
        draft
          ? existing
            ? "Edit category"
            : "Add category"
          : deleting
            ? "Delete category"
            : "Period categories"
      }
      onClose={onClose}
    >
      <div className="sr-only" role="status">
        {announcement}
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {draft ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              update((current) => savePeriodCategory(current, draft));
              setAnnouncement(`${draft.name.trim()} saved.`);
              back();
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <Field
            label="Category name"
            hint="For example, Tutor time, Assembly or Study session."
          >
            <input
              autoFocus
              required
              maxLength={80}
              value={draft.name}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                setError("");
              }}
            />
          </Field>
          <label className="checkbox-label category-permission">
            <input
              type="checkbox"
              role="switch"
              checked={draft.allowSubjects}
              onChange={(event) =>
                setDraft({ ...draft, allowSubjects: event.target.checked })
              }
            />
            <span>
              Allow subjects
              <small>
                Subjects can be placed in periods using this category.
              </small>
            </span>
          </label>
          <p className="muted">
            With this switched off, periods show their names automatically.
            Saved lessons return if you switch it back on.
          </p>
          {existing &&
            project.periods.some(
              (period) =>
                period.categoryId === existing.id &&
                period.name === existing.name,
            ) && (
              <p className="muted">
                Periods named “{existing.name}” will also follow this category's
                new name.
              </p>
            )}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={back}>
              Cancel
            </button>
            <button type="submit" className="button primary">
              <Check size={17} />
              Save category
            </button>
          </div>
        </form>
      ) : deleting ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              update((current) =>
                deletePeriodCategory(current, deleting.id, replacement),
              );
              setAnnouncement(`${deleting.name} deleted.`);
              back();
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <p>
            Delete <strong>{deleting.name}</strong>?
          </p>
          {used > 0 ? (
            <>
              <p className="muted">
                {used} {used === 1 ? "period uses" : "periods use"} this
                category. Choose a replacement to keep those periods and their
                saved lessons.
              </p>
              {replacements.length ? (
                <Field label="Replacement category">
                  <select
                    value={replacement}
                    onChange={(event) => setReplacement(event.target.value)}
                  >
                    {replacements.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Notice>Add another category before deleting this one.</Notice>
              )}
              {replacements.length > 0 && (
                <p className="muted">
                  These periods will follow the replacement category's Allow
                  subjects setting.
                </p>
              )}
            </>
          ) : (
            <p className="muted">No periods use this category.</p>
          )}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={back}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={used > 0 && !replacements.length}
            >
              <Trash2 size={17} />
              {used ? "Replace and delete" : "Delete category"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="muted">
            Manage the choices in each period's Category dropdown. Allow
            subjects applies to every period using that category.
          </p>
          <div className="category-list-actions">
            <button
              type="button"
              className="button primary"
              disabled={project.periodCategories.length >= 40}
              onClick={() => {
                setError("");
                setDraft({ id: newId(), name: "", allowSubjects: false });
              }}
            >
              <Plus size={17} />
              Add category
            </button>
          </div>
          <div className="category-list">
            {project.periodCategories.map((category) => {
              const count = project.periods.filter(
                (period) => period.categoryId === category.id,
              ).length;
              return (
                <article
                  className="category-row"
                  key={category.id}
                  aria-label={category.name}
                >
                  <div>
                    <h3>{category.name}</h3>
                    <span className="muted small">
                      {count} {count === 1 ? "period" : "periods"}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${category.name} category`}
                      title="Edit category"
                      onClick={() => {
                        setError("");
                        setDraft(category);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${category.name} category`}
                      title="Delete category"
                      onClick={() => {
                        setDeleting(category);
                        setReplacement(
                          project.periodCategories.find(
                            (candidate) => candidate.id !== category.id,
                          )?.id || "",
                        );
                        setError("");
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <label className="checkbox-label category-permission">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label={`Allow subjects for ${category.name}`}
                      checked={category.allowSubjects}
                      onChange={(event) => {
                        update((current) =>
                          savePeriodCategory(current, {
                            ...category,
                            allowSubjects: event.target.checked,
                          }),
                        );
                        setAnnouncement(
                          `${category.name}: subjects ${event.target.checked ? "allowed" : "switched off"}.`,
                        );
                      }}
                    />
                    <span>Allow subjects</span>
                  </label>
                </article>
              );
            })}
          </div>
          {!project.periodCategories.length && (
            <p className="muted">
              Add your first category to start creating periods.
            </p>
          )}
          <p className="muted small category-note">
            Switching off subjects shows each period's name. Saved lessons
            return when switched on again.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
