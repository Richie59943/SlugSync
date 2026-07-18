import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useAuth } from "./context/AuthContext";

vi.mock("./context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./pages/Dashboard", () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock("./pages/Auth", () => ({ default: () => <div>Auth Page</div> }));
vi.mock("./pages/Profile", () => ({ default: () => <div>Profile Page</div> }));
vi.mock("./pages/Calendar", () => ({ default: () => <div>Calendar Page</div> }));
vi.mock("./pages/Friends", () => ({ default: () => <div>Friends Page</div> }));

describe("App auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
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
    });

    render(<App />);

    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
    expect(screen.queryByText("Auth Page")).not.toBeInTheDocument();
  });
});
