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
  Sheet,
  inputClass,
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

// Custom premium buttons matching our Capture This Coffee neo-brutalist / studio aesthetic
const customPrimaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-black px-4 text-white font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition active:translate-y-px disabled:opacity-50";

const customSecondaryBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-black bg-white px-4 text-black font-black text-sm uppercase tracking-wider hover:bg-zinc-100 transition active:translate-y-px disabled:opacity-50";

export default function PeoplePage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<PersonForm>(emptyPersonForm("crew"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

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
      setShowAddForm(false);
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
      {/* Center Layout Container for a Clean Studio Vibe */}
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0 md:max-w-3xl">
        <section className="mb-6 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000]">
          <h1 className="text-2xl font-black uppercase tracking-tight text-black">People Setup</h1>
          <p className="mt-1 text-sm font-medium leading-relaxed text-zinc-600">
            Create or edit crew members, guests, and client contacts. Manage their usual coffee orders.
          </p>
        </section>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4 flex min-w-0 gap-3">
          <input
            className={`${inputClass} flex-1 rounded-lg border-[3px] border-black px-3.5 text-base font-medium`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people..."
            aria-label="Search people"
          />
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className={customPrimaryBtn + " shrink-0"}
          >
            <Plus size={18} aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!data ? (
            [0, 1, 2, 3, 4, 5].map((item) => (
              <Panel key={item} className="h-28 animate-pulse bg-zinc-100 p-4 border-[3px] border-black shadow-[4px_4px_0_#000]" />
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
                className="flex gap-4 rounded-xl border-[3px] border-black bg-white p-5 shadow-[4px_4px_0_#000] hover:shadow-[6px_6px_0_#000] transition-[transform,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000] min-w-0"
              >
                <Avatar person={person} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-black uppercase tracking-tight text-black">{person.name}</h2>
                  <p className="truncate text-xs font-bold uppercase text-zinc-500 mt-0.5">
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
                  className="flex h-11 w-11 items-center justify-center rounded-lg border-[3px] border-black bg-white text-black hover:bg-zinc-100 transition active:translate-y-px shrink-0"
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
              <button type="button" onClick={closeAddForm} className={customSecondaryBtn}>
                Cancel
              </button>
              <button type="submit" className={customPrimaryBtn} disabled={saving}>
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
              <button type="button" onClick={closeEditForm} className={customSecondaryBtn}>
                Cancel
              </button>
              <button type="submit" className={customPrimaryBtn} disabled={saving}>
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
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-[3px] border-black bg-white px-3 py-2.5 text-sm font-black text-black">
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
