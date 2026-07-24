"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Field,
  alertErrorClass,
  inputClass,
  pageHeaderClass,
  pageIntroClass,
  pageTitleClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { createProductionAction } from "@/app/operator-actions";
import { unwrapOperatorAction } from "@/lib/operator-inputs";

export function NewProductionClient({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    new_client_name: "",
    shoot_date: new Date().toISOString().slice(0, 10),
    location: "",
    runner_name: "",
    notes: "",
  });
  const [error, setError] = useState(initialError);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const { productionId } = unwrapOperatorAction(
        await createProductionAction({
          ...form,
          client_id: "",
          new_client_name: form.new_client_name.trim() || form.name.trim(),
        }),
      );
      router.push(`/productions/${productionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the day.");
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="New day"
      breadcrumbs={[
        { label: "Days", href: "/productions" },
        { label: "New day" },
      ]}
      requireAuth
    >
      <div className="mx-auto w-full max-w-md px-1 sm:max-w-xl sm:px-0">
        <header className={pageHeaderClass}>
          <h1 className={pageTitleClass}>New day</h1>
          <p className={pageIntroClass}>
            Create a new production day and populate its initial roster automatically.
          </p>
        </header>

        <form onSubmit={submit} className="grid gap-4">
          <section className="grid gap-5 rounded-xl border border-black/15 bg-[#fffdf8] p-5 sm:p-6">
            <Field label="Day name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Shoot name"
                required
                autoFocus
              />
            </Field>

            {error ? (
              <div className={alertErrorClass} role="alert">
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
          </section>

          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
            <button type="button" className={secondaryButtonClass} onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className={primaryButtonClass} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
