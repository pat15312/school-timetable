import {
  createProject,
  type DateExclusion,
  type TimetableProject,
} from "./model";
export function testProject(): TimetableProject {
  return {
    ...createProject(),
    id: "test-project",
    name: "Test timetable",
    cycleLength: 2,
    setupComplete: true,
    academicYear: {
      startDate: "2026-09-07",
      endDate: "2027-07-16",
      schoolWeekdays: [1, 2, 3, 4, 5],
      timezone: "Europe/London",
      exclusions: [],
    },
    subjects: [
      {
        id: "maths",
        name: "Mathematics",
        teacher: "Mrs Jones",
        room: "M12",
        colour: "#6484ba",
      },
      { id: "english", name: "English", colour: "#b07e9c" },
    ],
    periods: [
      {
        id: "p1",
        name: "Period 1",
        startTime: "09:00",
        endTime: "10:00",
        categoryId: "lesson",
        sortOrder: 0,
      },
      {
        id: "break",
        name: "Break",
        startTime: "10:00",
        endTime: "10:20",
        categoryId: "break",
        sortOrder: 1,
      },
      {
        id: "lunch",
        name: "Lunch",
        startTime: "12:00",
        endTime: "13:00",
        categoryId: "lunch",
        sortOrder: 2,
      },
    ],
    entries: Array.from({ length: 4 }, (_, rotationIndex) =>
      Array.from({ length: 7 }, (_, weekday) => ({
        id: `entry-${rotationIndex}-${weekday}`,
        rotationIndex,
        weekday,
        periodId: "p1",
        subjectId: rotationIndex % 2 ? "english" : "maths",
      })),
    ).flat(),
  };
}
export function holiday(
  startDate: string,
  endDate: string,
  resetRotationAfter = false,
): DateExclusion {
  return {
    id: `holiday-${startDate}`,
    name: "Holiday",
    startDate,
    endDate,
    resetRotationAfter,
  };
}
