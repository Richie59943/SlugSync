import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";
import { useAuth } from "../context/AuthContext";
import { upsertProfile } from "../data/profileService";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../data/profileService", () => ({
  upsertProfile: vi.fn(),
}));

function mockSession() {
  useAuth.mockReturnValue({
    session: { user: { id: "user-1" } },
    refreshProfile: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession();
  upsertProfile.mockResolvedValue({ id: "user-1", onboarding_completed: true });
});

describe("Onboarding interest picker", () => {
  it("disables Continue until at least 3 interests are selected", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Hiking" }));
    await user.click(screen.getByRole("button", { name: "Surfing" }));
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Beach Days" }));
    expect(continueButton).toBeEnabled();
  });

  it("toggles a chip off when clicked again, dropping back below the minimum", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.click(screen.getByRole("button", { name: "Hiking" }));
    await user.click(screen.getByRole("button", { name: "Surfing" }));
    await user.click(screen.getByRole("button", { name: "Beach Days" }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Beach Days" }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("prevents selecting more than 15 interests", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    const allButtons = screen.getAllByRole("button").filter((btn) => btn.textContent !== "Continue");
    for (let i = 0; i < 15; i += 1) {
      await user.click(allButtons[i]);
    }

    const countStatus = screen.getByText((_, el) => el?.className === "onboarding-count");
    expect(countStatus).toHaveTextContent("15 of 15 selected");
    expect(countStatus).toHaveTextContent("limit reached");

    const sixteenthOption = allButtons[15];
    expect(sixteenthOption).toBeDisabled();
  });

  it("saves the selected interests and marks onboarding complete on Continue", async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    await user.click(screen.getByRole("button", { name: "Hiking" }));
    await user.click(screen.getByRole("button", { name: "Surfing" }));
    await user.click(screen.getByRole("button", { name: "Beach Days" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(upsertProfile).toHaveBeenCalledWith("user-1", {
      interests: ["Hiking", "Surfing", "Beach Days"],
      onboarding_completed: true,
    });
  });
});
