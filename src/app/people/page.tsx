"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PersonPhotoField } from "@/components/person-photo-field";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import {
  createPersonRecord,
  loadCoffeeData,
  updatePersonRecord,
} from "@/lib/data";
import {
  emptyPersonForm,
  groupSuggestions,
  personToForm,
  personTypeLabel,
  personTypes,
  type PersonForm,
} from "@/lib/people";
import type { CoffeeData, Person } from "@/lib/types";

export default function PeoplePage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadCoffeeData()
      .then((next) => {
        if (mounted) setData(next);
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
      const next = await createPersonRecord(data, form);
      setData(next);
      setForm(emptyPersonForm("crew"));
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
      const next = await updatePersonRecord(data, editingPerson.id, editForm);
      setData(next);
      setEditingPerson(null);
      setEditForm(emptyPersonForm("crew"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update person.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="People" requireAuth>
      <form onSubmit={addPerson} className="mb-4 grid gap-3">
        <Panel className="grid gap-3 p-4">
          <PersonFields form={form} onChange={setForm} showActive={false} />
          <button type="submit" className={primaryButtonClass}>
            <Plus size={18} aria-hidden="true" />
            {saving ? "Adding…" : "Add person"}
          </button>
        </Panel>
      </form>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <input
        className={`${inputClass} mb-3`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people"
        aria-label="Search people"
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!data ? (
          [0, 1, 2, 3, 4, 5].map((item) => (
            <Panel key={item} className="h-28 animate-pulse bg-zinc-100 p-4" />
          ))
        ) : !people.length ? (
          <EmptyState title="No people found" description="Add someone or clear your search." />
        ) : null}
        {people.map((person) => (
          <article key={person.id} className={`${cardClass} flex gap-3`}>
            <Avatar person={person} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{person.name}</h2>
              <p className="truncate text-sm text-zinc-600">
                {[person.role, person.department].filter(Boolean).join(" · ") ||
                  personTypeLabel(person.type)}
              </p>
              {person.company ? (
                <p className="truncate text-sm text-zinc-500">{person.company}</p>
              ) : null}
              <p className="mt-2 text-sm leading-5 text-zinc-700">
                {person.usual_order || "No usual order"}
              </p>
            </div>
            <button
              type="button"
              className={`${secondaryButtonClass} size-11 shrink-0 px-0`}
              onClick={() => {
                setEditingPerson(person);
                setEditForm(personToForm(person));
              }}
              aria-label={`Edit ${person.name}`}
            >
              <Pencil size={18} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      {editingPerson ? (
        <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3">
          <form
            onSubmit={savePersonEdit}
            role="dialog"
            aria-modal="true"
            aria-label="Edit person"
            className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-xl border border-black bg-white p-5"
          >
            <h2 className="text-lg font-semibold">Edit person</h2>
            <PersonFields form={editForm} onChange={setEditForm} showActive />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingPerson(null);
                  setEditForm(emptyPersonForm("crew"));
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? "Saving…" : "Save person"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
            placeholder="Name"
          />
        </Field>
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      <Field label="Company">
        <input
          className={inputClass}
          value={form.company}
          onChange={(event) => onChange({ ...form, company: event.target.value })}
          placeholder="Capture This, agency, client"
        />
      </Field>
      <PersonPhotoField
        value={form.photo_url}
        personName={form.name}
        onChange={(photo_url) => onChange({ ...form, photo_url })}
      />
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
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-20 py-3`}
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          placeholder="Identification or relationship notes"
        />
      </Field>
      {showActive ? (
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-500 px-3.5 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => onChange({ ...form, active: event.target.checked })}
            className="size-4 accent-black"
          />
          Active
        </label>
      ) : null}
      <datalist id="person-group-suggestions">
        {groupSuggestions.map((group) => (
          <option key={group} value={group} />
        ))}
      </datalist>
    </>
  );
}
