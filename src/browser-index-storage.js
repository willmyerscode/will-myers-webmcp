const DATABASE_NAME = "squarespace-webmcp-index";
const DATABASE_VERSION = 1;
const RECORDS_STORE = "records";
const SITES_STORE = "sites";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase(browser) {
  if (!browser.indexedDB) {
    throw new Error("This browser does not support IndexedDB.");
  }

  const request = browser.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(RECORDS_STORE)) {
      const records = database.createObjectStore(RECORDS_STORE, {
        keyPath: "recordId",
      });
      records.createIndex("siteId", "siteId", { unique: false });
    }
    if (!database.objectStoreNames.contains(SITES_STORE)) {
      database.createObjectStore(SITES_STORE, { keyPath: "origin" });
    }
  };
  return requestResult(request);
}

export async function loadSite(browser, origin) {
  const database = await openDatabase(browser);
  const transaction = database.transaction(SITES_STORE, "readonly");
  const site = await requestResult(transaction.objectStore(SITES_STORE).get(origin));
  await transactionDone(transaction);
  database.close();
  if (!site) throw new Error("Run index_site before you search or read this site.");
  return site;
}

export async function replaceSiteRecords(browser, site, records) {
  const database = await openDatabase(browser);
  const transaction = database.transaction([RECORDS_STORE, SITES_STORE], "readwrite");
  const recordStore = transaction.objectStore(RECORDS_STORE);
  const oldKeys = await requestResult(recordStore.index("siteId").getAllKeys(site.siteId));
  for (const key of oldKeys) recordStore.delete(key);
  for (const record of records) recordStore.put(record);
  transaction.objectStore(SITES_STORE).put(site);
  await transactionDone(transaction);
  database.close();
}

export async function allSiteRecords(browser, siteId) {
  const database = await openDatabase(browser);
  const transaction = database.transaction(RECORDS_STORE, "readonly");
  const records = await requestResult(
    transaction.objectStore(RECORDS_STORE).index("siteId").getAll(siteId),
  );
  await transactionDone(transaction);
  database.close();
  return records;
}

export async function replaceUrlRecords(browser, siteId, url, records) {
  const oldRecords = await allSiteRecords(browser, siteId);
  const database = await openDatabase(browser);
  const transaction = database.transaction(RECORDS_STORE, "readwrite");
  const store = transaction.objectStore(RECORDS_STORE);
  for (const record of oldRecords) {
    if (record.url === url) store.delete(record.recordId);
  }
  for (const record of records) store.put(record);
  await transactionDone(transaction);
  database.close();
}
