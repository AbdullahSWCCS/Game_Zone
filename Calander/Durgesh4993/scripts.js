const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();

const monthAndYear = document.getElementById("monthAndYear");
const calendarBody = document.getElementById("calendar-body");
const monthSelect = document.getElementById("month");
const yearSelect = document.getElementById("year");
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function showCalendar(month, year) {
  const firstDay = new Date(year, month).getDay();
  const daysInMonth = 32 - new Date(year, month, 32).getDate();

  calendarBody.innerHTML = "";
  monthAndYear.textContent = `${months[month]} ${year}`;
  monthSelect.value = month;
  yearSelect.value = year;

  let date = 1;
  for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
    const row = document.createElement("tr");

    for (let cellIndex = 0; cellIndex < 7; cellIndex += 1) {
      const cell = document.createElement("td");
      if (rowIndex === 0 && cellIndex < firstDay) {
        cell.textContent = "";
      } else if (date > daysInMonth) {
        cell.textContent = "";
      } else {
        cell.textContent = date;
        if (
          date === today.getDate()
          && year === today.getFullYear()
          && month === today.getMonth()
        ) {
          cell.className = "bg-primary text-white";
        }
        date += 1;
      }
      row.appendChild(cell);
    }

    calendarBody.appendChild(row);
    if (date > daysInMonth) break;
  }
}

function next() {
  currentYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  currentMonth = (currentMonth + 1) % 12;
  showCalendar(currentMonth, currentYear);
}

function previous() {
  currentYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  currentMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  showCalendar(currentMonth, currentYear);
}

function jump() {
  currentMonth = parseInt(monthSelect.value, 10);
  currentYear = parseInt(yearSelect.value, 10);
  showCalendar(currentMonth, currentYear);
}

showCalendar(currentMonth, currentYear);
