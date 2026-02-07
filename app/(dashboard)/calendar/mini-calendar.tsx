"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MiniCalendar({
  currentDate,
  onSelectDate,
}: {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());

  const selectedDate = new Date(currentDate);
  selectedDate.setHours(0, 0, 0, 0);

  const navigateMonth = (delta: number) => {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newMonth < 0) { newMonth = 11; newYear--; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  // Build rows
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const flatCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) flatCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) flatCells.push(d);
  while (flatCells.length % 7 !== 0) flatCells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < flatCells.length; i += 7) {
    rows.push(flatCells.slice(i, i + 7));
  }

  const getWeekLabel = (row: (number | null)[]): string => {
    const firstDayInRow = row.find((d) => d !== null);
    if (firstDayInRow === undefined) return "";

    const rowDate = new Date(viewYear, viewMonth, firstDayInRow);
    const rowWeekStart = new Date(rowDate);
    rowWeekStart.setDate(rowWeekStart.getDate() - rowWeekStart.getDay());
    rowWeekStart.setHours(0, 0, 0, 0);

    const todayWeekStart = new Date(today);
    todayWeekStart.setDate(todayWeekStart.getDate() - todayWeekStart.getDay());
    todayWeekStart.setHours(0, 0, 0, 0);

    const diffWeeks = Math.round(
      (rowWeekStart.getTime() - todayWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (diffWeeks === 0) return "";
    if (diffWeeks > 0) return `+${diffWeeks}w`;
    return `${diffWeeks}w`;
  };

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <span className="text-sm font-semibold text-gray-900 ml-1">
          {MONTHS[viewMonth]} {viewYear}
        </span>
      </div>

      {/* Calendar grid */}
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-8" />
            {DAYS.map((d, i) => (
              <th
                key={i}
                className="h-7 w-9 text-center text-[11px] font-medium text-gray-400 uppercase"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const weekLabel = getWeekLabel(row);
            return (
              <tr key={rowIdx}>
                <td className="text-center text-[10px] text-gray-300 font-medium pr-1">
                  {weekLabel}
                </td>
                {row.map((day, colIdx) => {
                  if (day === null) {
                    return <td key={colIdx} className="h-8 w-9" />;
                  }

                  const cellDate = new Date(viewYear, viewMonth, day);
                  cellDate.setHours(0, 0, 0, 0);
                  const isToday = cellDate.getTime() === today.getTime();
                  const isSelected = cellDate.getTime() === selectedDate.getTime();

                  return (
                    <td key={colIdx} className="h-8 w-9 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectDate(cellDate)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors ${
                          isSelected
                            ? "bg-purple-600 text-white font-semibold"
                            : isToday
                              ? "bg-purple-100 text-purple-700 font-semibold"
                              : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {day}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
