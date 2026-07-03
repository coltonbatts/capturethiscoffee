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
  const [form, setForm] = useState({
    name: "",
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
        if (mounted) setData(next);
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
      // A production always needs a client for label branding; a blank field
      // falls back to the day name (repeat names reuse the same client row).
      const { production } = await createProductionRecord(data, {
        ...form,
        client_id: "",
        new_client_name: form.new_client_name.trim() || form.name.trim(),
      });
      router.push(`/productions/${production.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the day.");
      setSaving(false);
    }
  }

  return (
    <AppShell title="New day" requireAuth>
      <form onSubmit={submit} className="grid gap-4">
        <Panel className="grid gap-4 p-5">
          <Field label="Day name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Shoot name"
              required
            />
          </Field>

          {error ? (
            <div className="rounded-lg border border-red-700 bg-white p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <Field label="Client / brand (optional, shows on labels)">
            <input
              className={inputClass}
              value={form.new_client_name}
              onChange={(event) =>
                setForm({ ...form, new_client_name: event.target.value })
              }
              placeholder="Client or brand name"
            />
          </Field>

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
