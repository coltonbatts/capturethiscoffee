"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  Field,
  Panel,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
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
      <Panel className="mb-4 p-4">
        <p className="production-kicker text-zinc-500">Client file</p>
        <h1 className="text-2xl font-black uppercase tracking-wider">Clients</h1>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Save client names and notes used when creating a production run.
        </p>
      </Panel>
      <form
        onSubmit={addClient}
        className="mb-4 grid gap-3 border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
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
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!data ? (
          [0, 1, 2].map((item) => (
            <Panel key={item} className="h-28 animate-pulse bg-white/70 p-4" />
          ))
        ) : !data.clients.length ? (
          <EmptyState
            title="No clients yet"
            description="Add a client to make production setup faster."
          />
        ) : null}
        {data?.clients.map((client) => {
          const peopleCount = data.client_people.filter(
            (item) => item.client_id === client.id && item.active,
          ).length;

          return (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="block border border-zinc-300 bg-white/95 p-4 shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:border-black"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wide">{client.name}</h2>
                  <p className="text-sm text-zinc-600">
                    {peopleCount} saved contact{peopleCount === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-emerald-900">
                  {client.active ? "Active" : "Inactive"}
                </span>
              </div>
              {client.notes ? (
                <p className="mt-3 text-sm leading-6 text-zinc-700">{client.notes}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
