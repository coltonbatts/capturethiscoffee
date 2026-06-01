"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Avatar,
  EmptyState,
  Field,
  Panel,
  cardClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
import { createPersonRecord, loadCoffeeData } from "@/lib/data";
import type { CoffeeData, PersonType } from "@/lib/types";

const personTypes: PersonType[] = ["client_contact", "agency", "crew", "guest"];

export default function PeoplePage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "crew" as PersonType,
    role: "",
    department: "",
    company: "",
    usual_order: "",
    dietary_notes: "",
  });
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
      setForm({
        name: "",
        type: "crew",
        role: "",
        department: "",
        company: "",
        usual_order: "",
        dietary_notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add person.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="People">
      <form onSubmit={addPerson} className="mb-4 grid gap-3">
        <Panel className="grid gap-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Name"
              />
            </Field>
            <Field label="Type">
              <select
                className={inputClass}
                value={form.type}
                onChange={(event) =>
                  setForm({ ...form, type: event.target.value as PersonType })
                }
              >
                {personTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
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
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="Producer, DP"
              />
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
                placeholder="Camera, Client"
              />
            </Field>
          </div>
          <Field label="Usual order">
            <input
              className={inputClass}
              value={form.usual_order}
              onChange={(event) =>
                setForm({ ...form, usual_order: event.target.value })
              }
              placeholder="Iced oat latte, medium"
            />
          </Field>
          <button type="submit" className={primaryButtonClass}>
            <Plus size={18} aria-hidden="true" />
            {saving ? "Adding…" : "Add person"}
          </button>
        </Panel>
      </form>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
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
            <Panel key={item} className="h-28 animate-pulse bg-white/70 p-4" />
          ))
        ) : !people.length ? (
          <EmptyState title="No people found" description="Add someone or clear your search." />
        ) : null}
        {people.map((person) => (
          <article key={person.id} className={`${cardClass} flex gap-3`}>
            <Avatar person={person} />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{person.name}</h2>
              <p className="truncate text-sm text-zinc-600">
                {[person.role, person.department].filter(Boolean).join(" · ") ||
                  person.type.replace("_", " ")}
              </p>
              <p className="mt-2 text-sm leading-5 text-zinc-700">
                {person.usual_order || "No usual order"}
              </p>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
