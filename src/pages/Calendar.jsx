import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

const dummyEvents = [
  { title: "Surf club", date: "2026-07-03", color: "#5DCAA5" },
  { title: "Study group", date: "2026-07-07", color: "#F0997B" },
  { title: "AI pick: farmers market", date: "2026-07-08", color: "#EF9F27" },
  { title: "Beach cleanup", date: "2026-07-15", color: "#5DCAA5" },
];

function Calendar() {
  return (
    <main className="dashboard bg-red-100">
      <section className="welcome-section">
        <div>
          <p className="eyebrow">Event calendar</p>
          <h1>Your calendar</h1>
          <p>Browse your events across month, week, and day views.</p>
        </div>
      </section>

      <section className="panel" style={{ padding: "1.5rem" }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={dummyEvents}
          height="auto"
        />
      </section>
    </main>
  );
}

export default Calendar;
