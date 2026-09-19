`spreadsheet-openpyxl.xlsx` is generated independently of SchoolCal and ExcelJS
using OpenPyXL 3.1.5. It exercises inline strings, real Excel date/time cells,
booleans, custom school days, a two-week rotation, a holiday reset, and explicit
empty teacher overrides. Regenerate with Python, OpenPyXL 3.1.5 and
`scripts/generate-spreadsheet-fixture.py`. The binary fixture is read by unit tests;
Python is not needed to run the application or test suite. This is an OOXML
interoperability fixture, not evidence of testing a live Google Sheets account.
