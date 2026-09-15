import {
  COLOURS,
  createProject,
  newId,
  type Period,
  type TimetableProject,
} from "./model";
export function standardPeriods(): Period[] {
  return [
    ["Registration", "08:30", "08:45", "registration"],
    ["Period 1", "08:45", "09:45", "lesson"],
    ["Period 2", "09:45", "10:45", "lesson"],
    ["Break", "10:45", "11:05", "break"],
    ["Period 3", "11:05", "12:05", "lesson"],
    ["Period 4", "12:05", "13:05", "lesson"],
    ["Lunch", "13:05", "14:00", "lunch"],
    ["Period 5", "14:00", "15:00", "lesson"],
  ].map(([name, startTime, endTime, type], sortOrder) => ({
    id: newId(),
    name,
    startTime,
    endTime,
    type: type as Period["type"],
    sortOrder,
  }));
}
/** Only loaded after an explicit user action or in tests. Never default production data. */
export function sampleProject(): TimetableProject {
  const p = createProject();
  p.name = "Sample timetable";
  p.cycleLength = 2;
  p.setupComplete = true;
  p.setupStep = 6;
  p.academicYear = {
    startDate: "2026-09-07",
    endDate: "2027-07-16",
    schoolWeekdays: [1, 2, 3, 4, 5],
    timezone: "Europe/London",
    exclusions: [
      {
        id: newId(),
        name: "October half-term",
        startDate: "2026-10-26",
        endDate: "2026-10-30",
        resetRotationAfter: false,
      },
      {
        id: newId(),
        name: "Christmas holiday",
        startDate: "2026-12-21",
        endDate: "2027-01-01",
        resetRotationAfter: true,
      },
      {
        id: newId(),
        name: "February half-term",
        startDate: "2027-02-15",
        endDate: "2027-02-19",
        resetRotationAfter: false,
      },
      {
        id: newId(),
        name: "Easter holiday",
        startDate: "2027-03-29",
        endDate: "2027-04-09",
        resetRotationAfter: true,
      },
      {
        id: newId(),
        name: "Teacher training day",
        startDate: "2027-05-03",
        endDate: "2027-05-03",
        resetRotationAfter: false,
      },
    ],
  };
  p.periods = standardPeriods();
  p.subjects = [
    ["Mathematics", "Maths", "Mrs Jones", "M12"],
    ["English", "English", "Mr Ahmed", "E4"],
    ["Biology", "Biology", "Dr Patel", "Lab 2"],
    ["Chemistry", "Chemistry", "Ms Chen", "Lab 1"],
    ["Physics", "Physics", "Mr Clarke", "Lab 3"],
    ["History", "History", "Ms Williams", "H6"],
  ].map(([name, shortName, teacher, room], i) => ({
    id: newId(),
    name,
    shortName,
    teacher,
    room,
    colour: COLOURS[i],
  }));
  for (let week = 0; week < 2; week++)
    for (let day = 1; day <= 5; day++) {
      p.periods
        .filter((period) => period.type === "lesson")
        .forEach((period, i) => {
          if ((day + i + week) % 9 === 0) return;
          p.entries.push({
            id: newId(),
            rotationIndex: week,
            weekday: day,
            periodId: period.id,
            subjectId: p.subjects[(day + i * 2 + week - 1) % 6].id,
          });
        });
    }
  return p;
}
