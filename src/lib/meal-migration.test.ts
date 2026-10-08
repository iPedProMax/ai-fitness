import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  fileURLToPath,
} from "node:url";

import {
  describe,
  expect,
  it,
} from "vitest";

const migrationUrl = new URL(
  "../../supabase/migrations/20261008_create_meals_and_meal_items.sql",
  import.meta.url
);

const migrationPath =
  fileURLToPath(migrationUrl);

describe("meal database migration", () => {
  it("creates secure meal storage with RLS", () => {
    const exists =
      existsSync(migrationPath);

    expect(exists).toBe(true);

    if (!exists) {
      return;
    }

    const sql = readFileSync(
      migrationPath,
      "utf8"
    )
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .trim();

    expect(sql).toContain(
      "create table public.meals"
    );

    expect(sql).toContain(
      "create table public.meal_items"
    );

    expect(sql).toContain(
      "alter table public.meals enable row level security"
    );

    expect(sql).toContain(
      "alter table public.meal_items enable row level security"
    );

    expect(sql).toContain(
      "meals_select_own"
    );

    expect(sql).toContain(
      "meals_insert_own"
    );

    expect(sql).toContain(
      "meals_update_own"
    );

    expect(sql).toContain(
      "meals_delete_own"
    );

    expect(sql).toContain(
      "meal_items_select_own"
    );

    expect(sql).toContain(
      "meal_items_insert_own"
    );

    expect(sql).toContain(
      "meal_items_update_own"
    );

    expect(sql).toContain(
      "meal_items_delete_own"
    );

    expect(sql).toContain(
      "foreign key (meal_id, user_id)"
    );

    expect(sql).toContain(
      "check (confidence >= 0 and confidence <= 1)"
    );

    expect(sql).toContain(
      "check (total_calories >= 0)"
    );

    expect(sql).toContain(
      "check (calories >= 0)"
    );
  });
});

