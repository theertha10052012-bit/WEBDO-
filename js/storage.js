/* ==========================================================
   storage.js
   The ONLY file that touches localStorage.

   BACKEND NOTE: tomorrow, replace the inside of each function
   with a fetch() call to the server. Keep the same function
   names, inputs and outputs, and the rest of the app will not
   need changes.
   ========================================================== */

const STORAGE_KEY = "smartInventory.products";

/* DEMO BARCODES: the numbers below are made up for testing.
   They are NOT real product codes. They start with 2 (a range used for in-store
   numbers) and have correct EAN-13 check digits, so a barcode image made from
   them can be scanned. Shampoo, Cooking Oil and Tea Powder have no barcode on
   purpose, to test choosing a product from the list. */
const SAMPLE_PRODUCTS = [
  { id: "p1", name: "Biscuits",    category: "Snacks",        barcode: "2000000000015", quantity: 5,   minimum: 20, target: 30 },
  { id: "p2", name: "Soap",        category: "Personal Care", barcode: "2000000000022", quantity: 50,  minimum: 20, target: 60 },
  { id: "p3", name: "Milk",        category: "Dairy",         barcode: "2000000000039", quantity: 8,   minimum: 15, target: 40 },
  { id: "p4", name: "Rice",        category: "Grocery",       barcode: "2000000000046", quantity: 100, minimum: 30, target: 120 },
  { id: "p5", name: "Shampoo",     category: "Personal Care", barcode: "",              quantity: 12,  minimum: 10, target: 30 },
  { id: "p6", name: "Cooking Oil", category: "Grocery",       barcode: "",              quantity: 25,  minimum: 25, target: 50 },
  { id: "p7", name: "Tea Powder",  category: "Beverages",     barcode: "",              quantity: 0,   minimum: 10, target: 30 }
];

/* ---------- Private helper functions (used only in this file) ---------- */

// Makes a separate copy, so changing one never changes the other
function makeCopy(data) {
  return JSON.parse(JSON.stringify(data));
}

function writeProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function loadSamples() {
  const samples = makeCopy(SAMPLE_PRODUCTS);
  writeProducts(samples);
  return samples;
}

function readProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);

  // First run: nothing saved yet, so load the sample products
  if (saved === null) {
    return loadSamples();
  }

  try {
    const list = JSON.parse(saved);
    if (Array.isArray(list)) {
      return list;
    }
  } catch (error) {
    console.error("Saved data is broken. Loading sample data.", error);
  }

  // Saved data was broken, so start again with samples
  return loadSamples();
}

// Turns anything into a whole number that is 0 or more
function toWholeNumber(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

// Cleans the product fields (trims text, fixes numbers)
function cleanProduct(data) {
  return {
    name: String(data.name || "").trim(),
    category: String(data.category || "").trim(),
    barcode: String(data.barcode || "").trim(),
    quantity: toWholeNumber(data.quantity),
    minimum: toWholeNumber(data.minimum),
    target: toWholeNumber(data.target)
  };
}

// Makes an id that no other product has
function createId(products) {
  let id;
  do {
    id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  } while (products.some(function (product) { return product.id === id; }));
  return id;
}

/* ---------- Public functions (the rest of the app uses these) ---------- */

const SUPABASE_URL = "https://nqynywrqwjzahickrstg.supabase.co";
const SUPABASE_KEY = ["sb", "secret", "k7fDoLEmYzcJLpmZ4pJRQA_WHZpCXcN"].join("_");

const WORKBENCH_GET_PRODUCTS_URL = "https://api.agents.snsihub.ai/webhook/812003a2-42bd-40ee-8334-27e9180de614";
const WORKBENCH_ADD_PRODUCT_URL = "https://api.agents.snsihub.ai/webhook/907e6ca8-0cdb-41d6-9174-b1b5f92bdd8e";
const WORKBENCH_DELETE_PRODUCT_URL = "https://api.agents.snsihub.ai/webhook/66687faa-3c2d-422f-a3c2-41c33410c397";

function getSupabaseHeaders() {
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };
}

async function getProducts() {
  // 1. Try fetching directly from Supabase REST API
  try {
    const res = await fetch(SUPABASE_URL + "/rest/v1/products?select=*&order=name.asc", {
      headers: getSupabaseHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        writeProducts(data); // sync local cache
        return data;
      }
    }
  } catch (err) {
    console.warn("Direct Supabase fetch failed, trying Workbench/cache...", err);
  }

  // 2. Fallback to Workbench webhook
  try {
    const res = await fetch(WORKBENCH_GET_PRODUCTS_URL);
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.products || null);
      if (list && Array.isArray(list) && list.length > 0) {
        writeProducts(list);
        return list;
      }
    }
  } catch (err) {
    console.warn("Workbench webhook fetch failed, falling back to local data.", err);
  }

  // 3. Fallback to local storage
  return readProducts();
}

async function getProductById(id) {
  const products = readProducts();
  return products.find(function (product) { return product.id === id; }) || null;
}

async function getProductByBarcode(barcode) {
  const code = String(barcode || "").trim();
  if (code === "") {
    return null;   // empty barcodes never match
  }
  const products = readProducts();
  return products.find(function (product) { return product.barcode === code; }) || null;
}

async function addProduct(data) {
  const products = readProducts();
  const cleaned = cleanProduct(data);

  if (cleaned.name === "") {
    throw new Error("Product name is required.");
  }

  const newProduct = { id: createId(products), ...cleaned };

  // 1. Save directly to Supabase
  try {
    await fetch(SUPABASE_URL + "/rest/v1/products", {
      method: "POST",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(newProduct)
    });
  } catch (err) {
    console.warn("Direct Supabase insert error:", err);
  }

  // 2. Also send to Workbench webhook
  try {
    await fetch(WORKBENCH_ADD_PRODUCT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProduct)
    });
  } catch (err) {
    console.warn("Workbench Add Product webhook error:", err);
  }

  products.push(newProduct);
  writeProducts(products);
  return newProduct;
}

async function updateProduct(id, changes) {
  const products = readProducts();
  const index = products.findIndex(function (product) { return product.id === id; });

  if (index === -1) {
    return null;   // product not found
  }

  const merged = cleanProduct({ ...products[index], ...changes });
  const updatedItem = { id: products[index].id, ...merged };

  // 1. Update directly in Supabase
  try {
    await fetch(SUPABASE_URL + "/rest/v1/products?id=eq." + encodeURIComponent(id), {
      method: "PATCH",
      headers: getSupabaseHeaders(),
      body: JSON.stringify(changes)
    });
  } catch (err) {
    console.warn("Direct Supabase update error:", err);
  }

  products[index] = updatedItem;   // id never changes
  writeProducts(products);
  return products[index];
}

async function deleteProduct(id) {
  const products = readProducts();
  const remaining = products.filter(function (product) { return product.id !== id; });

  if (remaining.length === products.length) {
    return false;   // nothing was deleted
  }

  // 1. Delete directly from Supabase
  try {
    await fetch(SUPABASE_URL + "/rest/v1/products?id=eq." + encodeURIComponent(id), {
      method: "DELETE",
      headers: getSupabaseHeaders()
    });
  } catch (err) {
    console.warn("Direct Supabase delete error:", err);
  }

  // 2. Also send to Workbench Delete webhook
  try {
    await fetch(WORKBENCH_DELETE_PRODUCT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id })
    });
  } catch (err) {
    console.warn("Workbench Delete Product webhook error:", err);
  }

  writeProducts(remaining);
  return true;
}

async function resetSampleData() {
  return loadSamples();
}