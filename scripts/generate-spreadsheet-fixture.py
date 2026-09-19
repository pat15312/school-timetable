"""Regenerate the independent XLSX fixture with Python and openpyxl==3.1.5."""
from datetime import date, time
from pathlib import Path
from openpyxl import Workbook

book = Workbook()
book.remove(book.active)

def sheet(name, rows):
    page = book.create_sheet(name)
    for row in rows:
        page.append(row)
    return page

sheet('Read me', [['SchoolCal spreadsheet', '1']])
sheet('Settings', [
    ['Setting', 'Value'], ['Timetable name', 'Independent workbook'],
    ['First school day', date(2026, 9, 7)], ['Last school day', date(2027, 7, 16)],
    ['School days', 'Monday, Wednesday, Friday'], ['Time zone', 'Europe/London'],
    ['Weeks in rotation', 2], ['Week labels', 'Letters'], ['First week', 2],
    ['Setup status', 'Complete'], ['Resume setup at', 'Lesson preview'],
])
sheet('Categories', [['Code', 'Name', 'Allow subjects'], ['LESSON', 'Lesson', True], ['BREAK', 'Break', False]])
sheet('Periods', [['Code', 'Name', 'Start time', 'End time', 'Category'], ['P1', 'First lesson', time(8, 45), time(9, 35), 'LESSON'], ['B1', 'Morning break', time(9, 35), time(9, 50), 'BREAK']])
sheet('Subjects', [['Code', 'Name', 'Short name', 'Teacher', 'Room', 'Colour'], ['MATHS', 'Mathematics', 'Maths', 'Ms Smith', 'R01', '#6484ba']])
for week in range(1, 5):
    sheet(f'Week {week}', [['Period', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], ['P1', 'MATHS' if week < 3 else ''], ['B1']])
sheet('Holidays', [['Name', 'First day', 'Last day', 'Reset rotation'], ['Half term', date(2026, 10, 19), date(2026, 10, 23), True]])
sheet('Lesson details', [['Week', 'Day', 'Period', 'Override title', 'Title', 'Override teacher', 'Teacher', 'Override room', 'Room', 'Notes'], [2, 'Monday', 'P1', True, 'Algebra', True, '', True, 'R02', 'Bring a ruler']])
book.save(Path(__file__).resolve().parents[1] / 'tests/fixtures/spreadsheet-openpyxl.xlsx')
