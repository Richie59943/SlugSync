import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventForm from "./EventForm";

function getTimeSelects() {
  // DOM order: Date/Start-time row (hour, minute, ampm) then
  // End-time/Location row (hour, minute, ampm).
  const selects = screen.getAllByRole("combobox");
  return {
    startHour: selects[0],
    startMinute: selects[1],
    startAmPm: selects[2],
    endHour: selects[3],
    endMinute: selects[4],
    endAmPm: selects[5],
  };
}

function optionValues(select) {
  return Array.from(select.querySelectorAll("option")).map((o) => o.value);
}

describe("EventForm minute options", () => {
  it("defaults to the 15-minute options for a new event", () => {
    render(<EventForm onCancel={vi.fn()} onSubmit={vi.fn()} />);
    const { startMinute, endMinute } = getTimeSelects();
    expect(optionValues(startMinute)).toEqual(["", "00", "15", "30", "45"]);
    expect(optionValues(endMinute)).toEqual(["", "00", "15", "30", "45"]);
  });

  it("keeps a non-15-minute value from existing data selectable", () => {
    render(
      <EventForm
        initialData={{
          title: "Existing",
          eventDate: "2026-07-20",
          startTime: "09:05",
          endTime: "",
          location: "",
          description: "",
        }}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const { startMinute } = getTimeSelects();
    expect(optionValues(startMinute)).toEqual(["", "00", "05", "15", "30", "45"]);
  });
});

describe("EventForm validation", () => {
  let onSubmit;
  let user;

  beforeEach(() => {
    onSubmit = vi.fn();
    user = userEvent.setup();
  });

  it("shows required-field errors and does not submit when the form is empty", async () => {
    render(<EventForm onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(await screen.findByText("Event title is required.")).toBeInTheDocument();
    expect(screen.getByText("Date is required.")).toBeInTheDocument();
    expect(screen.getByText("Start time is required.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an end time that is not after the start time", async () => {
    render(<EventForm onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Event title"), "Study session");
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: "2026-07-20" } });

    const { startHour, startMinute, startAmPm, endHour, endMinute, endAmPm } =
      getTimeSelects();
    await user.selectOptions(startHour, "10");
    await user.selectOptions(startMinute, "00");
    await user.selectOptions(startAmPm, "AM");
    await user.selectOptions(endHour, "9");
    await user.selectOptions(endMinute, "00");
    await user.selectOptions(endAmPm, "AM");

    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(
      await screen.findByText("End time must be after the start time.")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values when the form is valid", async () => {
    render(<EventForm onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Event title"), "  My Event  ");
    await user.type(screen.getByLabelText("Description"), "  Desc  ");
    await user.type(screen.getByLabelText("Location"), "  Room 101  ");
    const dateInput = document.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: "2026-07-20" } });

    const { startHour, startMinute, startAmPm, endHour, endMinute, endAmPm } =
      getTimeSelects();
    await user.selectOptions(startHour, "9");
    await user.selectOptions(startMinute, "00");
    await user.selectOptions(startAmPm, "AM");
    await user.selectOptions(endHour, "10");
    await user.selectOptions(endMinute, "00");
    await user.selectOptions(endAmPm, "AM");

    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Event",
        description: "Desc",
        location: "Room 101",
        eventDate: "2026-07-20",
        startTime: "09:00",
        endTime: "10:00",
      })
    );
  });
});
