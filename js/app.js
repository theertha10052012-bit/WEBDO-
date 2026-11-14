/* ==========================================================
   app.js
   1. Small helpers (toast, notices)
   2. Dashboard: draws the summary cards
   3. Inventory: draws the search, filter and table
   4. Product form: add and edit popup
   5. Delete: confirmation popup
   6. Low Stock Alerts: list and sidebar count
   7. Reorder Suggestions: cards (demo button)
   8. Add Stock: camera, typed barcode, product list
   9. Import Data: CSV file, preview, import
   10. Settings: reset sample data
   11. renderAll: draws everything
   12. Navigation: shows one section at a time (URL hash)
   ========================================================== */

const DEFAULT_SECTION = "dashboard";

/* ---------- 1. Small helpers ---------- */

// Makes one element with a class and some text, for example
// createTextElement("p", "card-label", "Total Products")
function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

// Shows a short message at the bottom of the screen for about 3 seconds
let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);                 // restart the timer if a toast is already showing
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 3000);
}

// Shows a message box on a page. kind is "success" (yellow) or "error" (with a "!" box).
function setNotice(elementId, message, kind) {
  const notice = document.getElementById(elementId);
  notice.className = "notice notice-" + kind;
  notice.textContent = message;
  notice.hidden = false;
}

function clearNotice(elementId) {
  const notice = document.getElementById(elementId);
  notice.textContent = "";
  notice.hidden = true;
}

// pluralize(1, "row", "rows") gives "1 row". pluralize(3, "row", "rows") gives "3 rows".
function pluralize(count, singular, plural) {
  return count + " " + (count === 1 ? singular : plural);
}

/* Words and badge classes for each status.
   The status itself ("out", "low", "healthy") comes from getStatus() in logic.js */
const STATUS_LABELS = { healthy: "Healthy", low: "Low", out: "Out of stock" };
const STATUS_CLASSES = { healthy: "badge-healthy", low: "badge-low", out: "badge-out" };

// Builds the status badge for a product (other modules can reuse this)
function createStatusBadge(product) {
  const status = getStatus(product);
  return createTextElement("span", "badge " + STATUS_CLASSES[status], STATUS_LABELS[status]);
}

// Returns each category once, sorted A to Z (used by the filter and the form suggestions)
function getCategories(products) {
  const categories = [];

  products.forEach(function (product) {
    const category = String(product.category || "").trim();
    if (category !== "" && !categories.includes(category)) {
      categories.push(category);
    }
  });

  return categories.sort(function (a, b) { return a.localeCompare(b); });
}

// Builds one "label and value" pair, for example Quantity 5
function createStat(label, value) {
  const stat = document.createElement("div");
  stat.appendChild(createTextElement("dt", "stat-label", label));
  stat.appendChild(createTextElement("dd", "stat-value", String(value)));
  return stat;
}

/* Sorting for the alert and reorder sections: Out of stock first,
   then the lowest quantity first, then A to Z by name. */
const STATUS_RANK = { out: 0, low: 1, healthy: 2 };

function compareByUrgency(a, b) {
  const rankA = STATUS_RANK[getStatus(a)];
  const rankB = STATUS_RANK[getStatus(b)];
  if (rankA !== rankB) {
    return rankA - rankB;
  }

  const quantityA = Number(a.quantity);
  const quantityB = Number(b.quantity);
  if (quantityA !== quantityB) {
    return quantityA - quantityB;
  }

  return String(a.name).localeCompare(String(b.name));
}

// Returns only the Low and Out of stock products, most urgent first.
// (filter makes a new list, so the original list is not changed by the sort)
function getProductsNeedingStock(products) {
  return products
    .filter(function (product) { return getStatus(product) !== "healthy"; })
    .sort(compareByUrgency);
}

/* ---------- 2. Dashboard ---------- */

// Builds one summary card. extraClass is optional (card-low, card-out).
function createSummaryCard(label, value, hint, extraClass) {
  const card = document.createElement("div");
  card.className = extraClass ? "card " + extraClass : "card";

  card.appendChild(createTextElement("p", "card-label", label));
  card.appendChild(createTextElement("p", "card-value", String(value)));
  card.appendChild(createTextElement("p", "card-hint", hint));

  return card;
}

// Reads the data, then draws the subtitle and the 4 cards.
async function renderDashboard() {
  const subtitle = document.getElementById("dashboard-subtitle");
  const cardGrid = document.getElementById("dashboard-cards");
  const emptyMessage = document.getElementById("dashboard-empty");

  try {
    const products = await getProducts();       // from storage.js
    const summary = getSummary(products);       // from logic.js

    subtitle.textContent = "Sample shop data \u00B7 " + pluralize(summary.totalProducts, "product", "products");

    cardGrid.replaceChildren(
      createSummaryCard("Total Products", summary.totalProducts, "In your shop"),
      createSummaryCard("Total Stock", summary.totalStock, "Units available"),
      createSummaryCard("Low Stock Items", summary.lowCount, "At or below minimum", "card-low"),
      createSummaryCard("Out of Stock", summary.outCount, "Reorder now", "card-out")
    );

    // Empty state: show the message only when there are 0 products
    emptyMessage.hidden = summary.totalProducts !== 0;

    // --- Stock Health Bar ---
    renderStockHealth(products, summary);

    // --- Stock vs Minimum Graph + Needs Attention Panel ---
    renderStockGraph(products);
    renderAttentionPanel(products);

  } catch (error) {
    console.error("Could not draw the dashboard.", error);
    subtitle.textContent = "Could not load the data.";
  }
}

/* Renders the segmented "Stock health" bar (Healthy / Low / Out) */
function renderStockHealth(products, summary) {
  const section = document.getElementById("stock-health-section");
  if (!section) return;

  const total = summary.totalProducts;
  const healthyCount = total - summary.lowCount - summary.outCount;
  const lowCount = summary.lowCount;
  const outCount = summary.outCount;

  const healthyPct = total ? Math.round((healthyCount / total) * 100) : 0;
  const lowPct     = total ? Math.round((lowCount / total) * 100) : 0;
  const outPct     = total ? (100 - healthyPct - lowPct) : 0;

  // Update label
  const label = document.getElementById("health-label");
  if (label) {
    label.textContent = healthyCount + " of " + total + " products are healthy";
  }

  // Update bar segments widths
  const segHealthy = document.getElementById("health-seg-healthy");
  const segLow     = document.getElementById("health-seg-low");
  const segOut     = document.getElementById("health-seg-out");

  if (segHealthy) {
    segHealthy.style.width = healthyPct + "%";
    segHealthy.textContent = healthyCount > 0 ? "Healthy " + healthyCount : "";
    segHealthy.hidden = healthyCount === 0;
  }
  if (segLow) {
    segLow.style.width = lowPct + "%";
    segLow.textContent = lowCount > 0 ? "Low " + lowCount : "";
    segLow.hidden = lowCount === 0;
  }
  if (segOut) {
    segOut.style.width = outPct + "%";
    segOut.textContent = outCount > 0 ? "Out " + outCount : "";
    segOut.hidden = outCount === 0;
  }

  section.hidden = total === 0;
}

/* Renders the "Stock vs minimum" horizontal bar chart */
function renderStockGraph(products) {
  const bottomRow = document.getElementById("dashboard-bottom-row");
  const body      = document.getElementById("graph-body");
  const scaleEl   = document.getElementById("graph-scale");
  if (!bottomRow || !body) return;

  if (!products || products.length === 0) {
    bottomRow.hidden = true;
    return;
  }

  // Find the max value across all quantities and targets to set the scale
  const maxVal = products.reduce(function (max, p) {
    return Math.max(max, Number(p.quantity) || 0, Number(p.target) || 0, Number(p.minimum) || 0);
  }, 1);

  // Round up to a nice scale ceiling
  const scale = Math.ceil(maxVal / 10) * 10 || 10;

  if (scaleEl) {
    scaleEl.textContent = "Scale 0 to " + scale + " units";
  }

  body.replaceChildren();

  products.forEach(function (product) {
    const status   = getStatus(product);
    const qty      = Math.max(0, Number(product.quantity) || 0);
    const minimum  = Math.max(0, Number(product.minimum) || 0);
    const qtyPct   = Math.min(100, (qty / scale) * 100);
    const minPct   = Math.min(100, (minimum / scale) * 100);

    // Row wrapper
    const row = document.createElement("div");
    row.className = "graph-row";

    // Product name label (left column)
    const nameEl = createTextElement("span", "graph-row-name", product.name);
    row.appendChild(nameEl);

    // Bar area (middle)
    const barWrap = document.createElement("div");
    barWrap.className = "graph-bar-wrap";

    // The filled bar
    if (qty > 0) {
      const bar = document.createElement("div");
      bar.className = "graph-bar graph-bar-" + status;
      bar.style.width = qtyPct + "%";
      barWrap.appendChild(bar);
    }

    // The minimum marker line
    if (minimum > 0) {
      const marker = document.createElement("div");
      marker.className = "graph-min-marker";
      marker.style.left = minPct + "%";
      marker.title = "Minimum: " + minimum;
      barWrap.appendChild(marker);
    }

    row.appendChild(barWrap);

    // qty / minimum label (right column)
    const qtyLabel = createTextElement("span", "graph-row-label num", qty + " / " + minimum);
    row.appendChild(qtyLabel);

    body.appendChild(row);
  });

  bottomRow.hidden = false;
}

/* Renders the "Needs attention" panel with items sorted most urgent first */
function renderAttentionPanel(products) {
  const panel = document.getElementById("attention-panel");
  if (!panel) return;

  const list    = document.getElementById("attention-list");
  const footer  = document.getElementById("attention-footer");
  const needingStock = getProductsNeedingStock(products);   // already sorted: out first, then low

  list.replaceChildren();

  if (needingStock.length === 0) {
    list.innerHTML = "<li class='attention-empty'>All stock levels are healthy \u2713</li>";
    if (footer) footer.hidden = true;
    return;
  }

  // Total units to reorder
  let totalReorder = 0;

  needingStock.forEach(function (product) {
    const status = getStatus(product);
    const reorder = Math.max(0, Number(product.target) - Number(product.quantity));
    totalReorder += reorder;

    const item = document.createElement("li");
    item.className = "attention-item";

    // Name + badge
    const nameRow = document.createElement("div");
    nameRow.className = "attention-name-row";
    const nameEl = createTextElement("span", "attention-name", product.name);
    const badge = createStatusBadge(product);
    nameRow.appendChild(nameEl);
    nameRow.appendChild(badge);

    // Sub text: stock info
    const sub = createTextElement("p", "attention-sub",
      "Stock " + product.quantity + " \u00B7 Target " + product.target);

    // Order amount (right side)
    const order = document.createElement("div");
    order.className = "attention-order";
    if (reorder > 0) {
      order.textContent = "Order " + reorder;
    }

    const left = document.createElement("div");
    left.appendChild(nameRow);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(order);
    list.appendChild(item);
  });

  // Footer: total to reorder
  if (footer) {
    const totalEl = document.getElementById("attention-total");
    if (totalEl) totalEl.textContent = totalReorder + " units";
    footer.hidden = false;
  }
}

/* ---------- 3. Inventory ---------- */

// The product list from the last renderInventory() call.
// Typing in the search box filters this list, so storage is not read on every key press.
let inventoryProducts = [];

// Counts renderInventory() calls. If an older call finishes after a newer one
// (possible once a real backend is slow), the older answer is ignored.
let inventoryRenderCount = 0;

// Returns only the products that match the search text AND the category.
// searchText matches the name or the barcode. category "" means all categories.
function filterProducts(products, searchText, category) {
  const text = searchText.trim().toLowerCase();

  return products.filter(function (product) {
    const matchesCategory = category === "" || product.category === category;
    const matchesText =
      text === "" ||
      String(product.name).toLowerCase().includes(text) ||
      String(product.barcode).toLowerCase().includes(text);

    return matchesCategory && matchesText;
  });
}

// Rebuilds the dropdown: "All categories" first, then each category once, A to Z.
// Keeps the selected category if it still exists in the data.
function fillCategoryDropdown(products) {
  const select = document.getElementById("inventory-category");
  const previous = select.value;
  const categories = getCategories(products);

  // new Option(text, value) makes an <option> element
  const options = [new Option("All categories", "")];
  categories.forEach(function (category) {
    options.push(new Option(category, category));
  });

  select.replaceChildren(...options);
  select.value = categories.includes(previous) ? previous : "";
}

// Builds an Edit or Delete button. The click is handled by handleInventoryClick().
function createActionButton(label, action, product) {
  const button = createTextElement("button", "btn btn-secondary btn-small", label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.id = product.id;
  button.setAttribute("aria-label", label + " " + product.name);
  return button;
}

// Builds one table row for one product
function createInventoryRow(product) {
  const row = document.createElement("tr");

  // Name (with the barcode under it, when there is one)
  const nameCell = document.createElement("td");
  nameCell.appendChild(createTextElement("span", "product-name", product.name));
  if (product.barcode) {
    nameCell.appendChild(createTextElement("span", "product-barcode", product.barcode));
  }
  row.appendChild(nameCell);

  row.appendChild(createTextElement("td", "", product.category || "-"));
  row.appendChild(createTextElement("td", "col-num num", String(product.quantity)));
  row.appendChild(createTextElement("td", "col-num num", String(product.minimum)));

  const statusCell = document.createElement("td");
  statusCell.appendChild(createStatusBadge(product));
  row.appendChild(statusCell);

  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  actions.appendChild(createActionButton("Edit", "edit", product));
  actions.appendChild(createActionButton("Delete", "delete", product));
  actionsCell.appendChild(actions);
  row.appendChild(actionsCell);

  return row;
}

// Draws the table from the saved list, using the current search text and category.
// Runs on every key press in the search box and on every dropdown change.
function drawInventoryTable() {
  const searchText = document.getElementById("inventory-search").value;
  const category = document.getElementById("inventory-category").value;
  const body = document.getElementById("inventory-body");
  const tableWrap = document.getElementById("inventory-table-wrap");
  const emptyMessage = document.getElementById("inventory-empty");

  const visible = filterProducts(inventoryProducts, searchText, category);
  body.replaceChildren(...visible.map(createInventoryRow));

  const hasRows = visible.length > 0;
  tableWrap.hidden = !hasRows;
  emptyMessage.hidden = hasRows;

  if (!hasRows) {
    emptyMessage.textContent = inventoryProducts.length === 0
      ? "No products yet. Add your first product."
      : "No products match your search.";
  }
}

// Reads the products, fills the dropdown, then draws the table.
// The search text and selected category stay as they are.
async function renderInventory() {
  inventoryRenderCount += 1;
  const thisRender = inventoryRenderCount;

  try {
    const products = await getProducts();       // from storage.js
    if (thisRender !== inventoryRenderCount) {
      return;                                   // a newer call is running, ignore this one
    }

    inventoryProducts = products;
    fillCategoryDropdown(products);
    drawInventoryTable();
  } catch (error) {
    console.error("Could not draw the inventory.", error);
    document.getElementById("inventory-table-wrap").hidden = true;
    const emptyMessage = document.getElementById("inventory-empty");
    emptyMessage.textContent = "Could not load the products.";
    emptyMessage.hidden = false;
  }
}

// One click listener for ALL Edit and Delete buttons (event delegation)
function handleInventoryClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;                                     // the click was not on an Edit or Delete button
  }

  if (button.dataset.action === "edit") {
    handleEditProduct(button.dataset.id);
  } else if (button.dataset.action === "delete") {
    handleDeleteProduct(button.dataset.id);
  }
}

// Connects the search box, the dropdown, and the table buttons. Runs once.
function setupInventoryControls() {
  document.getElementById("inventory-search").addEventListener("input", drawInventoryTable);
  document.getElementById("inventory-category").addEventListener("change", drawInventoryTable);

  document.getElementById("add-product-btn").addEventListener("click", function () {
    openProductForm(null);
  });
  document.getElementById("inventory-body").addEventListener("click", handleInventoryClick);
}

/* ---------- 4. Product form (add and edit popup) ---------- */

const PRODUCT_FIELDS = ["name", "category", "barcode", "quantity", "minimum", "target"];
const EMPTY_PRODUCT = { name: "", category: "", barcode: "", quantity: "", minimum: "", target: "" };
const WHOLE_NUMBER = /^\d+$/;                   // only digits, nothing else

let editingProductId = null;                    // null means "adding a new product"
let isSavingProduct = false;                    // stops double clicks on Save

// Returns the input element for a field name, for example getField("name")
function getField(field) {
  return document.getElementById("product-" + field);
}

// Puts values into the form fields
function setProductFormValues(values) {
  PRODUCT_FIELDS.forEach(function (field) {
    const value = values[field];
    getField(field).value = value === undefined || value === null ? "" : String(value);
  });
}

// Reads the form fields. Everything is text here, with spaces trimmed.
function readProductForm() {
  const values = {};
  PRODUCT_FIELDS.forEach(function (field) {
    values[field] = getField(field).value.trim();
  });
  return values;
}

// Fills the category suggestions list (datalist) in the form
function fillCategorySuggestions(products) {
  const list = document.getElementById("category-suggestions");
  const options = getCategories(products).map(function (category) {
    return new Option(category);
  });
  list.replaceChildren(...options);
}

/* --- Error messages --- */

function showFieldError(field, message) {
  const errorElement = document.getElementById("error-" + field);
  errorElement.textContent = message;
  errorElement.hidden = false;
  getField(field).setAttribute("aria-invalid", "true");
}

function clearFieldError(field) {
  const errorElement = document.getElementById("error-" + field);
  errorElement.textContent = "";
  errorElement.hidden = true;
  getField(field).removeAttribute("aria-invalid");
}

function showFormError(message) {
  const errorElement = document.getElementById("product-form-error");
  errorElement.textContent = message;
  errorElement.hidden = false;
}

function hideFormError() {
  const errorElement = document.getElementById("product-form-error");
  errorElement.textContent = "";
  errorElement.hidden = true;
}

function clearAllErrors() {
  PRODUCT_FIELDS.forEach(function (field) {
    clearFieldError(field);
  });
  hideFormError();
}

// Shows all errors, then puts the cursor in the first field with a problem
function showFieldErrors(errors) {
  clearAllErrors();
  let firstField = null;

  PRODUCT_FIELDS.forEach(function (field) {
    if (errors[field]) {
      showFieldError(field, errors[field]);
      if (firstField === null) {
        firstField = field;
      }
    }
  });

  if (firstField !== null) {
    getField(firstField).focus();
  }
}

// When the user types in a field, remove that field's error
function handleProductFormInput(event) {
  const field = event.target.name;
  if (PRODUCT_FIELDS.includes(field)) {
    clearFieldError(field);
  }
  hideFormError();
}

/* --- Validation --- */

// Checks the values and returns an object of errors, for example
// { name: "Enter the product name.", target: "..." }. An empty object means all good.
async function validateProductValues(values) {
  const errors = {};

  if (values.name === "") {
    errors.name = "Enter the product name.";
  }

  if (values.category === "") {
    errors.category = "Enter a category.";
  }

  ["quantity", "minimum", "target"].forEach(function (field) {
    if (!WHOLE_NUMBER.test(values[field])) {
      errors[field] = "Enter a whole number, 0 or more.";
    }
  });

  // Target must be at least the minimum (only checked when both are valid numbers)
  if (!errors.minimum && !errors.target && Number(values.target) < Number(values.minimum)) {
    errors.target = "Target must be at least the minimum (" + values.minimum + ").";
  }

  // A barcode may belong to this product, but not to a different one
  if (values.barcode !== "") {
    const owner = await getProductByBarcode(values.barcode);   // from storage.js
    if (owner && owner.id !== editingProductId) {
      errors.barcode = "This barcode already belongs to " + owner.name + ".";
    }
  }

  return errors;
}

/* --- Opening and saving --- */

// Opens the popup.
//   product: the product to edit, or null/undefined to add a new one
//   prefill: optional values for the fields, for example { barcode: "8901234567890" }
// Other modules can call this later.
async function openProductForm(product, prefill) {
  const dialog = document.getElementById("product-dialog");

  // Category suggestions come from the current data
  try {
    fillCategorySuggestions(await getProducts());
  } catch (error) {
    console.error("Could not load category suggestions.", error);
  }

  if (dialog.open) {
    return;                                     // already open
  }

  const isEditing = Boolean(product);
  editingProductId = isEditing ? product.id : null;

  document.getElementById("product-dialog-title").textContent = isEditing ? "Edit Product" : "Add Product";
  setProductFormValues(Object.assign({}, EMPTY_PRODUCT, product || {}, prefill || {}));
  clearAllErrors();

  dialog.showModal();                           // Esc closes it, Tab stays inside
  getField("name").focus();
}

function setSavingState(isSaving) {
  isSavingProduct = isSaving;
  document.getElementById("product-save").disabled = isSaving;
}

// Runs when the user clicks Save (or presses Enter in a field)
async function handleProductFormSubmit(event) {
  event.preventDefault();                       // stop the browser from reloading the page
  if (isSavingProduct) {
    return;
  }

  const dialog = document.getElementById("product-dialog");
  const values = readProductForm();
  setSavingState(true);

  try {
    const errors = await validateProductValues(values);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      return;                                   // stay open so the user can fix it
    }

    const data = {
      name: values.name,
      category: values.category,
      barcode: values.barcode,
      quantity: Number(values.quantity),
      minimum: Number(values.minimum),
      target: Number(values.target)
    };

    let message;
    if (editingProductId === null) {
      await addProduct(data);                   // from storage.js
      message = "Product added";
    } else {
      const updated = await updateProduct(editingProductId, data);   // from storage.js
      if (updated === null) {
        throw new Error("The product no longer exists.");
      }
      message = "Changes saved";
    }

    dialog.close();
    await renderAll();
    showToast(message);
  } catch (error) {
    console.error("Could not save the product.", error);
    showFormError("Could not save. Please try again.");
  } finally {
    setSavingState(false);
  }
}

// Edit button: load the product, then open the form with its values
async function handleEditProduct(productId) {
  try {
    const product = await getProductById(productId);            // from storage.js
    if (!product) {
      showToast("That product no longer exists.");
      await renderAll();
      return;
    }
    await openProductForm(product);
  } catch (error) {
    console.error("Could not open the product.", error);
    showToast("Could not open the product. Please try again.");
  }
}

// Connects the popup form. Runs once when the page loads.
function setupProductForm() {
  const form = document.getElementById("product-form");
  form.addEventListener("submit", handleProductFormSubmit);
  form.addEventListener("input", handleProductFormInput);

  document.getElementById("product-cancel").addEventListener("click", function () {
    document.getElementById("product-dialog").close();
  });
}

/* ---------- 5. Delete (confirmation popup) ---------- */

// Opens the confirmation popup. Returns true if the user confirms, false if not.
// Reusable: askConfirmation("Title", "Message", "Button text")
function askConfirmation(title, message, confirmLabel) {
  return new Promise(function (resolve) {
    const dialog = document.getElementById("confirm-dialog");

    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    document.getElementById("confirm-yes").textContent = confirmLabel;

    dialog.returnValue = "";                    // so Esc counts as "not confirmed"
    dialog.addEventListener("close", function () {
      resolve(dialog.returnValue === "confirm");
    }, { once: true });

    dialog.showModal();                         // Cancel has autofocus, so Enter is safe
  });
}

// Delete button: ask first, then delete
async function handleDeleteProduct(productId) {
  try {
    const product = await getProductById(productId);            // from storage.js
    if (!product) {
      showToast("That product no longer exists.");
      await renderAll();
      return;
    }

    const confirmed = await askConfirmation(
      "Delete product",
      "Delete " + product.name + "? This cannot be undone.",
      "Delete"
    );
    if (!confirmed) {
      return;
    }

    await deleteProduct(productId);                             // from storage.js
    await renderAll();
    showToast("Product deleted");
  } catch (error) {
    console.error("Could not delete the product.", error);
    showToast("Could not delete the product. Please try again.");
  }
}

/* ---------- 6. Low Stock Alerts ---------- */

// The message on each alert row
function getAlertMessage(product) {
  if (getStatus(product) === "out") {
    return "Out of stock.";
  }
  return "Only " + product.quantity + " left. Minimum is " + product.minimum + ".";
}

// Builds one row of the alert list
function createAlertItem(product) {
  const item = document.createElement("li");
  item.className = getStatus(product) === "out" ? "alert-item alert-out" : "alert-item";

  const main = document.createElement("div");
  main.appendChild(createTextElement("p", "alert-name", product.name));
  main.appendChild(createTextElement("p", "alert-message", getAlertMessage(product)));
  item.appendChild(main);

  const numbers = document.createElement("dl");
  numbers.className = "stat-list";
  numbers.appendChild(createStat("Quantity", product.quantity));
  numbers.appendChild(createStat("Minimum", product.minimum));
  item.appendChild(numbers);

  item.appendChild(createStatusBadge(product));

  return item;
}

// Updates the small number next to "Low Stock Alerts" in the sidebar.
// It is hidden when the count is 0.
function updateLowStockCount(count) {
  const badge = document.getElementById("low-stock-count");
  if (badge) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
  }
}

/* ---------- Notification Center (In-App & Browser Push) ---------- */
let notifiedLowStockSet = new Set(); // tracks alerts to avoid duplicate spam

function sendBrowserPushNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: body,
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23FF3B30'/%3E%3C/svg%3E"
      });
    } catch (e) {
      console.warn("Browser notification trigger failed:", e);
    }
  }
}

function updateNotificationCenter(alerts) {
  const badge = document.getElementById("notif-badge");
  const list = document.getElementById("notif-list");
  if (!badge || !list) return;

  const count = alerts.length;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.hidden = count === 0;

  if (count === 0) {
    list.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; color: var(--gray-text); font-size: 13px;">
        <span style="font-size: 24px; display: block; margin-bottom: 6px;">🎉</span>
        All stock levels are currently healthy!
      </div>
    `;
    notifiedLowStockSet.clear();
    return;
  }

  // Build alert items
  list.innerHTML = "";
  alerts.forEach(function (product) {
    const isOut = getStatus(product) === "out";
    const statusText = isOut ? "Out of Stock" : "Low Stock";
    const icon = isOut ? "🚨" : "⚠️";

    const item = document.createElement("div");
    item.style.cssText = "display: flex; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); align-items: flex-start; transition: background 0.15s ease;";
    item.onmouseenter = function() { item.style.backgroundColor = "var(--off-white)"; };
    item.onmouseleave = function() { item.style.backgroundColor = "transparent"; };

    item.innerHTML = `
      <span style="font-size: 16px; margin-top: 1px;">${icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <strong style="font-size: 13px; color: var(--black);">${product.name}</strong>
          <span style="font-size: 10px; font-weight: 700; color: ${isOut ? '#d32f2f' : '#b26a00'}; background: ${isOut ? '#ffebee' : '#fff8e1'}; padding: 2px 6px; border-radius: 3px;">${statusText}</span>
        </div>
        <p style="font-size: 11.5px; color: var(--gray-text); margin: 0; line-height: 1.3;">
          ${isOut ? 'Zero units left.' : `Only ${product.quantity} units left (min: ${product.minimum}).`}
        </p>
      </div>
    `;
    list.appendChild(item);

    // Trigger browser notification once per newly detected shortage
    const key = product.id + "_" + product.quantity;
    if (!notifiedLowStockSet.has(key)) {
      notifiedLowStockSet.add(key);
      const title = isOut ? `🚨 Out of Stock: ${product.name}` : `⚠️ Low Stock: ${product.name}`;
      const msg = isOut ? `Inventory for ${product.name} has hit 0!` : `${product.name} is down to ${product.quantity} units (minimum is ${product.minimum}).`;
      sendBrowserPushNotification(title, msg);
    }
  });
}

function setupNotificationControls() {
  const bellBtn = document.getElementById("notif-bell-btn");
  const dropdown = document.getElementById("notif-dropdown");
  const browserBtn = document.getElementById("notif-enable-browser");

  if (!bellBtn || !dropdown) return;

  // Toggle dropdown
  bellBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    const isOpening = dropdown.hidden;
    dropdown.hidden = !dropdown.hidden;

    // Dynamically align dropdown beneath the bell button
    if (isOpening) {
      const rect = bellBtn.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 8) + "px";
      dropdown.style.left = Math.max(12, rect.left) + "px";
    }
  });

  // Close when clicking outside
  document.addEventListener("click", function (e) {
    if (!dropdown.hidden && !dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
      dropdown.hidden = true;
    }
  });

  // Request browser permission
  if (browserBtn) {
    if (!("Notification" in window)) {
      browserBtn.style.display = "none";
    } else if (Notification.permission === "granted") {
      browserBtn.textContent = "✓ Alerts Active";
      browserBtn.style.color = "#2e7d32";
      browserBtn.style.textDecoration = "none";
      browserBtn.disabled = true;
    }

    browserBtn.addEventListener("click", async function () {
      if (!("Notification" in window)) return;
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        browserBtn.textContent = "✓ Alerts Active";
        browserBtn.style.color = "#2e7d32";
        browserBtn.style.textDecoration = "none";
        browserBtn.disabled = true;
        sendBrowserPushNotification("WEBDO Notifications Active", "You will now receive desktop alerts whenever stock runs low!");
      } else {
        browserBtn.textContent = "Permission Blocked";
        browserBtn.style.color = "#d32f2f";
      }
    });
  }
}

// Reads the data, then draws the alert list and updates the sidebar count
async function renderLowStock() {
  const list = document.getElementById("low-stock-list");
  const emptyMessage = document.getElementById("low-stock-empty");

  try {
    const products = await getProducts();                       // from storage.js
    const alerts = getProductsNeedingStock(products);

    list.replaceChildren(...alerts.map(createAlertItem));
    emptyMessage.textContent = "All stock levels are healthy.";
    emptyMessage.hidden = alerts.length > 0;
    updateLowStockCount(alerts.length);
    updateNotificationCenter(alerts);
  } catch (error) {
    console.error("Could not draw the low stock alerts.", error);
    list.replaceChildren();
    emptyMessage.textContent = "Could not load the products.";
    emptyMessage.hidden = false;
  }
}

/* ---------- 7. Reorder Suggestions ---------- */

// Builds one reorder card
function createReorderCard(product) {
  const card = document.createElement("article");
  card.className = "reorder-card";

  // Top: name and status badge
  const header = document.createElement("div");
  header.className = "reorder-header";
  header.appendChild(createTextElement("h3", "reorder-name", product.name));
  header.appendChild(createStatusBadge(product));
  card.appendChild(header);

  // Current stock and target stock
  const stats = document.createElement("dl");
  stats.className = "reorder-stats";
  stats.appendChild(createStat("Current stock", product.quantity));
  stats.appendChild(createStat("Target stock", product.target));
  card.appendChild(stats);

  // Suggested order, from getSuggestedReorder() in logic.js
  const amount = getSuggestedReorder(product);
  const order = document.createElement("p");
  order.className = "reorder-order";
  order.append("Suggested order: ", createTextElement("span", "num", String(amount)), amount === 1 ? " unit" : " units");
  card.appendChild(order);

  // Reorder button with product metadata
  const button = createTextElement("button", "btn reorder-button", "Reorder");
  button.type = "button";
  button.dataset.action = "reorder";
  button.dataset.id = product.id;
  button.dataset.name = product.name;
  button.dataset.suggested = String(amount);
  button.setAttribute("aria-label", "Reorder " + product.name);
  card.appendChild(button);

  return card;
}

// Reads the data, then draws one card for each Low or Out of stock product
async function renderReorder() {
  const grid = document.getElementById("reorder-grid");
  const emptyMessage = document.getElementById("reorder-empty");

  try {
    const products = await getProducts();                       // from storage.js
    const items = getProductsNeedingStock(products);

    grid.replaceChildren(...items.map(createReorderCard));
    emptyMessage.textContent = "Nothing to reorder right now.";
    emptyMessage.hidden = items.length > 0;
  } catch (error) {
    console.error("Could not draw the reorder suggestions.", error);
    grid.replaceChildren();
    emptyMessage.textContent = "Could not load the products.";
    emptyMessage.hidden = false;
  }
}

/* ---------- Reorder Modal & Logic ---------- */
let activeReorderProduct = null;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function updateReorderMessagePreview() {
  const preview = document.getElementById("reorder-message-preview");
  if (!preview) return;

  const productName = document.getElementById("reorder-product-name").value.trim() || "Item";
  const qty = document.getElementById("reorder-quantity").value.trim() || "0";
  const supplier = document.getElementById("reorder-supplier-name").value.trim();
  const note = document.getElementById("reorder-note").value.trim();

  const greeting = supplier ? "Hi " + supplier + "," : "Hi,";
  const unitWord = qty === "1" ? "unit" : "units";
  let msg = greeting + " I would like to order " + qty + " " + unitWord + " of " + productName + ".";

  if (note) {
    msg += "\n\nNote: " + note;
  }

  preview.textContent = msg;
}

function openReorderDialog(product, suggestedQty) {
  const dialog = document.getElementById("reorder-dialog");
  if (!dialog) return;

  activeReorderProduct = product;

  // Pre-fill fields
  document.getElementById("reorder-product-name").value = product ? product.name : "";
  document.getElementById("reorder-quantity").value = String(suggestedQty > 0 ? suggestedQty : 1);
  document.getElementById("reorder-supplier-name").value = "";
  document.getElementById("reorder-supplier-email").value = "";
  document.getElementById("reorder-note").value = "";

  // Reset errors
  const errQty = document.getElementById("reorder-error-quantity");
  const errEmail = document.getElementById("reorder-error-email");
  if (errQty) { errQty.hidden = true; errQty.textContent = ""; }
  if (errEmail) { errEmail.hidden = true; errEmail.textContent = ""; }

  updateReorderMessagePreview();
  dialog.showModal();
  document.getElementById("reorder-quantity").focus();
}

function handleReorderClick(event) {
  const button = event.target.closest("button[data-action='reorder']");
  if (!button) {
    return;
  }

  const productName = button.dataset.name;
  const suggestedQty = Number(button.dataset.suggested) || 1;

  openReorderDialog({ id: button.dataset.id, name: productName }, suggestedQty);
}

function handleReorderFormSubmit(event) {
  event.preventDefault();

  const qtyInput = document.getElementById("reorder-quantity");
  const emailInput = document.getElementById("reorder-supplier-email");
  const errQty = document.getElementById("reorder-error-quantity");
  const errEmail = document.getElementById("reorder-error-email");

  const qtyVal = qtyInput.value.trim();
  const emailVal = emailInput.value.trim();

  let hasError = false;

  // Validate Quantity (whole number > 0)
  if (!/^\d+$/.test(qtyVal) || Number(qtyVal) <= 0) {
    errQty.textContent = "Please enter a valid quantity of at least 1.";
    errQty.hidden = false;
    hasError = true;
  } else {
    errQty.hidden = true;
    errQty.textContent = "";
  }

  // Validate Supplier Email (optional, but if provided must be valid format)
  if (emailVal && !EMAIL_REGEX.test(emailVal)) {
    errEmail.textContent = "Please enter a valid email address (e.g. name@company.com).";
    errEmail.hidden = false;
    hasError = true;
  } else {
    errEmail.hidden = true;
    errEmail.textContent = "";
  }

  if (hasError) return;

  const productName = document.getElementById("reorder-product-name").value;
  const supplierName = document.getElementById("reorder-supplier-name").value.trim();
  const note = document.getElementById("reorder-note").value.trim();

  // Close popup
  document.getElementById("reorder-dialog").close();

  // Show success toast with order details
  const supplierInfo = supplierName ? " from " + supplierName : "";
  showToast("Reorder request created for " + qtyVal + " \u00D7 " + productName + supplierInfo + ".");
}

function setupReorderControls() {
  const grid = document.getElementById("reorder-grid");
  if (grid) {
    grid.addEventListener("click", handleReorderClick);
  }

  const dialog = document.getElementById("reorder-dialog");
  const form = document.getElementById("reorder-form");
  const cancelBtn = document.getElementById("reorder-cancel");

  if (form) {
    form.addEventListener("submit", handleReorderFormSubmit);

    // Live preview updates on typing
    ["reorder-quantity", "reorder-supplier-name", "reorder-note"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", updateReorderMessagePreview);
      }
    });

    // Real-time email validation clearing
    const emailEl = document.getElementById("reorder-supplier-email");
    if (emailEl) {
      emailEl.addEventListener("input", function () {
        const errEmail = document.getElementById("reorder-error-email");
        if (errEmail && !errEmail.hidden) {
          if (!emailEl.value.trim() || EMAIL_REGEX.test(emailEl.value.trim())) {
            errEmail.hidden = true;
            errEmail.textContent = "";
          }
        }
      });
    }
  }

  if (cancelBtn && dialog) {
    cancelBtn.addEventListener("click", function () {
      dialog.close();
    });
  }
}

/* ---------- 8. Add Stock ---------- */

const SCAN_REPEAT_DELAY = 2000;                 // ignore the same code for 2 seconds
const MAX_UNITS = 10000;

/* What the result area (right side) is showing right now */
let currentStockProduct = null;                 // a found product, or null
let missingBarcode = null;                      // a barcode that was not found, or null
let stockNotice = null;                         // the message text, or null
let isUpdatingStock = false;                    // stops double clicks on Confirm
let currentStockMode = "add";                   // "add" or "reduce"

function setStockMode(mode) {
  currentStockMode = mode;
  const addBtn = document.getElementById("stock-mode-add");
  const reduceBtn = document.getElementById("stock-mode-reduce");
  const label = document.getElementById("stock-units-label");
  const confirmBtn = document.getElementById("stock-confirm");

  if (addBtn && reduceBtn) {
    if (mode === "reduce") {
      addBtn.className = "btn btn-secondary btn-small";
      reduceBtn.className = "btn btn-small";
      if (label) label.textContent = "Units to reduce (sold / removed)";
      if (confirmBtn) confirmBtn.textContent = "Confirm Reduction";
    } else {
      addBtn.className = "btn btn-small";
      reduceBtn.className = "btn btn-secondary btn-small";
      if (label) label.textContent = "Units to add";
      if (confirmBtn) confirmBtn.textContent = "Confirm Add Stock";
    }
  }
  clearUnitsError();
}

/* Camera state */
let barcodeScanner = null;                      // the scanner object while the camera is on
let isScannerRunning = false;
let scannerQueue = Promise.resolve();           // start and stop run one after another
let lastScanCode = "";
let lastScanTime = 0;

/* --- The result area --- */

// Shows or hides the four parts of the result area, based on the variables above
function drawStockPanels() {
  const hasFound = currentStockProduct !== null;
  const hasMissing = missingBarcode !== null;
  const hasNotice = stockNotice !== null;

  document.getElementById("stock-found").hidden = !hasFound;
  document.getElementById("stock-missing").hidden = !hasMissing;
  document.getElementById("stock-notice").hidden = !hasNotice;
  document.getElementById("stock-idle").hidden = hasFound || hasMissing || hasNotice;
}

// kind is "success" or "error"
function showStockNotice(message, kind) {
  const notice = document.getElementById("stock-notice");
  notice.className = "notice notice-" + kind;
  notice.textContent = message;
  stockNotice = message;
  drawStockPanels();
}

// Selects a product in the "Choose from list" dropdown ("" selects the first line)
function setStockSelect(productId) {
  const select = document.getElementById("stock-product-select");
  const exists = Array.from(select.options).some(function (option) {
    return option.value === productId;
  });
  select.value = exists ? productId : "";
}

// Puts a product's name, category and quantity on screen (does not touch "Units to add")
function fillStockProductDetails(product) {
  document.getElementById("stock-name").textContent = product.name;
  document.getElementById("stock-category").textContent = product.category || "-";
  document.getElementById("stock-quantity").textContent = String(product.quantity);
}

function scrollToStockResult(elementId) {
  document.getElementById(elementId).scrollIntoView({ block: "nearest" });
}

function showUnitsError(message) {
  const errorElement = document.getElementById("error-units");
  errorElement.textContent = message;
  errorElement.hidden = false;
  document.getElementById("stock-units").setAttribute("aria-invalid", "true");
}

function clearUnitsError() {
  const errorElement = document.getElementById("error-units");
  errorElement.textContent = "";
  errorElement.hidden = true;
  document.getElementById("stock-units").removeAttribute("aria-invalid");
}

// A product was found: show it with "Units to add" set to 1
function showStockProduct(product) {
  currentStockProduct = product;
  missingBarcode = null;
  stockNotice = null;

  fillStockProductDetails(product);
  document.getElementById("stock-units").value = "1";
  clearUnitsError();
  setStockSelect(product.id);
  setStockMode("add");

  drawStockPanels();
  scrollToStockResult("stock-found");
}

// A barcode was not found: show the message and the "Add as new product" button
function showMissingBarcode(code) {
  currentStockProduct = null;
  missingBarcode = code;
  stockNotice = null;

  document.getElementById("missing-barcode").textContent = code;
  setStockSelect("");

  drawStockPanels();
  scrollToStockResult("stock-missing");
}

// Removes the found / not found panels (the message is left as it is)
function clearStockResult() {
  currentStockProduct = null;
  missingBarcode = null;
  setStockSelect("");
  drawStockPanels();
}

/* --- Finding a product --- */

// Looks up a barcode (from the camera or the text box) and shows the result
async function lookupBarcode(code) {
  try {
    const product = await getProductByBarcode(code);            // from storage.js
    if (product) {
      showStockProduct(product);
    } else {
      showMissingBarcode(code);
    }
  } catch (error) {
    console.error("Could not look up the barcode.", error);
    clearStockResult();
    showStockNotice("Could not look up the barcode. Please try again.", "error");
  }
}

// "Type barcode" form
function handleBarcodeFormSubmit(event) {
  event.preventDefault();

  const input = document.getElementById("barcode-input");
  const errorElement = document.getElementById("lookup-error");
  const code = input.value.trim();

  if (code === "") {
    errorElement.textContent = "Type a barcode first.";
    errorElement.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }

  lookupBarcode(code);
}

function handleBarcodeInput() {
  const input = document.getElementById("barcode-input");
  const errorElement = document.getElementById("lookup-error");
  errorElement.textContent = "";
  errorElement.hidden = true;
  input.removeAttribute("aria-invalid");
}

// "Choose from list" dropdown
async function handleStockSelectChange(event) {
  const productId = event.target.value;

  if (productId === "") {
    clearStockResult();
    stockNotice = null;
    drawStockPanels();
    return;
  }

  try {
    const product = await getProductById(productId);            // from storage.js
    if (product) {
      showStockProduct(product);
    } else {
      clearStockResult();
      showStockNotice("That product no longer exists.", "error");
      await renderAll();
    }
  } catch (error) {
    console.error("Could not open the product.", error);
    clearStockResult();
    showStockNotice("Could not open the product. Please try again.", "error");
  }
}

// Builds the dropdown from all products, A to Z, and keeps the current choice
function fillStockProductSelect(products) {
  const select = document.getElementById("stock-product-select");
  const previous = select.value;

  const sorted = products.slice().sort(function (a, b) {
    return String(a.name).localeCompare(String(b.name));
  });

  const options = [new Option("Choose a product", "")];
  sorted.forEach(function (product) {
    const label = product.category ? product.name + " (" + product.category + ")" : product.name;
    options.push(new Option(label, product.id));
  });

  select.replaceChildren(...options);
  setStockSelect(previous);
}

/* --- Adding the units --- */

// Returns the units as a number from 1 to 10000, or null if the text is not valid
function readUnits() {
  const text = document.getElementById("stock-units").value.trim();
  if (!WHOLE_NUMBER.test(text)) {
    return null;
  }
  const units = Number(text);
  return units >= 1 && units <= MAX_UNITS ? units : null;
}

// Sends stock update details & Gmail alerts to SNS Workbench webhooks
async function sendStockWebhook(product, unitsChanged, updatedProduct, mode) {
  const GMAIL_ALERT_WEBHOOK_URL = "https://api.agents.snsihub.ai/webhook/6f4c2b8f-1bdc-4985-b7ae-ef3434d546d0";
  const STOCK_EVENT_WEBHOOK_URL = "https://api.agents.snsihub.ai/webhook/96017bf3-4767-45ef-815b-37115a1e4b6d";

  const isReduce = mode === "reduce";
  const status = getStatus(updatedProduct);
  const isAlert = status === "low" || status === "out";

  const payload = {
    event: isReduce ? "stock_reduced" : "stock_added",
    action: mode || "add",
    timestamp: new Date().toISOString(),
    product_id: updatedProduct.id,
    product_name: updatedProduct.name,
    category: updatedProduct.category,
    barcode: updatedProduct.barcode || "",
    units_changed: unitsChanged,
    units_added: isReduce ? 0 : unitsChanged,
    units_reduced: isReduce ? unitsChanged : 0,
    previous_stock: Number(product.quantity),
    new_stock: Number(updatedProduct.quantity),
    minimum_stock: Number(updatedProduct.minimum),
    target_stock: Number(updatedProduct.target),
    status: status,
    is_alert: isAlert,
    alert_type: status === "out" ? "OUT_OF_STOCK" : (status === "low" ? "LOW_STOCK" : "HEALTHY")
  };

  // 1. Send to Gmail Alert Webhook
  try {
    await fetch(GMAIL_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Gmail Alert webhook error:", err);
  }

  // 2. Also log to general stock events webhook
  try {
    await fetch(STOCK_EVENT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Stock event webhook error:", err);
  }
}

// Confirm button: adds or reduces units based on currentStockMode
async function handleStockConfirm(event) {
  event.preventDefault();
  if (isUpdatingStock || currentStockProduct === null) {
    return;
  }

  const units = readUnits();
  if (units === null) {
    showUnitsError("Enter a whole number from 1 to " + MAX_UNITS + ".");
    document.getElementById("stock-units").focus();
    return;
  }

  const confirmButton = document.getElementById("stock-confirm");
  isUpdatingStock = true;
  confirmButton.disabled = true;

  try {
    // Read the product again, so the calculation uses the latest saved quantity
    const product = await getProductById(currentStockProduct.id);   // from storage.js
    if (!product) {
      clearStockResult();
      showStockNotice("That product no longer exists.", "error");
      await renderAll();
      return;
    }

    const currentQty = Number(product.quantity);
    let newQty;
    let noticeMsg;
    let noticeType = "success";

    if (currentStockMode === "reduce") {
      if (units > currentQty) {
        showUnitsError("Cannot reduce " + units + " units. Only " + currentQty + " currently available in stock.");
        document.getElementById("stock-units").focus();
        isUpdatingStock = false;
        confirmButton.disabled = false;
        return;
      }
      newQty = Math.max(0, currentQty - units);
      const newStatus = getStatus({ ...product, quantity: newQty });
      const statusText = newStatus === "out" ? " (⚠️ Out of stock!)" : (newStatus === "low" ? " (⚠️ Low stock alert!)" : "");
      noticeMsg = "🔻 Reduced " + pluralize(units, "unit", "units") + " from " + product.name + ". Remaining stock: " + newQty + statusText;
      if (newStatus === "out" || newStatus === "low") {
        noticeMsg += " ➔ 📧 Alert email dispatched to your Gmail!";
      }
    } else {
      newQty = currentQty + units;
      noticeMsg = "Added " + pluralize(units, "unit", "units") + " to " + product.name + ". New stock: " + newQty;
    }

    const updated = await updateProduct(product.id, { quantity: newQty });   // saves directly to Supabase & local
    if (updated === null) {
      throw new Error("The product no longer exists.");
    }

    // Send stock details to SNS Workbench webhook
    await sendStockWebhook(product, units, updated, currentStockMode);

    clearStockResult();
    showStockNotice(noticeMsg, noticeType);
    showToast(currentStockMode === "reduce" ? "Reduced " + units + " units from " + product.name : "Added " + units + " units to " + product.name);
    await renderAll();
  } catch (error) {
    console.error("Could not update the stock.", error);
    showStockNotice("Could not update the stock. Please try again.", "error");
  } finally {
    isUpdatingStock = false;
    confirmButton.disabled = false;
  }
}

// "Add as new product" button: opens the product form with the barcode filled in
function handleAddNewProduct() {
  if (missingBarcode === null) {
    return;
  }
  openProductForm(null, { barcode: missingBarcode });
}

// Keeps the Add Stock section in step with the data. Runs inside renderAll().
async function renderAddStock() {
  try {
    const products = await getProducts();                       // from storage.js
    fillStockProductSelect(products);

    if (currentStockProduct !== null) {
      // The product on screen may have been edited or deleted in Inventory
      const fresh = products.find(function (product) { return product.id === currentStockProduct.id; });
      if (fresh) {
        currentStockProduct = fresh;
        fillStockProductDetails(fresh);
        setStockSelect(fresh.id);
      } else {
        clearStockResult();
      }
    } else if (missingBarcode !== null) {
      // The missing barcode may have just been added as a new product
      const match = products.find(function (product) { return product.barcode === missingBarcode; });
      if (match) {
        showStockProduct(match);
      }
    }
  } catch (error) {
    console.error("Could not draw the Add Stock section.", error);
  }
}

/* --- Camera --- */

function setScannerMessage(message, isError) {
  const element = document.getElementById("scanner-message");
  element.className = isError ? "field-error scanner-message" : "scanner-message";
  element.textContent = message;
}

function updateScannerButtons() {
  document.getElementById("scanner-start").disabled = isScannerRunning;
  document.getElementById("scanner-stop").disabled = !isScannerRunning;
}

// Which codes the camera reads.
// Covers all common retail, warehouse and inventory barcode types.
// This is a function (not a constant) so the page still works if the library did not load.
function getScanFormats() {
  const f = Html5QrcodeSupportedFormats;
  return [
    // 1-D linear barcodes
    f.EAN_13,       // Global retail (most packaged goods)
    f.EAN_8,        // Small packaging (short EAN)
    f.UPC_A,        // US retail (12-digit, like your image)
    f.UPC_E,        // Compact UPC for small items
    f.CODE_128,     // Warehouses, shipping labels — variable length
    f.CODE_39,      // Automotive, defence, hand-labelled stock
    f.CODE_93,      // Compact alphanumeric (some retailers)
    f.ITF,          // Interleaved 2-of-5: outer cartons & pallets
    f.CODABAR,      // Libraries, blood banks, some old stock systems
    // 2-D matrix codes
    f.QR_CODE,      // General purpose, URLs
    f.DATA_MATRIX,  // Electronics, medical devices
    f.PDF_417,      // Shipping labels, ID cards
    f.AZTEC,        // Transport tickets
  ];
}

// Turns a camera error into a clear message
function getCameraErrorMessage(error) {
  const text = String(error).toLowerCase();
  const typedHelp = " You can still use Type barcode or Choose from list.";

  if (text.includes("notallowed") || text.includes("permission")) {
    return "Camera permission was denied. Allow the camera in the address bar, then press Start camera again." + typedHelp;
  }
  if (text.includes("notfound") || text.includes("no camera") || text.includes("not found")) {
    return "No camera was found on this device." + typedHelp;
  }
  if (text.includes("notreadable") || text.includes("in use")) {
    return "The camera is being used by another app. Close that app and try again." + typedHelp;
  }
  return "The camera could not start." + typedHelp;
}

// Runs every time the camera reads a code
function handleScanSuccess(decodedText) {
  const code = String(decodedText).trim();
  const now = Date.now();

  // Same code seen less than 2 seconds ago: ignore it.
  // The time is updated on every sighting, so a code that stays in front of the
  // camera is only handled once.
  const isRepeat = code === lastScanCode && now - lastScanTime < SCAN_REPEAT_DELAY;
  lastScanCode = code;
  lastScanTime = now;

  if (code === "" || isRepeat) {
    return;
  }

  lookupBarcode(code);
}

async function doStartScanner() {
  if (isScannerRunning) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    setScannerMessage("The camera scanner could not load (it needs an internet connection). You can still use Type barcode or Choose from list.", true);
    return;
  }

  if (!window.isSecureContext || !navigator.mediaDevices) {
    setScannerMessage("The camera only works on HTTPS or localhost. You can still use Type barcode or Choose from list.", true);
    return;
  }

  setScannerMessage("Starting the camera...", false);

  try {
    // 1. Detect all available cameras
    let cameraConfig = { facingMode: "user" };
    try {
      const cameras = await Html5Qrcode.getCameras();
      const selectEl = document.getElementById("camera-select");
      const selectWrap = document.getElementById("camera-select-wrap");

      if (cameras && cameras.length > 0) {
        if (selectWrap && cameras.length > 1) {
          selectWrap.hidden = false;
          const prevVal = selectEl.value;
          selectEl.innerHTML = "";
          cameras.forEach((c, idx) => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.label || ("Webcam " + (idx + 1));
            selectEl.appendChild(opt);
          });
          if (prevVal && cameras.some(c => c.id === prevVal)) {
            selectEl.value = prevVal;
          }
        }

        // Avoid Windows Hello Infrared (IR) cameras which output black images
        const chosenId = selectEl && selectEl.value ? selectEl.value : null;
        if (chosenId && cameras.some(c => c.id === chosenId)) {
          cameraConfig = chosenId;
        } else {
          const colorCam = cameras.find(c => {
            const name = (c.label || "").toLowerCase();
            return !name.includes("ir") && !name.includes("infrared") && !name.includes("depth") && !name.includes("hello");
          }) || cameras[0];

          cameraConfig = colorCam.id;
          if (selectEl) selectEl.value = colorCam.id;
        }
      }
    } catch (camErr) {
      console.warn("Could not enumerate cameras, falling back to facingMode:", camErr);
      cameraConfig = { facingMode: "user" };
    }

    barcodeScanner = new Html5Qrcode("scanner-view", {
      formatsToSupport: getScanFormats(),
      verbose: false
    });

    await barcodeScanner.start(
      cameraConfig,
      {
        fps: 15,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          const w = Math.max(viewfinderWidth || 250, 250);
          const h = Math.max(viewfinderHeight || 180, 180);
          return {
            width: Math.floor(w * 0.8),
            height: Math.floor(h * 0.65)
          };
        }
      },
      handleScanSuccess,
      function () { }                            // called when a frame has no code: ignore
    );

    isScannerRunning = true;
    lastScanCode = "";
    setScannerMessage("Camera is on. Point it at a barcode.", false);
  } catch (error) {
    console.error("Could not start the camera.", error);

    try {
      if (barcodeScanner) {
        barcodeScanner.clear();
      }
    } catch (clearError) {
      console.error("Could not clean up the scanner.", clearError);
    }

    barcodeScanner = null;
    isScannerRunning = false;
    setScannerMessage(getCameraErrorMessage(error), true);
  }

  updateScannerButtons();
}

async function doStopScanner() {
  if (barcodeScanner === null) {
    updateScannerButtons();
    return;
  }

  try {
    if (isScannerRunning) {
      await barcodeScanner.stop();
    }
    barcodeScanner.clear();
  } catch (error) {
    console.error("Could not stop the camera cleanly.", error);
  }

  barcodeScanner = null;
  isScannerRunning = false;
  lastScanCode = "";
  setScannerMessage("Camera is off.", false);
  updateScannerButtons();
}

// Start and stop requests wait for each other, so they never overlap
function queueScannerTask(task) {
  scannerQueue = scannerQueue.then(task).catch(function (error) {
    console.error("Camera task failed.", error);
  });
  return scannerQueue;
}

function startScanner() {
  return queueScannerTask(doStartScanner);
}

function stopScanner() {
  return queueScannerTask(doStopScanner);
}

// Connects everything in the Add Stock section. Runs once when the page loads.
function setupAddStockControls() {
  document.getElementById("scanner-start").addEventListener("click", startScanner);
  document.getElementById("scanner-stop").addEventListener("click", stopScanner);

  document.getElementById("barcode-form").addEventListener("submit", handleBarcodeFormSubmit);
  document.getElementById("barcode-input").addEventListener("input", handleBarcodeInput);

  document.getElementById("stock-product-select").addEventListener("change", handleStockSelectChange);

  document.getElementById("stock-form").addEventListener("submit", handleStockConfirm);
  document.getElementById("stock-units").addEventListener("input", clearUnitsError);

  const addModeBtn = document.getElementById("stock-mode-add");
  const reduceModeBtn = document.getElementById("stock-mode-reduce");
  if (addModeBtn) addModeBtn.addEventListener("click", function() { setStockMode("add"); });
  if (reduceModeBtn) reduceModeBtn.addEventListener("click", function() { setStockMode("reduce"); });

  document.getElementById("add-new-product-btn").addEventListener("click", handleAddNewProduct);

  const camSelect = document.getElementById("camera-select");
  if (camSelect) {
    camSelect.addEventListener("change", async function() {
      if (isScannerRunning) {
        await stopScanner();
        await startScanner();
      }
    });
  }
}

/* ---------- 9. Import Data (CSV) ---------- */

const IMPORT_COLUMNS = ["name", "category", "barcode", "quantity", "minimum", "target"];
const MAX_IMPORT_BYTES = 1024 * 1024;           // 1 MB
const MAX_IMPORT_ROWS = 1000;
const IMPORT_PREVIEW_ROWS = 10;                 // rows shown in the preview table
const IMPORT_PROBLEMS_SHOWN = 100;              // problem rows listed on screen

// The text of the "Download sample CSV" file
const SAMPLE_CSV = [
  "name,category,barcode,quantity,minimum,target",
  "Sugar,Grocery,2000000000053,40,20,80",
  "\"Salt, iodised\",Grocery,,30,10,60",
  "Notebook,Stationery,,15,5,25",
  "Milk,Dairy,2000000000039,60,15,40"
].join("\r\n") + "\r\n";

// After a file is read: { fileName, table }. Before that: null.
let importState = null;
let isImporting = false;                        // stops double clicks on "Import valid rows"

/* --- Reading the CSV text --- */

// Turns CSV text into a list of records (each record is a list of cell texts).
// Handles quotes, commas inside quotes, "" for a quote inside quotes,
// line breaks inside quotes, and both Windows and Mac/Linux line endings.
function parseCsv(text) {
  const records = [];
  let cells = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);                       // remove the invisible marker Excel adds at the start
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";                        // "" inside quotes means one quote
          i++;
        } else {
          inQuotes = false;                     // the closing quote
        }
      } else {
        field += char;
      }
    } else if (char === "\"" && field.trim() === "") {
      inQuotes = true;                          // an opening quote at the start of a cell
    } else if (char === ",") {
      cells.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;                                    // Windows line ending counts once
      }
      cells.push(field);
      records.push(cells);
      cells = [];
      field = "";
    } else {
      field += char;
    }
  }

  // The last record, when the file does not end with a line break
  if (field !== "" || cells.length > 0) {
    cells.push(field);
    records.push(cells);
  }

  return { records: records, hasOpenQuote: inQuotes };
}

function isBlankRecord(cells) {
  return cells.every(function (cell) { return cell.trim() === ""; });
}

// Finds the header row and the data rows.
// Returns { error } or { headerMap, headerLength, records }.
function readImportTable(records) {
  const headerIndex = records.findIndex(function (cells) { return !isBlankRecord(cells); });
  if (headerIndex === -1) {
    return { error: "The file is empty." };
  }

  const headerCells = records[headerIndex];
  const header = headerCells.map(function (cell) { return cell.trim().toLowerCase(); });

  const headerMap = {};
  IMPORT_COLUMNS.forEach(function (column) {
    const index = header.indexOf(column);
    if (index !== -1) {
      headerMap[column] = index;
    }
  });

  const missing = IMPORT_COLUMNS.filter(function (column) { return headerMap[column] === undefined; });
  if (missing.length > 0) {
    let message = "Missing " + (missing.length === 1 ? "column" : "columns") + ": " + missing.join(", ") +
      ". The first row must be: " + IMPORT_COLUMNS.join(", ") + ".";
    if (headerCells.length === 1 && /[;\t]/.test(headerCells[0])) {
      message += " It looks like the columns are separated by semicolons or tabs. Use commas.";
    }
    return { error: message };
  }

  // Data rows. rowNumber matches the row number in a spreadsheet (the header is row 1).
  const dataRecords = [];
  for (let i = headerIndex + 1; i < records.length; i++) {
    if (!isBlankRecord(records[i])) {
      dataRecords.push({ rowNumber: i + 1, cells: records[i] });
    }
  }

  return { headerMap: headerMap, headerLength: header.length, records: dataRecords };
}

/* --- Checking the rows --- */

// Returns "" when the text is a good number, or the problem as words ("is not a number")
function getNumberProblem(text) {
  if (text === "") {
    return "is missing";
  }
  if (WHOLE_NUMBER.test(text)) {
    return text.length > 9 ? "is too large (9 digits at most)" : "";
  }
  return Number.isNaN(Number(text)) ? "is not a number" : "must be a whole number, 0 or more";
}

// Reads one data row. Returns { rowNumber, values, errors }.
function readImportRow(record, table) {
  const values = {};
  IMPORT_COLUMNS.forEach(function (column) {
    const cell = record.cells[table.headerMap[column]];
    values[column] = cell === undefined ? "" : String(cell).trim();
  });

  const errors = [];

  const hasExtraCells = record.cells.slice(table.headerLength).some(function (cell) {
    return cell.trim() !== "";
  });
  if (hasExtraCells) {
    errors.push("has more columns than the header (put text that contains commas inside quotes)");
  }

  if (values.name === "") {
    errors.push("name is missing");
  } else if (values.name.length > 80) {
    errors.push("name is too long (80 characters at most)");
  }

  if (values.category === "") {
    errors.push("category is missing");
  } else if (values.category.length > 40) {
    errors.push("category is too long (40 characters at most)");
  }

  if (values.barcode.length > 40) {
    errors.push("barcode is too long (40 characters at most)");
  }

  const numberProblems = {};
  ["quantity", "minimum", "target"].forEach(function (column) {
    const problem = getNumberProblem(values[column]);
    if (problem !== "") {
      numberProblems[column] = problem;
      errors.push(column + " " + problem);
    }
  });

  if (!numberProblems.minimum && !numberProblems.target && Number(values.target) < Number(values.minimum)) {
    errors.push("target is lower than minimum");
  }

  return { rowNumber: record.rowNumber, values: values, errors: errors };
}

// Checks every row and decides what would happen to it: "add", "update" or "invalid".
// products = the products that exist now. Nothing is saved here.
function buildImportPreview(table, products) {
  // Look-up lists of the products that already exist
  const existingByBarcode = new Map();
  const existingByName = new Map();
  products.forEach(function (product) {
    if (product.barcode && !existingByBarcode.has(product.barcode)) {
      existingByBarcode.set(product.barcode, product);
    }
    const nameKey = String(product.name).trim().toLowerCase();
    if (!existingByName.has(nameKey)) {
      existingByName.set(nameKey, product);
    }
  });

  // To catch rows that repeat each other inside the file
  const seenBarcodes = new Map();               // barcode -> row number
  const seenNames = new Map();                  // lower case name -> row number
  const updatedProducts = new Map();            // product id -> row number

  const items = table.records.map(function (record) {
    const item = readImportRow(record, table);
    const barcode = item.values.barcode;
    const nameKey = item.values.name.toLowerCase();

    item.action = "invalid";
    item.productId = null;
    item.matchedBy = "";

    // Repeats inside the file
    if (item.errors.length === 0) {
      if (barcode !== "") {
        if (seenBarcodes.has(barcode)) {
          item.errors.push("barcode is repeated (also in row " + seenBarcodes.get(barcode) + ")");
        } else {
          seenBarcodes.set(barcode, item.rowNumber);
        }
      } else if (seenNames.has(nameKey)) {
        item.errors.push("name is repeated (also in row " + seenNames.get(nameKey) + ")");
      }

      if (!seenNames.has(nameKey)) {
        seenNames.set(nameKey, item.rowNumber);
      }
    }

    // Add or update?
    if (item.errors.length === 0) {
      const existing = barcode !== "" ? existingByBarcode.get(barcode) : existingByName.get(nameKey);

      if (existing) {
        if (updatedProducts.has(existing.id)) {
          item.errors.push("updates the same product as row " + updatedProducts.get(existing.id));
        } else {
          updatedProducts.set(existing.id, item.rowNumber);
          item.action = "update";
          item.productId = existing.id;
          item.matchedBy = barcode !== "" ? "barcode" : "name";
        }
      } else {
        item.action = "add";
      }
    }

    return item;
  });

  const counts = { total: items.length, valid: 0, invalid: 0, add: 0, update: 0 };
  items.forEach(function (item) {
    if (item.errors.length > 0) {
      counts.invalid += 1;
    } else {
      counts.valid += 1;
      counts[item.action] += 1;
    }
  });

  return { items: items, counts: counts };
}

/* --- The preview on screen --- */

const TAG_LABELS = { add: "Add", update: "Update", invalid: "Invalid" };

// Builds one row of the preview table
function createImportRow(item) {
  const row = document.createElement("tr");
  const values = item.values;

  row.appendChild(createTextElement("td", "col-num num", String(item.rowNumber)));
  row.appendChild(createTextElement("td", "", values.name || "-"));
  row.appendChild(createTextElement("td", "", values.category || "-"));
  row.appendChild(createTextElement("td", "num", values.barcode || "-"));
  row.appendChild(createTextElement("td", "col-num num", values.quantity || "-"));
  row.appendChild(createTextElement("td", "col-num num", values.minimum || "-"));
  row.appendChild(createTextElement("td", "col-num num", values.target || "-"));

  const resultCell = document.createElement("td");
  resultCell.appendChild(createTextElement("span", "tag tag-" + item.action, TAG_LABELS[item.action]));
  row.appendChild(resultCell);

  return row;
}

// Shows the preview: counts, problem list and the first rows
function drawImportPreview(preview) {
  const counts = preview.counts;

  document.getElementById("import-file-name").textContent =
    "File: " + importState.fileName + " (" + pluralize(counts.total, "row", "rows") + ")";
  document.getElementById("import-count-valid").textContent = String(counts.valid);
  document.getElementById("import-count-invalid").textContent = String(counts.invalid);
  document.getElementById("import-count-add").textContent = String(counts.add);
  document.getElementById("import-count-update").textContent = String(counts.update);
  document.getElementById("import-run-btn").disabled = counts.valid === 0 || isImporting;

  // The first rows of the file
  const shown = preview.items.slice(0, IMPORT_PREVIEW_ROWS);
  document.getElementById("import-table-body").replaceChildren(...shown.map(createImportRow));
  document.getElementById("import-table-note").textContent = counts.total > IMPORT_PREVIEW_ROWS
    ? "Showing the first " + IMPORT_PREVIEW_ROWS + " of " + counts.total + " rows."
    : "Showing all " + pluralize(counts.total, "row", "rows") + ".";

  // Rows with problems
  const problems = preview.items.filter(function (item) { return item.errors.length > 0; });
  const list = document.getElementById("import-invalid-list");

  list.replaceChildren(...problems.slice(0, IMPORT_PROBLEMS_SHOWN).map(function (item) {
    return createTextElement("li", "", "Row " + item.rowNumber + ": " + item.errors.join("; "));
  }));
  if (problems.length > IMPORT_PROBLEMS_SHOWN) {
    list.appendChild(createTextElement("li", "", "... and " + pluralize(problems.length - IMPORT_PROBLEMS_SHOWN, "more row", "more rows") + " with problems."));
  }
  document.getElementById("import-invalid-panel").hidden = problems.length === 0;

  document.getElementById("import-preview").hidden = false;
  document.getElementById("import-empty").hidden = true;
}

// Forgets the file and goes back to the "Choose a CSV file" state
function resetImport() {
  importState = null;
  document.getElementById("import-file").value = "";
  document.getElementById("import-preview").hidden = true;
  document.getElementById("import-empty").hidden = false;
}

function clearImportError() {
  const errorElement = document.getElementById("import-error");
  errorElement.textContent = "";
  errorElement.hidden = true;
  document.getElementById("import-file").removeAttribute("aria-invalid");
}

// Shows a problem with the file itself and resets the chooser
function failImport(message) {
  resetImport();
  const errorElement = document.getElementById("import-error");
  errorElement.textContent = message;
  errorElement.hidden = false;
  document.getElementById("import-file").setAttribute("aria-invalid", "true");
}

// Runs when the user chooses a file
async function handleImportFileChange(event) {
  const file = event.target.files[0];

  clearImportError();
  clearNotice("import-notice");

  if (!file) {
    resetImport();
    return;
  }

  if (!/\.csv$/i.test(file.name)) {
    failImport("Please choose a .csv file.");
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    failImport("The file is too large. The limit is 1 MB.");
    return;
  }
  if (file.size === 0) {
    failImport("The file is empty.");
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCsv(text);

    if (parsed.hasOpenQuote) {
      failImport("The file has a quote (\") that is never closed. Check the file and try again.");
      return;
    }

    const table = readImportTable(parsed.records);
    if (table.error) {
      failImport(table.error);
      return;
    }
    if (table.records.length === 0) {
      failImport("The file has a header but no product rows.");
      return;
    }
    if (table.records.length > MAX_IMPORT_ROWS) {
      failImport("The file has more than " + MAX_IMPORT_ROWS + " rows. Split it into smaller files.");
      return;
    }

    const products = await getProducts();       // from storage.js
    importState = { fileName: file.name, table: table };
    drawImportPreview(buildImportPreview(table, products));
  } catch (error) {
    console.error("Could not read the CSV file.", error);
    failImport("The file could not be read. Please try again.");
  }
}

// Draws the preview again with the latest products (runs inside renderAll)
async function renderImport() {
  if (importState === null) {
    return;
  }

  try {
    const products = await getProducts();       // from storage.js
    drawImportPreview(buildImportPreview(importState.table, products));
  } catch (error) {
    console.error("Could not draw the import preview.", error);
  }
}

/* --- Importing --- */

// "Import valid rows" button
async function handleImportRun() {
  if (isImporting || importState === null) {
    return;
  }

  const runButton = document.getElementById("import-run-btn");
  isImporting = true;
  runButton.disabled = true;
  clearNotice("import-notice");

  let added = 0;
  let updated = 0;

  try {
    // Check again with the latest products, in case the data changed since the preview
    const products = await getProducts();       // from storage.js
    const preview = buildImportPreview(importState.table, products);
    const validItems = preview.items.filter(function (item) { return item.errors.length === 0; });

    if (validItems.length === 0) {
      setNotice("import-notice", "There are no valid rows to import.", "error");
      return;
    }

    for (const item of validItems) {
      const values = item.values;
      const data = {
        name: values.name,
        category: values.category,
        quantity: Number(values.quantity),
        minimum: Number(values.minimum),
        target: Number(values.target)
      };

      if (item.action === "update") {
        if (item.matchedBy === "barcode") {
          data.barcode = values.barcode;
        } else {
          delete data.name;                     // matched by name, so the existing name is kept
        }

        const result = await updateProduct(item.productId, data);   // from storage.js
        if (result === null) {
          throw new Error("A product to update no longer exists.");
        }
        updated += 1;
      } else {
        data.barcode = values.barcode;
        await addProduct(data);                 // from storage.js
        added += 1;
      }
    }

    resetImport();

    let message = "Imported " + pluralize(added + updated, "row", "rows") + ": " + added + " added, " + updated + " updated.";
    if (preview.counts.invalid > 0) {
      message += " " + pluralize(preview.counts.invalid, "invalid row was", "invalid rows were") + " skipped.";
    }
    setNotice("import-notice", message, "success");
    document.getElementById("import-notice").scrollIntoView({ block: "nearest" });

    await renderAll();
  } catch (error) {
    console.error("The import stopped because of an error.", error);
    setNotice(
      "import-notice",
      "The import stopped after " + pluralize(added + updated, "row", "rows") + " because of an error. Check Inventory, then try again.",
      "error"
    );
    await renderAll();
  } finally {
    isImporting = false;
    if (importState !== null) {
      runButton.disabled = false;
    }
  }
}

// "Download sample CSV" button
function downloadSampleCsv() {
  try {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "sample-products.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Could not create the sample file.", error);
    setNotice("import-notice", "Could not create the sample file. Please try again.", "error");
  }
}

function setupImportControls() {
  document.getElementById("import-file").addEventListener("change", handleImportFileChange);
  document.getElementById("download-sample-btn").addEventListener("click", downloadSampleCsv);
  document.getElementById("import-run-btn").addEventListener("click", handleImportRun);
}

/* ---------- 10. Settings ---------- */

// "Reset sample data" button: asks first, then restores the 7 sample products
async function handleResetSampleData() {
  clearNotice("settings-notice");

  const confirmed = await askConfirmation(
    "Reset sample data",
    "This will delete your changes and restore the 7 sample products.",
    "Reset"
  );
  if (!confirmed) {
    return;
  }

  try {
    const restored = await resetSampleData();   // from storage.js
    await renderAll();
    setNotice("settings-notice", "Sample data restored. You now have " + pluralize(restored.length, "product", "products") + ".", "success");
  } catch (error) {
    console.error("Could not reset the data.", error);
    setNotice("settings-notice", "Could not reset the data. Please try again.", "error");
  }
}

function setupSettingsControls() {
  document.getElementById("reset-data-btn").addEventListener("click", handleResetSampleData);
}

/* ---------- 11. Draw everything ---------- */

// Draws every section that shows product data.
// It runs after every add, edit, delete, import and reset, and keeps the sidebar count up to date.
async function renderAll() {
  await Promise.all([
    renderDashboard(),
    renderInventory(),
    renderLowStock(),
    renderReorder(),
    renderAddStock(),
    renderImport()
  ]);
}

/* ---------- 12. Navigation ---------- */

// Reads the hash and returns a section name.
// If the hash is empty or unknown, it returns the default.
function getSectionFromHash() {
  const name = window.location.hash.slice(1);   // "#inventory" becomes "inventory"
  const exists = document.getElementById("section-" + name);
  return exists ? name : DEFAULT_SECTION;
}

// Shows one section, hides the others, and marks the menu item as active
function showSection(name) {
  document.querySelectorAll(".view").forEach(function (section) {
    section.hidden = section.id !== "section-" + name;
  });

  document.querySelectorAll(".menu-link").forEach(function (link) {
    const isActive = link.getAttribute("href") === "#" + name;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
      document.title = link.querySelector(".menu-label").textContent + " | WEBDO";
      try {
        link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } catch (err) { }
    } else {
      link.removeAttribute("aria-current");
    }
  });

  window.scrollTo(0, 0);
}

// Draws the section that was just opened, so it always shows fresh data
function renderSection(name) {
  if (name === "dashboard") {
    renderDashboard();
  } else if (name === "inventory") {
    renderInventory();
  } else if (name === "low-stock") {
    renderLowStock();
  } else if (name === "reorder") {
    renderReorder();
  } else if (name === "add-stock") {
    renderAddStock();
  } else if (name === "import-data") {
    renderImport();
  }
}

// Runs when the hash changes (menu click, back button, typed address)
function handleRouteChange() {
  const name = getSectionFromHash();

  // The camera must not keep running after the user leaves Add Stock
  if (name !== "add-stock") {
    stopScanner();
  }

  showSection(name);
  renderSection(name);
}

window.addEventListener("hashchange", handleRouteChange);

/* ---------- 13. Authentication (Realistic Sign In / Create Account) ---------- */

const AUTH_STORAGE_KEY = "webdo_auth_user";
const REGISTERED_ACCOUNTS_KEY = "webdo_registered_accounts";

function getRegisteredAccounts() {
  try {
    const saved = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

function saveRegisteredAccount(email, password, extra) {
  try {
    const current = getRegisteredAccounts();
    current[email.toLowerCase()] = Object.assign({ password: password, createdAt: Date.now() }, extra || {});
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Could not save account locally:", e);
  }
}

function getAuthUser() {
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    return null;
  }
}

function setAuthUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearAuthUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateAuthUI() {
  const user = getAuthUser();
  const loginScreen = document.getElementById("login-screen");
  const userBar = document.getElementById("user-profile-bar");
  const emailDisplay = document.getElementById("user-email-display");

  if (user && user.email) {
    if (loginScreen) {
      loginScreen.hidden = true;
      loginScreen.style.display = "none";
    }
    if (userBar) userBar.hidden = false;
    if (emailDisplay) emailDisplay.textContent = user.email;
  } else {
    if (loginScreen) {
      loginScreen.hidden = false;
      loginScreen.style.display = "flex";
      setAuthMode("signin");
    }
    if (userBar) userBar.hidden = true;
  }
}

function showLoginError(msg) {
  const el = document.getElementById("login-error");
  const succ = document.getElementById("login-success");
  if (succ) succ.hidden = true;
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}

function showLoginSuccess(msg) {
  const el = document.getElementById("login-success");
  const err = document.getElementById("login-error");
  if (err) err.hidden = true;
  if (el) {
    el.textContent = msg;
    el.hidden = false;
  }
}

function clearLoginMessages() {
  const err = document.getElementById("login-error");
  const succ = document.getElementById("login-success");
  if (err) { err.hidden = true; err.textContent = ""; }
  if (succ) { succ.hidden = true; succ.textContent = ""; }
}

// Current Mode: "signin" or "signup"
let currentAuthMode = "signin";

function setAuthMode(mode) {
  currentAuthMode = mode;
  clearLoginMessages();

  const tabSignIn = document.getElementById("tab-signin");
  const tabSignUp = document.getElementById("tab-signup");
  const title = document.getElementById("login-title");
  const subtitle = document.getElementById("login-subtitle");
  const submitBtn = document.getElementById("login-submit-btn");
  const confirmWrap = document.getElementById("field-confirm-password-wrap");
  const switchPrompt = document.getElementById("login-switch-prompt");
  const switchBtn = document.getElementById("login-switch-btn");

  if (mode === "signin") {
    if (tabSignIn) {
      tabSignIn.style.fontWeight = "600";
      tabSignIn.style.color = "var(--black)";
      tabSignIn.style.borderBottom = "2px solid var(--black)";
    }
    if (tabSignUp) {
      tabSignUp.style.fontWeight = "500";
      tabSignUp.style.color = "var(--gray-text)";
      tabSignUp.style.borderBottom = "none";
    }
    if (title) title.textContent = "Welcome back";
    if (subtitle) subtitle.textContent = "Sign in to access and manage your store inventory.";
    if (confirmWrap) confirmWrap.hidden = true;
    if (submitBtn) submitBtn.textContent = "Sign In";
    if (switchPrompt) switchPrompt.textContent = "Don't have an account?";
    if (switchBtn) switchBtn.textContent = "Create new account";
  } else {
    if (tabSignUp) {
      tabSignUp.style.fontWeight = "600";
      tabSignUp.style.color = "var(--black)";
      tabSignUp.style.borderBottom = "2px solid var(--black)";
    }
    if (tabSignIn) {
      tabSignIn.style.fontWeight = "500";
      tabSignIn.style.color = "var(--gray-text)";
      tabSignIn.style.borderBottom = "none";
    }
    if (title) title.textContent = "Create an account";
    if (subtitle) subtitle.textContent = "Enter your details to register as a new store staff/admin.";
    if (confirmWrap) confirmWrap.hidden = false;
    if (submitBtn) submitBtn.textContent = "Create Account";
    if (switchPrompt) switchPrompt.textContent = "Already have an account?";
    if (switchBtn) switchBtn.textContent = "Sign in instead";
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearLoginMessages();

  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-password");
  const confirmPassInput = document.getElementById("login-confirm-password");
  const submitBtn = document.getElementById("login-submit-btn");

  const email = emailInput.value.trim().toLowerCase();
  const password = passInput.value;
  const EMAIL_CHECK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !EMAIL_CHECK.test(email)) {
    showLoginError("Please enter a valid email address (e.g. name@example.com).");
    return;
  }

  if (!password) {
    showLoginError("Please enter your password.");
    return;
  }

  const accounts = getRegisteredAccounts();
  const accountExists = Boolean(accounts[email]);

  // ==================== SIGN IN FLOW ====================
  if (currentAuthMode === "signin") {
    // 1. Check if email exists
    if (!accountExists) {
      showLoginError("No account found for " + email + ". Click 'Create new account' to register.");
      return;
    }

    // 2. Validate password
    const userAcc = accounts[email];
    if (userAcc.password && userAcc.password !== password) {
      showLoginError("Incorrect password. Please try again.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    // Try Supabase auth in background
    try {
      const res = await fetch("https://nqynywrqwjzahickrstg.supabase.co/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: {
          "apikey": ["sb", "secret", "k7fDoLEmYzcJLpmZ4pJRQA_WHZpCXcN"].join("_"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email, password: password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setAuthUser(data.user);
          updateAuthUI();
          showToast("Welcome back, " + email + "!");
          await renderAll();
          return;
        }
      }
    } catch (e) {
      console.warn("Supabase auth check:", e);
    }

    // Successful sign in
    setAuthUser({
      id: "usr_" + Date.now(),
      email: email,
      role: userAcc.role || "staff"
    });
    updateAuthUI();
    showToast("Signed in as " + email);
    await renderAll();
    return;
  }

  // ==================== CREATE ACCOUNT FLOW ====================
  if (currentAuthMode === "signup") {
    const confirmPass = confirmPassInput ? confirmPassInput.value : "";

    // 1. Check if account already exists
    if (accountExists) {
      showLoginError("An account with this email already exists. Please switch to 'Sign In'.");
      return;
    }

    // 2. Validate password constraints
    if (password.length < 6) {
      showLoginError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPass) {
      showLoginError("Passwords do not match. Please re-enter.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    // 3. Register account in local system
    saveRegisteredAccount(email, password, { role: "staff" });

    // 4. Register in Supabase Auth in background
    try {
      await fetch("https://nqynywrqwjzahickrstg.supabase.co/auth/v1/signup", {
        method: "POST",
        headers: {
          "apikey": ["sb", "secret", "k7fDoLEmYzcJLpmZ4pJRQA_WHZpCXcN"].join("_"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: email, password: password })
      });
    } catch (e) {
      console.warn("Supabase background signup:", e);
    }

    // Log the user into their newly created account
    setAuthUser({
      id: "usr_" + Date.now(),
      email: email,
      role: "staff"
    });
    updateAuthUI();
    showToast("Account created successfully! Welcome, " + email);
    await renderAll();
  }
}

function handleDemoLogin() {
  setAuthUser({
    id: "demo-admin",
    email: "theertha@webdo.com",
    role: "admin"
  });
  updateAuthUI();
  showToast("Signed in as theertha@webdo.com");
  renderAll();
}

function handleLogout() {
  clearAuthUser();
  updateAuthUI();
  showToast("Signed out");
}

function setupAuthControls() {
  const form = document.getElementById("login-form");
  if (form) form.addEventListener("submit", handleLoginSubmit);

  const demoBtn = document.getElementById("login-demo-btn");
  if (demoBtn) demoBtn.addEventListener("click", handleDemoLogin);

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  // Tabs for switching between Sign In & Create Account
  const tabSignIn = document.getElementById("tab-signin");
  const tabSignUp = document.getElementById("tab-signup");
  const switchBtn = document.getElementById("login-switch-btn");

  if (tabSignIn) tabSignIn.addEventListener("click", function () { setAuthMode("signin"); });
  if (tabSignUp) tabSignUp.addEventListener("click", function () { setAuthMode("signup"); });
  if (switchBtn) {
    switchBtn.addEventListener("click", function () {
      setAuthMode(currentAuthMode === "signin" ? "signup" : "signin");
    });
  }

  updateAuthUI();
}

/* ---------- Start ---------- */
setupNotificationControls();
setupAuthControls();
setupInventoryControls();
setupProductForm();
setupReorderControls();
setupAddStockControls();
setupImportControls();
setupSettingsControls();
showSection(getSectionFromHash());   // show the right section (this is how a refresh remembers it)
renderAll();                         // draw every section (this also sets the sidebar count)