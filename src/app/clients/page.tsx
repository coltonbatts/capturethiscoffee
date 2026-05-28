"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Field, inputClass, primaryButtonClass } from "@/components/ui";
import { createClientRecord, loadCoffeeData } from "@/lib/data";
import type { CoffeeData } from "@/lib/types";

export default function ClientsPage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
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

  async function addClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const next = await createClientRecord(data, { name, notes });
      setData(next);
      setName("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Clients" eyebrow="Database">
      <form
        onSubmit={addClient}
        className="mb-4 grid gap-3 rounded-2xl border border-stone-300 bg-stone-50 p-4 shadow-sm"
      >
        <Field label="Add client">
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Client name"
          />
        </Field>
        <Field label="Notes">
          <input
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Preferences or relationship notes"
          />
        </Field>
        <button type="submit" className={primaryButtonClass}>
          <Plus size={18} aria-hidden="true" />
          {saving ? "Adding" : "Add client"}
        </button>
      </form>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {data?.clients.map((client) => {
          const peopleCount = data.client_people.filter(
            (item) => item.client_id === client.id && item.active,
          ).length;

          return (
            <article
              key={client.id}
              className="rounded-2xl border border-stone-300 bg-stone-50 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{client.name}</h2>
                  <p className="text-sm text-stone-600">
                    {peopleCount} saved contact{peopleCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
                  {client.active ? "Active" : "Inactive"}
                </span>
              </div>
              {client.notes ? (
                <p className="mt-3 text-sm leading-6 text-stone-700">{client.notes}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
