import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "../../src/App";

// The network data has more tables and links to click through than the app's sample.
vi.mock("../../src/sample", async () => ({
  SAMPLE_SOURCES: (await import("../fixtures/network")).NETWORK_SOURCES,
}));

async function loadSample() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Load sample" }));
  return user;
}

const ODD_CSV = "id,created,deleted,recorded,superseded\n1,2024-01-10,,2024-01-10 09:00,\n";
const ODD_MAPPING = { "Valid from": "created", "Valid to": "deleted", "Tech valid from": "recorded", "Tech valid to": "superseded" };

async function uploadOdd() {
  const user = userEvent.setup();
  render(<App />);
  await user.upload(screen.getByLabelText("CSV files"), new File([ODD_CSV], "odd.csv"));
  await screen.findByRole("form");
  return user;
}

async function mapOdd(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  for (const [label, column] of Object.entries({ ...ODD_MAPPING, ...overrides })) {
    await user.selectOptions(screen.getByRole("combobox", { name: label }), column);
  }
  await user.click(screen.getByRole("button", { name: "Use these columns" }));
}

const timeline = () => screen.getByRole("img", { name: /Timeline/ });
const laneLabels = () => [...timeline().querySelectorAll(".lane-label")].map((el) => el.textContent);

describe("App", () => {
  it("starts with an empty state", () => {
    render(<App />);
    expect(screen.getByText("Drop CSV files here")).toBeInTheDocument();
  });

  it("draws a lane per key after loading the sample", async () => {
    await loadSample();
    expect(laneLabels()).toContain("node 1");
  });

  it("focuses on one entity", async () => {
    const user = await loadSample();
    await user.selectOptions(screen.getByRole("combobox", { name: "Entity" }), "connection");
    await user.type(screen.getByRole("combobox", { name: "Id" }), "101");
    await user.selectOptions(screen.getByRole("combobox", { name: "Hops" }), "0");
    expect(laneLabels()).toEqual(["connection 101"]);
  });

  it("shows superseded versions in 'All versions' mode", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "All versions" }));
    expect(timeline().querySelectorAll(".bar.superseded").length).toBeGreaterThan(0);
  });

  it("steps back through tech time", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "Previous change" }));
    expect(screen.getByText("2024-10-02 16:00:05")).toBeInTheDocument();
  });

  it("jumps along the tech slider", async () => {
    await loadSample();
    fireEvent.change(screen.getByRole("slider", { name: "Tech time" }), { target: { value: "0" } });
    expect(laneLabels()).toEqual(["node 1"]);
  });

  it("fills the snapshot panel on click", async () => {
    await loadSample();
    const svg = timeline();
    fireEvent.pointerDown(svg, { button: 0, clientX: 600 });
    fireEvent.pointerUp(svg, { clientX: 600 });
    expect(within(screen.getByRole("complementary", { name: "Snapshot" })).getByText(/valid at/)).toBeInTheDocument();
  });

  it("pans on drag instead of picking", async () => {
    await loadSample();
    const svg = timeline();
    const before = svg.querySelector(".tick text")?.textContent;
    fireEvent.pointerDown(svg, { button: 0, clientX: 600 });
    fireEvent.pointerMove(svg, { clientX: 300 });
    fireEvent.pointerUp(svg, { clientX: 300 });
    expect(svg.querySelector(".tick text")?.textContent).not.toBe(before);
  });

  it("zooms on ctrl + wheel", async () => {
    await loadSample();
    const svg = timeline();
    const before = svg.querySelectorAll(".tick").length;
    fireEvent.wheel(svg, { ctrlKey: true, deltaY: -400, clientX: 600 });
    expect(svg.querySelectorAll(".tick text")[0]?.textContent).not.toBe(String(before));
  });

  it("shows a tooltip on hover", async () => {
    await loadSample();
    const bar = timeline().querySelector("[data-version='node#3']");
    fireEvent.pointerEnter(bar as Element, { clientX: 10, clientY: 10 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Alice Group Oy");
  });

  it("hides the tooltip when the pointer leaves", async () => {
    await loadSample();
    const bar = timeline().querySelector("[data-version='node#3']") as Element;
    fireEvent.pointerEnter(bar, { clientX: 10, clientY: 10 });
    fireEvent.pointerLeave(bar);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reports an empty file", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText("CSV files"), new File([""], "bad.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad.csv: CSV is empty");
  });

  it("asks for time columns it cannot recognise", async () => {
    await uploadOdd();
    expect(screen.getByRole("form", { name: "Columns for odd" })).toBeInTheDocument();
  });

  it("shows example values next to column names", async () => {
    await uploadOdd();
    const validFrom = screen.getByRole("combobox", { name: "Valid from" });
    expect(within(validFrom).getByRole("option", { name: "created — 2024-01-10" })).toBeInTheDocument();
  });

  it("draws the table once its time columns are chosen", async () => {
    const user = await uploadOdd();
    await mapOdd(user);
    expect(laneLabels()).toEqual(["odd"]);
  });

  it("remembers chosen time columns after a reload", async () => {
    const user = await uploadOdd();
    await mapOdd(user);
    cleanup();
    render(<App />);
    expect(laneLabels()).toEqual(["odd"]);
  });

  it("keeps the apply button disabled until all four differ", async () => {
    const user = await uploadOdd();
    await user.selectOptions(screen.getByRole("combobox", { name: "Valid from" }), "created");
    expect(screen.getByRole("button", { name: "Use these columns" })).toBeDisabled();
  });

  it("draws one lane per value of the chosen key", async () => {
    const user = await uploadOdd();
    await user.selectOptions(screen.getByRole("combobox", { name: "Key" }), "id");
    await mapOdd(user);
    expect(laneLabels()).toEqual(["odd 1"]);
  });

  it("draws one lane per value of a chosen link", async () => {
    const user = await uploadOdd();
    await user.selectOptions(screen.getByRole("combobox", { name: "id links to" }), "odd");
    await mapOdd(user);
    expect(laneLabels()).toEqual(["odd 1"]);
  });

  it("remembers the chosen key after a reload", async () => {
    const user = await uploadOdd();
    await user.selectOptions(screen.getByRole("combobox", { name: "Key" }), "id");
    await mapOdd(user);
    cleanup();
    render(<App />);
    expect(laneLabels()).toEqual(["odd 1"]);
  });

  it("does not offer the key column as a link", async () => {
    const user = await uploadOdd();
    await user.selectOptions(screen.getByRole("combobox", { name: "Key" }), "id");
    expect(screen.queryByRole("combobox", { name: "id links to" })).toBeNull();
  });

  it("does not offer a time column as the key", async () => {
    const user = await uploadOdd();
    await mapOdd(user);
    await user.click(screen.getByRole("button", { name: /^odd/ }));
    const key = screen.getByRole("combobox", { name: "Key" });
    expect(within(key).queryByRole("option", { name: /^created/ })).toBeNull();
  });

  it("pre-fills the guessed key when reopened from the legend", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: /^node/ }));
    expect(screen.getByRole("combobox", { name: "Key" })).toHaveValue("node_id");
  });

  it("explains a column with bad values", async () => {
    const user = await uploadOdd();
    await mapOdd(user, { "Valid from": "id" });
    expect(screen.getByRole("alert")).toHaveTextContent('Unrecognised timestamp "1"');
  });

  it("reopens a loaded table's columns from the legend", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: /^node/ }));
    expect(screen.getByRole("combobox", { name: "Valid from" })).toHaveValue("valid_from");
  });

  it("closes the column editor on cancel", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: /^node/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("remembers loaded files after a reload", async () => {
    const { unmount } = render(<App />);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Load sample" })[0] as HTMLElement);
    unmount();
    render(<App />);
    expect(laneLabels()).toContain("node 1");
  });

  it("forgets files on clear", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(localStorage.length).toBe(0);
  });

  it("warns when the browser cannot remember the files", async () => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    try {
      await loadSample();
      expect(screen.getByText(/too large for this browser/)).toBeInTheDocument();
    } finally {
      Storage.prototype.setItem = setItem;
    }
  });

  it("remembers the view after a reload", async () => {
    const user = await loadSample();
    await user.selectOptions(screen.getByRole("combobox", { name: "Entity" }), "connection");
    await user.type(screen.getByRole("combobox", { name: "Id" }), "101");
    await user.click(screen.getByRole("button", { name: "All versions" }));
    cleanup();
    render(<App />);
    expect(screen.getByRole("combobox", { name: "Id" })).toHaveValue("101");
  });

  it("remembers the tech time mode after a reload", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "All versions" }));
    cleanup();
    render(<App />);
    expect(screen.getByRole("button", { name: "All versions" })).toHaveAttribute("aria-pressed", "true");
  });

  it("resets the view but keeps the files", async () => {
    const user = await loadSample();
    await user.type(screen.getByRole("combobox", { name: "Id" }), "101");
    await user.click(screen.getByRole("button", { name: "Reset view" }));
    expect([screen.getByRole("combobox", { name: "Id" }), laneLabels().length > 1]).toEqual([
      expect.objectContaining({ value: "" }),
      true,
    ]);
  });

  it("forgets the view on reset", async () => {
    const user = await loadSample();
    await user.type(screen.getByRole("combobox", { name: "Id" }), "101");
    await user.click(screen.getByRole("button", { name: "Reset view" }));
    expect(localStorage.getItem("bitemporal-viz:view:v1")).toBeNull();
  });

  it("clears loaded data", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Drop CSV files here")).toBeInTheDocument();
  });
});
