/** Google Apps Script: Lab Inventory API (Web App)
 *  Sheet tab must be named "Inventory" with headers:
 *  id | name | coåntainer | quantity | min | notes | updatedAt
 */
const SHEET_NAME = 'Inventory';
const TOKEN = ''; // optional secret; leave "" to disable

// ---------- utils ----------
function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id','name','container','quantity','min','notes','updatedAt']);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function authOk_(e, body) {
  if (!TOKEN) return true;
  const q = e?.parameter?.token;
  const b = body?.token;
  const h = e?.headers?.['X-Auth']; // available in web app runtime
  return (q || b || h) === TOKEN;
}

// ---------- handlers ----------
function doGet(e) {
  const sh = getSheet_();
  const action = (e?.parameter?.action) || 'items';

  if (!authOk_(e, null)) return json_({ error: 'Unauthorized' });

  if (action !== 'items') return json_({ error: 'Unknown action' });

  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const idx = {
    id: headers.indexOf('id'),
    name: headers.indexOf('name'),
    container: headers.indexOf('container'),
    quantity: headers.indexOf('quantity'),
    min: headers.indexOf('min'),
    notes: headers.indexOf('notes'),
    updatedAt: headers.indexOf('updatedAt'),
  };

  const items = values.filter(r => r[idx.id]).map(r => ({
    id: r[idx.id],
    name: r[idx.name],
    container: r[idx.container],
    quantity: Number(r[idx.quantity]) || 0,
    min: r[idx.min] === '' ? null : Number(r[idx.min]),
    notes: r[idx.notes] || '',
    updatedAt: r[idx.updatedAt] || '',
  }));

  return json_({ items });
}

function doPost(e) {
  const sh = getSheet_();
  if (!e?.postData?.contents) return json_({ error: 'Missing body' });

  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch { return json_({ error: 'Invalid JSON' }); }

  if (!authOk_(e, body)) return json_({ error: 'Unauthorized' });

  const values = sh.getDataRange().getValues();
  const headers = values.shift();

  const idx = {
    id: headers.indexOf('id'),
    name: headers.indexOf('name'),
    container: headers.indexOf('container'),
    quantity: headers.indexOf('quantity'),
    min: headers.indexOf('min'),
    notes: headers.indexOf('notes'),
    updatedAt: headers.indexOf('updatedAt'),
  };

  if (body.action === 'upsert') {
    const it = body.item || {};
    if (!it.id) return json_({ error: 'item.id required' });

    const now = new Date().toISOString();
    const rowData = [
      it.id,
      it.name || '',
      it.container || 'Other',
      Number(it.quantity) || 0,
      it.min === undefined || it.min === null || it.min === '' ? '' : Number(it.min),
      it.notes || '',
      now,
    ];

    // find row by id
    let row = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i][idx.id] === it.id) { row = i + 2; break; } // header + 1-based
    }
    if (row === -1) sh.appendRow(rowData);
    else sh.getRange(row, 1, 1, headers.length).setValues([rowData]);

    return json_({ ok: true });
  }

  if (body.action === 'delete') {
    const id = body.id;
    if (!id) return json_({ error: 'id required' });
    for (let i = 0; i < values.length; i++) {
      if (values[i][idx.id] === id) {
        sh.deleteRow(i + 2);
        return json_({ ok: true });
      }
    }
    return json_({ ok: true, note: 'not found' });
  }

  return json_({ error: 'Unknown action' });
}
