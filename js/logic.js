/* ==========================================================
   logic.js
   Business rules. These functions only look at the data you
   give them. They never read or save anything.
   ========================================================== */

// Returns "out", "low" or "healthy"
function getStatus(product) {
  const quantity = Number(product.quantity);
  const minimum = Number(product.minimum);

  if (quantity <= 0) {
    return "out";
  }
  if (quantity <= minimum) {
    return "low";
  }
  return "healthy";
}

// Target - Current, only for low and out items. Never below 0.
function getSuggestedReorder(product) {
  if (getStatus(product) === "healthy") {
    return 0;
  }
  return Math.max(0, Number(product.target) - Number(product.quantity));
}

// Numbers for the dashboard
function getSummary(products) {
  let totalStock = 0;
  let lowCount = 0;
  let outCount = 0;

  products.forEach(function (product) {
    totalStock += Number(product.quantity);

    const status = getStatus(product);
    if (status === "low") {
      lowCount += 1;
    } else if (status === "out") {
      outCount += 1;
    }
  });

  return {
    totalProducts: products.length,
    totalStock: totalStock,
    lowCount: lowCount,
    outCount: outCount
  };
}