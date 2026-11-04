/**
 * Financial statements per service: one tab per service with an income
 * statement, balance sheet and cash flow statement, plus a summary tab.
 *
 * Uses the same Script Properties as the revenue refresh:
 *   API_URL   your ngrok URL (no trailing slash)
 *   EMAIL     demo@mtn.test
 *   PASSWORD  the demo password
 *
 * Period: the current month so far (Africa/Lagos). Balance sheet: right now.
 */

const FS_TIMEZONE = 'Africa/Lagos';
const FS_MONEY_FORMAT = '₦#,##0.00;[Red]-₦#,##0.00';

function refreshStatements() {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('API_URL');
  const token = fsLogin_(apiUrl, props.getProperty('EMAIL'), props.getProperty('PASSWORD'));

  const now = new Date();
  // Lagos is UTC+1 all year, so the 1st of the month at midnight is "+01:00".
  const from = Utilities.formatDate(now, FS_TIMEZONE, "yyyy-MM-01'T'00:00:00") + '+01:00';
  const to = now.toISOString();
  const range = '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);

  const summary = [[
    'Service', 'Net income', 'Total assets', 'Total liabilities', 'Total equity',
    'Net change in cash', 'Closing cash', 'Balanced', 'Cash reconciles',
  ]];

  const services = fsGet_(apiUrl, token, '/services');
  services.forEach(function (service) {
    const base = '/services/' + service.id + '/reports/';
    const income = fsGet_(apiUrl, token, base + 'income-statement' + range);
    const balance = fsGet_(apiUrl, token, base + 'balance-sheet?asOf=' + encodeURIComponent(to));
    const cash = fsGet_(apiUrl, token, base + 'cash-flow' + range);

    fsWriteServiceTab_(service.name, income, balance, cash, now);

    summary.push([
      service.name,
      fsNaira_(income.netIncome),
      fsNaira_(balance.assets.total),
      fsNaira_(balance.liabilities.total),
      fsNaira_(balance.equity.total),
      fsNaira_(cash.netChangeInCash),
      fsNaira_(cash.closingCash),
      balance.balanced ? 'Yes' : 'NO',
      cash.reconciles ? 'Yes' : 'NO',
    ]);
  });

  const sheet = fsSheet_('statements_summary');
  sheet.getRange(1, 1, summary.length, summary[0].length).setValues(summary);
  sheet.getRange(1, 1, 1, summary[0].length).setFontWeight('bold');
  if (summary.length > 1) {
    sheet.getRange(2, 2, summary.length - 1, 6).setNumberFormat(FS_MONEY_FORMAT);
  }
  sheet.autoResizeColumns(1, summary[0].length);
}

/** Builds one service's tab as a list of [label, amount] rows, then writes it. */
function fsWriteServiceTab_(serviceName, income, balance, cash, now) {
  const rows = [];
  const bold = [];
  const heading = function (text) { bold.push(rows.length); rows.push([text, '']); };
  const line = function (text, money) { rows.push(['    ' + text, fsNaira_(money)]); };
  const total = function (text, money) { bold.push(rows.length); rows.push([text, fsNaira_(money)]); };
  const blank = function () { rows.push(['', '']); };
  const lines = function (list) {
    if (list.length === 0) rows.push(['    (none)', '']);
    list.forEach(function (l) { line(l.accountName, l.amount); });
  };
  const period = fsDate_(income.period.from) + ' to ' + fsDate_(income.period.to);

  heading(serviceName + ': financial statements');
  rows.push(['Generated ' + fsDateTime_(now) + ' (' + FS_TIMEZONE + ')', '']);
  blank();

  heading('INCOME STATEMENT');
  rows.push(['For ' + period, '']);
  heading('Income');
  lines(income.income.lines);
  total('Total income', income.income.total);
  heading('Expenses');
  lines(income.expenses.lines);
  total('Total expenses', income.expenses.total);
  total('Net income', income.netIncome);
  blank();

  heading('BALANCE SHEET');
  rows.push(['As at ' + fsDateTime_(new Date(balance.asOf)), '']);
  heading('Assets');
  lines(balance.assets.lines);
  total('Total assets', balance.assets.total);
  heading('Liabilities');
  lines(balance.liabilities.lines);
  total('Total liabilities', balance.liabilities.total);
  heading('Equity');
  lines(balance.equity.lines);
  total('Total equity', balance.equity.total);
  total('Total liabilities and equity', balance.totalLiabilitiesAndEquity);
  rows.push(['Check: assets = liabilities + equity', balance.balanced ? 'Balanced' : 'NOT BALANCED']);
  blank();

  heading('CASH FLOW STATEMENT');
  rows.push(['For ' + period, '']);
  heading('Operating activities');
  line('Net income', cash.operating.netIncome);
  cash.operating.adjustments.forEach(function (a) { line('Change in ' + a.accountName, a.amount); });
  total('Net cash from operating activities', cash.operating.total);
  heading('Financing activities');
  lines(cash.financing.lines);
  total('Net cash from financing activities', cash.financing.total);
  total('Net change in cash', cash.netChangeInCash);
  line('Cash at start of period', cash.openingCash);
  total('Cash at end of period', cash.closingCash);
  rows.push(['Check: start + change = end', cash.reconciles ? 'Reconciles' : 'DOES NOT RECONCILE']);
  line('Memo: cash received', cash.cashReceived);
  line('Memo: cash paid out (refunds, costs)', cash.cashPaidOut);

  const sheet = fsSheet_(serviceName.slice(0, 80) + ' statements');
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.getRange(1, 2, rows.length, 1).setNumberFormat(FS_MONEY_FORMAT).setHorizontalAlignment('right');
  bold.forEach(function (i) { sheet.getRange(i + 1, 1, 1, 2).setFontWeight('bold'); });
  sheet.getRange(1, 1).setFontSize(14);
  sheet.setColumnWidth(1, 360);
  sheet.setColumnWidth(2, 160);
}

/** Gets (or creates) a tab and clears it, so every refresh starts clean. */
function fsSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();
  return sheet;
}

function fsLogin_(apiUrl, email, password) {
  const res = UrlFetchApp.fetch(apiUrl + '/auth/login', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'ngrok-skip-browser-warning': 'true' },
    payload: JSON.stringify({ email: email, password: password }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Login failed (' + res.getResponseCode() + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText()).access_token;
}

function fsGet_(apiUrl, token, path) {
  const res = UrlFetchApp.fetch(apiUrl + path, {
    headers: { Authorization: 'Bearer ' + token, 'ngrok-skip-browser-warning': 'true' },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('GET ' + path + ' failed (' + res.getResponseCode() + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/** { amount: "325581", currency: "NGN" } (kobo, as a string) → 3255.81 */
function fsNaira_(money) {
  return Number(money.amount) / 100;
}

function fsDate_(iso) {
  return Utilities.formatDate(new Date(iso), FS_TIMEZONE, 'd MMM yyyy');
}

function fsDateTime_(date) {
  return Utilities.formatDate(date, FS_TIMEZONE, 'd MMM yyyy HH:mm');
}
