import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { matchesPreferences } from "../data/matchesPreferences";
import { getCategoryStyle } from "../data/categoryStyles";
import {
  DIGEST_RANGE_OPTIONS,
  DIGEST_RANGES,
  digestHeading,
  digestPeriodLabel,
  filterEventsInRange,
  todayString,
} from "../data/digestRange";

function sortByDate(events) {
  return [...events].sort((a, b) => {
    const aKey = `${a.sortDate ?? ""}T${a.sortTime ?? "00:00"}`;
    const bKey = `${b.sortDate ?? ""}T${b.sortTime ?? "00:00"}`;
    return aKey.localeCompare(bKey);
  });
}

function toDigestEventPayload(event) {
  return {
    title: event.title,
    date: event.date,
    time: event.time,
    location: event.location || null,
  };
}

function DailyDigest({ personalEvents, communityEvents, currentUserId }) {
  const [expanded, setExpanded] = useState(false);
  const [range, setRange] = useState(DIGEST_RANGES.DAILY);

  const [interests, setInterests] = useState({ clubs: [], classes: [] });
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [composerError, setComposerError] = useState("");

  // Pull interests from the user's profile (clubs/classes), not the
  // user_preferences table the main filter bar uses.
  useEffect(() => {
    if (!currentUserId) {
      setInterests({ clubs: [], classes: [] });
      setProfileLoaded(true);
      return;
    }

    let cancelled = false;
    setProfileLoaded(false);

    supabase
      .from("profiles")
      .select("clubs, classes")
      .eq("id", currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setInterests({ clubs: data?.clubs ?? [], classes: data?.classes ?? [] });
        setProfileLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const rangeEvents = sortByDate([
    ...filterEventsInRange(personalEvents, range),
    ...filterEventsInRange(communityEvents, range).filter((event) =>
      matchesPreferences(event, {
        clubs: interests.clubs,
        classes: interests.classes,
        categories: [],
      }),
    ),
  ]);

  // Fresh AI call whenever the panel opens or the range changes — no caching.
  useEffect(() => {
    if (!expanded || !profileLoaded) return;

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError("");

    async function generateSummary() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-digest`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              mode: "summary",
              range,
              today: todayString(),
              events: rangeEvents.map(toDigestEventPayload),
              interests,
            }),
          },
        );

        const parsed = await res.json();
        if (cancelled) return;

        if (!res.ok || parsed.error) {
          setSummaryError(parsed.error || `Request failed (${res.status}).`);
          setSummary("");
          return;
        }

        setSummary(parsed.summary || "");
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSummaryError("Request failed. Check your connection.");
          setSummary("");
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    generateSummary();

    return () => {
      cancelled = true;
    };
    // rangeEvents/interests are derived from personalEvents/communityEvents/range,
    // already covered by those deps — omitting them keeps this to one call per
    // open/range change instead of refiring on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, range, profileLoaded, personalEvents, communityEvents]);

  // A stale thread from a different range is confusing, so clear the Q&A
  // conversation whenever the selected period changes.
  useEffect(() => {
    setQuestion("");
    setMessages([]);
    setComposerError("");
  }, [range]);

  async function handleAskQuestion() {
    const trimmed = question.trim();
    if (!trimmed) {
      setComposerError("Ask a question first.");
      return;
    }

    const messageId = `${Date.now()}-${Math.random()}`;
    setComposerError("");
    setQuestion("");
    setQaLoading(true);
    setMessages((current) => [
      ...current,
      { id: messageId, question: trimmed, answer: "", error: "" },
    ]);

    function updateMessage(patch) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, ...patch } : message,
        ),
      );
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-digest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            mode: "qa",
            range,
            today: todayString(),
            events: rangeEvents.map(toDigestEventPayload),
            interests,
            question: trimmed,
          }),
        },
      );

      const parsed = await res.json();

      if (!res.ok || parsed.error) {
        updateMessage({ error: parsed.error || `Request failed (${res.status}).` });
        return;
      }

      updateMessage({ answer: parsed.answer || "" });
    } catch (err) {
      console.error(err);
      updateMessage({ error: "Request failed. Check your connection." });
    } finally {
      setQaLoading(false);
    }
  }

  function handleComposerKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  }

  return (
    <section className="panel digest-panel">
      <div className="dashboard-section-header digest-header">
        <button
          aria-expanded={expanded}
          className="digest-toggle-header"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          <span aria-hidden="true" className={`digest-arrow${expanded ? " is-open" : ""}`}>
            ›
          </span>
          <h3>{digestHeading(range)}</h3>
        </button>

        <div aria-label="Digest range" className="digest-range-toggle" role="tablist">
          {DIGEST_RANGE_OPTIONS.map((option) => (
            <button
              aria-selected={range === option.value}
              className={`pill${range === option.value ? " is-active" : ""}`}
              key={option.value}
              onClick={() => setRange(option.value)}
              role="tab"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="digest-body">
          {summaryLoading && (
            <p className="digest-summary-loading">
              Generating your {digestPeriodLabel(range)} digest…
            </p>
          )}
          {!summaryLoading && summaryError && (
            <p className="event-message event-message-error">{summaryError}</p>
          )}
          {!summaryLoading && !summaryError && summary && (
            <p className="digest-summary-text">{summary}</p>
          )}

          {rangeEvents.length === 0 ? (
            <p className="empty-state" style={{ textAlign: "left", margin: 0 }}>
              No events {digestPeriodLabel(range)}.
            </p>
          ) : (
            <div className="digest-event-list">
              {rangeEvents.map((event) => {
                const cat = getCategoryStyle(event);
                return (
                  <div className="schedule-row" key={`${event.source}-${event.id}`}>
                    <span className="schedule-time">{event.time}</span>
                    <div className="schedule-detail" style={{ borderLeftColor: cat.dot }}>
                      <strong>{event.title}</strong>
                      {event.location && <span>{event.location}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="digest-qa">
            <p className="digest-qa-label">Ask about your schedule</p>

            {messages.length > 0 && (
              <div className="digest-qa-thread">
                {messages.map((message) => (
                  <div className="digest-qa-message" key={message.id}>
                    <p className="digest-qa-bubble digest-qa-bubble-question">
                      {message.question}
                    </p>
                    {message.error ? (
                      <p className="digest-qa-bubble digest-qa-bubble-error">
                        {message.error}
                      </p>
                    ) : message.answer ? (
                      <p className="digest-qa-bubble digest-qa-bubble-answer">
                        {message.answer}
                      </p>
                    ) : (
                      <p className="digest-qa-bubble digest-qa-bubble-answer digest-qa-bubble-loading">
                        Thinking...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {composerError && (
              <p className="event-message event-message-error">{composerError}</p>
            )}

            <div className="digest-qa-composer">
              <textarea
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setComposerError("");
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder='e.g. "when am I free?" or "can I fit in a study session?"'
                rows={1}
                value={question}
              />
              <button
                className="btn-primary"
                disabled={qaLoading}
                onClick={handleAskQuestion}
                type="button"
              >
                {qaLoading ? "Thinking..." : "Ask"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default DailyDigest;
