"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  EmptyState,
  Field,
  Panel,
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { createClientRecord, loadCoffeeData } from "@/lib/data";
import type { CoffeeData } from "@/lib/types";

export default function ClientsPage() {
  const [data, setData] = useState<CoffeeData | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
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
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Clients" requireAuth>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className={primaryButtonClass}
        >
          <Plus size={18} aria-hidden="true" />
          Add client
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!data ? (
          [0, 1, 2].map((item) => (
            <Panel key={item} className="h-28 animate-pulse bg-zinc-100 p-4" />
          ))
        ) : !data.clients.length ? (
          <EmptyState title="No clients yet" description="Add a client to use on new shoots." />
        ) : null}
        {data?.clients.map((client) => {
          const peopleCount = data.client_people.filter(
            (item) => item.client_id === client.id && item.active,
          ).length;

          return (
            <Link key={client.id} href={`/clients/${client.id}`} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{client.name}</h2>
                  <p className="text-sm text-zinc-600">
                    {peopleCount} contact{peopleCount === 1 ? "" : "s"}
                  </p>
                </div>
                {client.active ? (
                  <span className="rounded-md border border-zinc-500 bg-white px-2.5 py-1 text-xs font-black text-black">
                    Active
                  </span>
                ) : null}
              </div>
              {client.notes ? (
                <p className="mt-3 text-sm leading-6 text-zinc-700">{client.notes}</p>
              ) : null}
            </Link>
          );
        })}
      </div>

      {showAddForm ? (
        <div className="fixed inset-0 z-50 grid items-end bg-black/55 p-3">
          <form
            onSubmit={addClient}
            role="dialog"
            aria-modal="true"
            aria-label="Add client"
            className="mx-auto grid max-h-[90dvh] w-full max-w-xl gap-3 overflow-y-auto rounded-t-xl border border-black bg-white p-5"
          >
            <h2 className="text-lg font-semibold">Add client</h2>
            <Field label="Name">
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
                placeholder="Optional"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setName("");
                  setNotes("");
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                {saving ? "Adding…" : "Add client"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  );
}
