import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../../src/App";

async function loadSample() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Load sample" }));
  return user;
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
    expect(laneLabels()).toContain("party 1");
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
    expect(laneLabels()).toEqual(["party 1"]);
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
    const bar = timeline().querySelector("[data-version='party#3']");
    fireEvent.pointerEnter(bar as Element, { clientX: 10, clientY: 10 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Alice Group Oy");
  });

  it("hides the tooltip when the pointer leaves", async () => {
    await loadSample();
    const bar = timeline().querySelector("[data-version='party#3']") as Element;
    fireEvent.pointerEnter(bar, { clientX: 10, clientY: 10 });
    fireEvent.pointerLeave(bar);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reports a broken file", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText("CSV files"), new File(["id\n1"], "bad.csv"));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad.csv: Missing columns");
  });

  it("remembers loaded files after a reload", async () => {
    const { unmount } = render(<App />);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Load sample" })[0] as HTMLElement);
    unmount();
    render(<App />);
    expect(laneLabels()).toContain("party 1");
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

  it("clears loaded data", async () => {
    const user = await loadSample();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Drop CSV files here")).toBeInTheDocument();
  });
});
