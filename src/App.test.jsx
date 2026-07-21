import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useAuth } from "./context/AuthContext";
import { useTheme } from "./context/ThemeContext";

vi.mock("./context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./context/ThemeContext", () => ({
  useTheme: vi.fn(),
}));

vi.mock("./pages/Dashboard", () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock("./pages/Auth", () => ({ default: () => <div>Auth Page</div> }));
vi.mock("./pages/Profile", () => ({ default: () => <div>Profile Page</div> }));
vi.mock("./pages/Calendar", () => ({ default: () => <div>Calendar Page</div> }));
vi.mock("./pages/Friends", () => ({ default: () => <div>Friends Page</div> }));
vi.mock("./pages/Onboarding", () => ({ default: () => <div>Onboarding Page</div> }));

const ONBOARDED_PROFILE = { onboarding_completed: true };

describe("App auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    useTheme.mockReturnValue({
      themePreference: "system",
      resolvedTheme: "light",
      setThemePreference: vi.fn(),
    });
  });

  it("shows a loading state and nothing else while auth is resolving", () => {
    useAuth.mockReturnValue({ session: null, loading: true, signOut: vi.fn() });

    render(<App />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Auth Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
  });

  it("renders the Auth page and no nav when there is no session", () => {
    useAuth.mockReturnValue({ session: null, loading: false, signOut: vi.fn() });

    render(<App />);

    expect(screen.getByText("Auth Page")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Out" })).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
  });

  it("renders the app shell and default page when a session is present", () => {
    useAuth.mockReturnValue({
      session: { user: { email: "test@ucsc.edu" } },
      loading: false,
      signOut: vi.fn(),
      profile: ONBOARDED_PROFILE,
      profileLoading: false,
    });

    render(<App />);

    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Auth Page")).not.toBeInTheDocument();
  });

  it("shows a loading state while the profile (and its onboarding flag) is still resolving", () => {
    useAuth.mockReturnValue({
      session: { user: { email: "test@ucsc.edu" } },
      loading: false,
      signOut: vi.fn(),
      profile: null,
      profileLoading: true,
    });

    render(<App />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
    expect(screen.queryByText("Onboarding Page")).not.toBeInTheDocument();
  });

  it("routes to Onboarding instead of the main app when onboarding isn't complete", () => {
    useAuth.mockReturnValue({
      session: { user: { email: "test@ucsc.edu" } },
      loading: false,
      signOut: vi.fn(),
      profile: { onboarding_completed: false },
      profileLoading: false,
    });

    render(<App />);

    expect(screen.getByText("Onboarding Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign Out" })).not.toBeInTheDocument();
  });

  it("routes to Onboarding when a new user has no profile row yet", () => {
    useAuth.mockReturnValue({
      session: { user: { email: "test@ucsc.edu" } },
      loading: false,
      signOut: vi.fn(),
      profile: null,
      profileLoading: false,
    });

    render(<App />);

    expect(screen.getByText("Onboarding Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Page")).not.toBeInTheDocument();
  });
});

describe("Navbar theme control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    useAuth.mockReturnValue({
      session: { user: { email: "test@ucsc.edu" } },
      loading: false,
      signOut: vi.fn(),
      profile: ONBOARDED_PROFILE,
      profileLoading: false,
    });
  });

  it("renders an accessible theme button that reflects the current preference", () => {
    useTheme.mockReturnValue({
      themePreference: "dark",
      resolvedTheme: "dark",
      setThemePreference: vi.fn(),
    });

    render(<App />);

    expect(screen.getByRole("button", { name: /theme: dark/i })).toBeInTheDocument();
  });

  it("opens a menu listing Light, Dark, and System and selects an option", async () => {
    const setThemePreference = vi.fn();
    useTheme.mockReturnValue({
      themePreference: "system",
      resolvedTheme: "light",
      setThemePreference,
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /theme:/i }));

    expect(screen.getByRole("menu", { name: "Theme options" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /system/i })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    expect(setThemePreference).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when Escape is pressed", async () => {
    useTheme.mockReturnValue({
      themePreference: "light",
      resolvedTheme: "light",
      setThemePreference: vi.fn(),
    });
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: /theme:/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
