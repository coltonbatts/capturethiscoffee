"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PersonPhotoField } from "@/components/person-photo-field";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  Sheet,
  alertErrorClass,
  inputClass,
  pageHeaderClass,
  pageIntroClass,
  pageTitleClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  createPersonAction,
  updatePersonAction,
} from "@/app/operator-actions";
import { unwrapOperatorAction } from "@/lib/operator-inputs";
import {
  emptyPersonForm,
  groupSuggestions,
  personToForm,
  personTypeLabel,
  personTypes,
  type PersonForm,
} from "@/lib/people";
import type { CoffeeData, Person } from "@/lib/types";

export function PeopleClient({
  initialData,
  initialError = "",
}: {
  initialData: CoffeeData | null;
  initialError?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<CoffeeData | null>(initialData);
  const [previousInitialData, setPreviousInitialData] = useState(initialData);
  const [previousInitialError, setPreviousInitialError] = useState(initialError);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [error, setError] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  if (
    initialData !== previousInitialData ||
    initialError !== previousInitialError
  ) {
    setPreviousInitialData(initialData);
    setPreviousInitialError(initialError);
    setData(initialData);
    setError(initialError);
  }

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.people || []).filter((person) => {
      if (!needle) return true;
      return [person.name, person.role, person.department, person.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, query]);

  async function addPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !form.name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const person = unwrapOperatorAction(await createPersonAction(form));
      setData({ ...data, people: [person, ...data.people] });
      setForm(emptyPersonForm("crew"));
      setShowAddForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add person.");
    } finally {
      setSaving(false);
    }
  }

  async function savePersonEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !editingPerson || !editForm.name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const person = unwrapOperatorAction(
        await updatePersonAction(editingPerson.id, editForm),
      );
      setData({
        ...data,
        people: data.people.map((item) =>
          item.id === person.id ? person : item,
        ),
      });
      setEditingPerson(null);
      setEditForm(emptyPersonForm("crew"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update person.");
    } finally {
      setSaving(false);
    }
  }

  function closeAddForm() {
    setShowAddForm(false);
    setForm(emptyPersonForm("crew"));
  }

  function closeEditForm() {
    setEditingPerson(null);
    setEditForm(emptyPersonForm("crew"));
  }

  return (
    <AppShell title="Setup" breadcrumbs={[{ label: "Setup" }]} requireAuth>
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-3xl">
        <header className={pageHeaderClass}>
          <h1 className={pageTitleClass}>People</h1>
          <p className={pageIntroClass}>
            Create or edit crew members, guests, and client contacts. Manage their usual coffee orders.
          </p>
        </header>

        {error ? (
          <div className={`${alertErrorClass} mb-4`} role="alert">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex min-w-0 gap-3">
          <input
            className={`${inputClass} flex-1`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people..."
            aria-label="Search people"
          />
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={primaryButtonClass + " shrink-0"}
          >
            <Plus size={18} aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!data ? (
            [0, 1, 2, 3, 4, 5].map((item) => (
              <Panel key={item} className="h-28 animate-pulse bg-black/[0.04] p-4" />
            ))
          ) : !people.length ? (
            <div className="sm:col-span-2">
              <EmptyState title="No people found" description="Add someone or clear your search." />
            </div>
          ) : null}
          {data &&
            people.map((person) => (
              <article
                key={person.id}
                className="flex min-w-0 gap-4 rounded-xl border border-black/15 bg-[#fffdf8] p-5 transition-[border-color,background-color] hover:border-black/35 hover:bg-white"
              >
                <Avatar person={person} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold tracking-[-0.025em] text-black">{person.name}</h2>
                  <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                    {[person.role, person.department].filter(Boolean).join(" · ") ||
                      personTypeLabel(person.type)}
                  </p>
                  {person.company && (
                    <p className="truncate text-xs font-semibold text-zinc-400 mt-0.5">{person.company}</p>
                  )}
                  <p className="mt-2.5 text-sm font-semibold text-zinc-700 truncate">
                    {person.usual_order || "No usual order"}
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-transparent text-black transition hover:border-black hover:bg-black hover:text-white active:translate-y-px"
                  onClick={() => {
                    setEditingPerson(person);
                    setEditForm(personToForm(person));
                  }}
                  aria-label={`Edit ${person.name}`}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
              </article>
            ))}
        </div>
      </div>

      {showAddForm && (
        <Sheet
          title="Add person"
          asForm
          onSubmit={addPerson}
          onClose={closeAddForm}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={closeAddForm} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? "Adding…" : "Add person"}
              </button>
            </div>
          }
        >
          <PersonFields form={form} onChange={setForm} showActive={false} />
        </Sheet>
      )}

      {editingPerson && (
        <Sheet
          title="Edit person"
          asForm
          onSubmit={savePersonEdit}
          onClose={closeEditForm}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={closeEditForm} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? "Saving…" : "Save person"}
              </button>
            </div>
          }
        >
          <PersonFields form={editForm} onChange={setEditForm} showActive />
        </Sheet>
      )}
    </AppShell>
  );
}

function PersonFields({
  form,
  onChange,
  showActive,
}: {
  form: PersonForm;
  onChange: (form: PersonForm) => void;
  showActive: boolean;
}) {
  return (
    <>
      <Field label="Name">
        <input
          className={inputClass}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Name"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Type">
          <select
            className={inputClass}
            value={form.type}
            onChange={(event) =>
              onChange({ ...form, type: event.target.value as PersonForm["type"] })
            }
          >
            {personTypes.map((type) => (
              <option key={type} value={type}>
                {personTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <input
            className={inputClass}
            value={form.role}
            onChange={(event) => onChange({ ...form, role: event.target.value })}
            placeholder="Producer, DP"
          />
        </Field>
        <Field label="Department/group">
          <input
            className={inputClass}
            list="person-group-suggestions"
            value={form.department}
            onChange={(event) =>
              onChange({ ...form, department: event.target.value })
            }
            placeholder="Camera, Client"
          />
        </Field>
        <Field label="Company">
          <input
            className={inputClass}
            value={form.company}
            onChange={(event) => onChange({ ...form, company: event.target.value })}
            placeholder="Capture This, agency"
          />
        </Field>
      </div>
      <Field label="Usual order">
        <input
          className={inputClass}
          value={form.usual_order}
          onChange={(event) =>
            onChange({ ...form, usual_order: event.target.value })
          }
          placeholder="Iced oat latte, medium"
        />
      </Field>
      <Field label="Dietary notes">
        <input
          className={inputClass}
          value={form.dietary_notes}
          onChange={(event) =>
            onChange({ ...form, dietary_notes: event.target.value })
          }
          placeholder="Oat milk, dairy-free"
        />
      </Field>
      <PersonPhotoField
        value={form.photo_url}
        personName={form.name}
        onChange={(photo_url) => onChange({ ...form, photo_url })}
      />
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-16 py-2.5`}
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          placeholder="Identification or relationship notes"
        />
      </Field>
      {showActive && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-black/20 bg-[#fffdf8] px-3 py-2.5 text-sm font-medium text-black">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => onChange({ ...form, active: event.target.checked })}
            className="size-4 shrink-0 accent-black"
          />
          <span>Active</span>
        </label>
      )}
      <datalist id="person-group-suggestions">
        {groupSuggestions.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
    </>
  );
}
