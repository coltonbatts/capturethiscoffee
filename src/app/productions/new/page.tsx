"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Field,
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { createProductionRecord, loadCoffeeData } from "@/lib/data";
import type { CoffeeData } from "@/lib/types";

export default function NewProductionPage() {
  const router = useRouter();
  const [data, setData] = useState<CoffeeData | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    name: "",
    client_id: "",
    new_client_name: "",
    shoot_date: new Date().toISOString().slice(0, 10),
    location: "",
    runner_name: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadCoffeeData()
      .then((next) => {
        if (!mounted) return;
        setData(next);
        setForm((current) => ({
          ...current,
          client_id: next.clients[0]?.id || "",
        }));
      })
      .catch((err: Error) => {
        if (mounted) setError(err.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !form.name.trim() || saving) return;
    if (clientMode === "existing" && !form.client_id) {
      setError("Choose a client or create a new one.");
      return;
    }
    if (clientMode === "new" && !form.new_client_name.trim()) {
      setError("Enter a client name.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const { production } = await createProductionRecord(data, {
        ...form,
        new_client_name:
          clientMode === "new" ? form.new_client_name : undefined,
      });
      router.push(`/productions/${production.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create production.");
      setSaving(false);
    }
  }

  return (
    <AppShell title="New production" requireAuth>
      <form onSubmit={submit} className="grid gap-4">
        <Panel className="grid gap-4 p-5">
          <Field label="Production name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Shoot name"
              required
            />
          </Field>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setClientMode("existing")}
              className={`min-h-11 rounded-lg text-sm font-medium ${
                clientMode === "existing" ? "bg-black text-white shadow-sm" : "text-zinc-600"
              }`}
            >
              Existing client
            </button>
            <button
              type="button"
              onClick={() => setClientMode("new")}
              className={`min-h-11 rounded-lg text-sm font-medium ${
                clientMode === "new" ? "bg-black text-white shadow-sm" : "text-zinc-600"
              }`}
            >
              New client
            </button>
          </div>

          {clientMode === "existing" ? (
            <Field label="Client">
              <select
                className={inputClass}
                value={form.client_id}
                onChange={(event) =>
                  setForm({ ...form, client_id: event.target.value })
                }
                required={clientMode === "existing"}
              >
                {data?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Client name">
              <input
                className={inputClass}
                value={form.new_client_name}
                onChange={(event) =>
                  setForm({ ...form, new_client_name: event.target.value })
                }
                placeholder="Client name"
                required={clientMode === "new"}
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shoot date">
              <input
                className={inputClass}
                type="date"
                value={form.shoot_date}
                onChange={(event) =>
                  setForm({ ...form, shoot_date: event.target.value })
                }
              />
            </Field>
            <Field label="Runner">
              <input
                className={inputClass}
                value={form.runner_name}
                onChange={(event) =>
                  setForm({ ...form, runner_name: event.target.value })
                }
                placeholder="Runner name"
              />
            </Field>
          </div>

          <Field label="Location">
            <input
              className={inputClass}
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Studio or address"
            />
          </Field>

          <Field label="Notes">
            <textarea
              className={`${inputClass} min-h-24 py-3`}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Call time, coffee shop, handoff"
            />
          </Field>
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
