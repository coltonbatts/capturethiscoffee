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
    <AppShell title="New production" eyebrow="Setup">
      <Panel className="mb-4 p-4">
        <h1 className="text-2xl font-black tracking-tight">Set up the run</h1>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          Start with the shoot basics. The roster is seeded from saved client contacts
          and core crew.
        </p>
      </Panel>
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-lg border border-stone-200 bg-white/95 p-4 shadow-[0_1px_0_rgba(28,25,23,0.05)]"
      >
        <Field label="Production name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Client shoot / campaign name"
            required
          />
        </Field>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => setClientMode("existing")}
            className={`min-h-11 rounded-md text-sm font-bold ${
              clientMode === "existing" ? "bg-white shadow-sm" : "text-stone-600"
            }`}
          >
            Existing client
          </button>
          <button
            type="button"
            onClick={() => setClientMode("new")}
            className={`min-h-11 rounded-md text-sm font-bold ${
              clientMode === "new" ? "bg-white shadow-sm" : "text-stone-600"
            }`}
          >
            Add client
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
              placeholder="New client"
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
              placeholder="PA / runner name"
            />
          </Field>
        </div>

        <Field label="Location">
          <input
            className={inputClass}
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
            placeholder="Studio, stage, set, or address"
          />
        </Field>

        <Field label="Notes">
          <textarea
            className={`${inputClass} min-h-24 py-3`}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Call time, coffee shop, runner handoff notes"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2 border-t border-stone-200 pt-4">
          <button type="button" className={secondaryButtonClass} onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={saving}>
            {saving ? "Creating" : "Create"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
