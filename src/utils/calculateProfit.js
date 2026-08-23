function calculateProfitMargin(costPrice, sellingPrice) {
  const cost = Number(costPrice);
  const selling = Number(sellingPrice);
  if (!Number.isFinite(cost) || !Number.isFinite(selling) || selling <= 0) return 0;
  return Number((((selling - cost) / selling) * 100).toFixed(2));
}

module.exports = { calculateProfitMargin };
