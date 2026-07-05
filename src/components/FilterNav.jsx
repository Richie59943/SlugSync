import React from "react";

function FilterNav({ label, options, value, onChange }) {
  return (
    <div className="filter-pills" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`pill${value === opt.value ? " is-active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default FilterNav;
