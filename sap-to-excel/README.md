# SAP to Excel (for ActiveData for Excel)

Copies one SAP table into a normal Excel file. Open that file in Excel and
run ActiveData (or any Excel add-in, such as TeamMate Analytics) on it as usual.

- **Read only.** It uses SAP's standard function `RFC_READ_TABLE`. Nothing is changed in SAP.
- **No AI.** The program talks only to your SAP server.
- **Password is never saved.** It is typed each time and not shown on screen.

## One-time setup (on your office PC)

1. **Python** – install Python 3.12 (64-bit) from python.org. Tick "Add Python to PATH".
2. **SAP NW RFC SDK 7.50** – ask your SAP Basis/IT team for it (it is downloaded
   from the SAP Support Portal and needs an SAP S-user). Unzip it, e.g. to
   `C:\nwrfcsdk`, and add a Windows environment variable `SAPNWRFC_HOME = C:\nwrfcsdk`.
3. **Libraries** – open Command Prompt in this folder and run:
   `pip install -r requirements.txt`
4. **Settings** – open `sap_config.ini` in Notepad and fill in the server, system
   number and client (from SAP Logon > your system > Properties). Do **not** add your password.

## Ask IT to confirm your access

Your view-only ID also needs these SAP permissions (IT can check in SU53/SU56):

- `S_RFC` – to run `RFC_READ_TABLE` (function group `SDTX`) and,
  for very wide tables, `DDIF_FIELDINFO_GET` (function group `SDIFRUNTIME`)
- `S_TABU_DIS` / `S_TABU_NAM` – display rights for the tables you need
- The user must be allowed RFC logon (user type Dialog or Communication/System)

## Daily use

Double-click **`Run SAP to Excel.bat`** and answer the questions:

| Question | Example |
|---|---|
| SAP table name | `BKPF` |
| Fields (Enter = all) | `BUKRS,BELNR,GJAHR,BUDAT` |
| Filter (Enter = none) | `BUKRS = '1000' AND GJAHR = '2025'` |
| Maximum rows | `100000` |

The Excel file is saved in the `output` folder. It has three sheets:
the data, a list of fields with descriptions, and the extract details
(table, filter, user, date and time) for your audit working papers.

## Good to know

- Always use a filter on big tables (e.g. BSEG, MSEG) or SAP may time out.
- Filter syntax is SAP's: text values in single quotes, `AND` / `OR`, dates as `'20250401'`.
- Amounts and quantities come as numbers, dates as Excel dates, document numbers stay as text (leading zeros kept).
- Excel holds at most 1,048,575 rows per sheet; the tool will not read more.
