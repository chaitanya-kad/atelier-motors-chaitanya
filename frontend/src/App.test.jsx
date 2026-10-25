import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import App from "./App.jsx";

const car = {
  id: 7,
  make: "Honda",
  model: "Civic",
  category: "Sedan",
  price: 100,
  quantity: 1,
};
const session = {
  token: "example-token",
  user: { email: "buyer@example.com", role: "user" },
};
const response = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("atelier-session", JSON.stringify(session));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("queries the API when searching and changing price limits", async () => {
  const fetcher = vi.fn(async () => response([car]));
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByRole("button", { name: "Purchase Honda Civic" });
  fireEvent.change(screen.getByRole("textbox", { name: "Search vehicles" }), {
    target: { value: "civic" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Minimum price" }), {
    target: { value: "50" },
  });
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url]) =>
          url.includes("/vehicles/search?") &&
          url.includes("q=civic") &&
          url.includes("min_price=50"),
      ),
    ).toBe(true),
  );
});

it("refreshes a stale vehicle after a stock conflict", async () => {
  let stock = 1;
  const fetcher = vi.fn(async (url) => {
    if (url.endsWith("/purchase")) {
      stock = 0;
      return response({ detail: "Out of stock" }, 409);
    }
    return response([{ ...car, quantity: stock }]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Purchase Honda Civic" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Confirm purchase/i }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(
    (await screen.findByRole("button", { name: "Purchase Honda Civic" }))
      .disabled,
  ).toBe(true);
});

it("displays sold-out inventory without an enabled purchase action", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response([{ ...car, quantity: 0 }])),
  );
  render(<App />);
  await screen.findByText("SOLD OUT");
  expect(
    screen.getByRole("button", { name: "Purchase Honda Civic" }).disabled,
  ).toBe(true);
});

it("preserves a custom category in the admin editor", async () => {
  localStorage.setItem(
    "atelier-session",
    JSON.stringify({ ...session, user: { ...session.user, role: "admin" } }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response([{ ...car, category: "Hatchback" }])),
  );
  render(<App />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit Honda Civic" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByRole("combobox", {
      name: "Category",
    }).value,
  ).toBe("Hatchback");
});
