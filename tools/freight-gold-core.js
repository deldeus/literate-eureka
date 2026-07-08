(function () {
  const specs = {
    hard: [
      { label: "1220*2440mm", key: "hard-2440", unitWeight: 30, lengthType: "short", material: "hard" },
      { label: "1220*3050mm", key: "hard-3050", unitWeight: 38, lengthType: "long", material: "hard" },
      { label: "1200*600mm", key: "hard-600", unitWeight: 7.5, lengthType: "small", material: "hard" }
    ],
    soft: [
      { label: "1200*2440mm", key: "soft-2440", unitWeight: 15, lengthType: "short", material: "soft" },
      { label: "1200*3000mm", key: "soft-3000", unitWeight: 20, lengthType: "long", material: "soft" }
    ]
  };

  const crates = {
    short: [
      { name: "木箱7", outer: "2.53*1.31*0.25", weight: 65, hardCap: 15, softCap: 30 },
      { name: "木箱7", outer: "2.53*1.31*0.35", weight: 70, hardCap: 30, softCap: 60 },
      { name: "木箱7", outer: "2.53*1.31*0.45", weight: 75, hardCap: 45, softCap: 90 },
      { name: "木箱7", outer: "2.53*1.31*0.7", weight: 90, hardCap: 88, softCap: 176 }
    ],
    long: [
      { name: "木箱9", outer: "3.09*1.31*0.3", weight: 92, hardCap: 15, softCap: 30 },
      { name: "木箱9", outer: "3.09*1.31*0.35", weight: 100, hardCap: 30, softCap: 60 },
      { name: "木箱9", outer: "3.09*1.31*0.45", weight: 108, hardCap: 45, softCap: 90 },
      { name: "木箱9", outer: "3.09*1.28*0.55", weight: 116, hardCap: 60, softCap: 120 }
    ]
  };

  const pallets = {
    short: { label: "2米拖盘", size: "2.46*1.25*0.25", weight: 46 },
    long: { label: "3米拖盘", size: "3.15*1.35*0.16", weight: 65 },
    small: { label: "小托盘", weight: 16 }
  };

  function specByKey(material, specKey) {
    const group = specs[material] || specs.hard;
    return group.find((item) => item.key === specKey) || group[0];
  }

  function normalizeItem(item) {
    const material = item.material === "soft" ? "soft" : "hard";
    const spec = item.spec && item.spec.key ? item.spec : specByKey(material, item.specKey);
    const quantity = Number.parseInt(String(item.quantity || "").trim(), 10);
    return { ...item, material, spec, quantity };
  }

  function shipmentLengthType(items) {
    if (items.some((item) => item.spec.lengthType === "long")) return "long";
    if (items.some((item) => item.spec.lengthType === "short")) return "short";
    return "small";
  }

  function shipmentSpecLabel(items) {
    return items.map((item) => item.spec.label).join(" + ");
  }

  function boardWeightLine(items) {
    return items.map((item) => `${item.quantity}*${item.spec.unitWeight}`).join("+");
  }

  function boardWeight(items) {
    return items.reduce((sum, item) => sum + item.quantity * item.spec.unitWeight, 0);
  }

  function hardEquivalentQuantity(items) {
    return items.reduce((sum, item) => sum + item.quantity * (item.material === "soft" ? 0.5 : 1), 0);
  }

  function formatWeight(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
  }

  function packageQuestionLine(pkg) {
    if (!pkg) return "";
    if (pkg.type === "pallet" && pkg.size) return `${pkg.label}：${pkg.size}`;
    return pkg.output;
  }

  function choosePackage(items, lengthType) {
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (lengthType === "small") {
      const palletCount = quantity > 100 ? Math.ceil(quantity / 100) : 1;
      const weight = pallets.small.weight * palletCount;
      return {
        ...pallets.small,
        weight,
        type: "pallet",
        output: palletCount > 1 ? `${pallets.small.label} x ${palletCount}` : pallets.small.label
      };
    }

    const equivalentQuantity = hardEquivalentQuantity(items);
    if (equivalentQuantity <= 10) {
      return { ...pallets[lengthType], type: "pallet", output: pallets[lengthType].label };
    }

    const crate = crates[lengthType].find((entry) => equivalentQuantity <= entry.hardCap);
    if (crate) {
      return { ...crate, type: "crate", output: crate.outer };
    }

    return null;
  }

  function maxCapacity(lengthType) {
    if (lengthType === "small") return 100;
    return lengthType === "short" ? 88 : 60;
  }

  function calculateShipment(rawItems) {
    const items = rawItems
      .map(normalizeItem)
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (!items.length) {
      return { ok: false, type: "empty", message: "请填写至少一组规格数量" };
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const lengthType = shipmentLengthType(items);
    const pkg = choosePackage(items, lengthType);
    const db = Math.ceil(totalQuantity * 1.5);

    if (!pkg) {
      const max = maxCapacity(lengthType);
      const message = `当前合计 ${formatWeight(hardEquivalentQuantity(items))} 张硬质等效数量超过表格最大可装数量（${max}张），请拆分多箱后再提交。`;
      return { ok: false, type: "overflow", message, dbLine: `DB${db}` };
    }

    const boardTotal = boardWeight(items);
    const totalWeight = boardTotal + pkg.weight;
    const detailLine = shipmentSpecLabel(items);
    const weightLine = `${boardWeightLine(items)}+${pkg.weight}=${formatWeight(totalWeight)}KG`;
    const packageLine = packageQuestionLine(pkg);
    const dbLine = `DB${db}`;
    const notice = pkg.type === "pallet"
      ? `合计${totalQuantity}张，硬软混装按硬质等效 ${formatWeight(hardEquivalentQuantity(items))} 张核算，在优先托盘范围内，使用${pkg.output}，包装重量 ${pkg.weight}KG。`
      : `合计${totalQuantity}张，硬软混装按硬质等效 ${formatWeight(hardEquivalentQuantity(items))} 张核算，按最长规格匹配${pkg.name}，外径 ${pkg.outer}，木箱重量 ${pkg.weight}KG。`;

    return {
      ok: true,
      items,
      totalQuantity,
      lengthType,
      pkg,
      boardTotal,
      totalWeight,
      db,
      detailLine,
      weightLine,
      packageLine,
      dbLine,
      notice
    };
  }

  function allKyeRateRows() {
    const data = window.KYE_RATE_DATA || {};
    return [...(data.outside || []), ...(data.anhui || [])];
  }

  function isJiangZheHu(address) {
    return /江苏|浙江|上海/.test(address || "");
  }

  function matchKyeRate(address) {
    const text = String(address || "").replace(/\s+/g, "");
    if (!text || text === "请粘贴地址") return { type: "empty" };
    if (isJiangZheHu(text)) return { type: "self" };

    const rows = allKyeRateRows();
    const cityMatch = rows.find((row) => (row.cities || []).some((city) => city && text.includes(city)));
    if (cityMatch) return { type: "rate", row: cityMatch };

    const provinceMatch = rows.find((row) => row.province && text.includes(row.province));
    if (provinceMatch) return { type: "rate", row: provinceMatch };

    return { type: "none" };
  }

  function kyeInterval(row, totalWeight) {
    return (row.intervals || []).find(([low, high]) => totalWeight > low && totalWeight <= high)
      || (row.intervals || [])[row.intervals.length - 1];
  }

  function packageDimensionText(pkg) {
    if (!pkg) return "";
    return pkg.size || pkg.outer || "";
  }

  function hasOversizePackage(pkg) {
    const dims = packageDimensionText(pkg).match(/\d+(?:\.\d+)?/g);
    if (!dims) return false;
    return dims.some((value) => Number.parseFloat(value) > 1.8);
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return "-";
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  }

  function buildKyeQuote({ address, totalWeight, pkg, weightLine, packageLine, dbLine }) {
    if (!Number.isFinite(totalWeight) || totalWeight <= 0 || !pkg) {
      return { totalText: "-", quoteText: "请填写地址和规格数量", processText: "自动显示计算过程" };
    }

    const match = matchKyeRate(address);
    if (match.type === "empty") {
      return { totalText: "-", quoteText: "请先填写收货地址", processText: "需要地址后才能匹配跨越费率。" };
    }
    if (match.type === "self") {
      return {
        totalText: "江浙沪自行查询",
        quoteText: `${address}\n\n江浙沪需自行查询`,
        processText: "江苏、浙江、上海地址不自动计算跨越运费。"
      };
    }
    if (match.type === "none") {
      return {
        totalText: "-",
        quoteText: `${address}\n\n未匹配到跨越费率，请手动查询。`,
        processText: "当前地址没有匹配到表格里的省市。"
      };
    }

    const row = match.row;
    const interval = kyeInterval(row, totalWeight);
    if (!interval) {
      return {
        totalText: "-",
        quoteText: `${address}\n\n未匹配到重量区间，请手动查询。`,
        processText: "当前重量没有匹配到跨越重量段。"
      };
    }

    const firstWeight = Number(row.firstWeight || 1);
    const firstPrice = Number(row.firstPrice || 10);
    const rate = Number(interval[2]);
    const chargeWeight = Math.max(0, totalWeight - firstWeight);
    const segmentFee = Math.ceil(chargeWeight * rate);
    const insuranceFee = 20;
    const longFee = hasOversizePackage(pkg) ? 50 : 0;
    const totalFee = firstPrice + segmentFee + insuranceFee + longFee;
    const intervalLabel = `(${interval[0]},${interval[1] === 999999 ? "+∞" : interval[1]}]KG`;
    const quoteText = `${address}\n\n${weightLine}\n${packageLine}\n${dbLine}\n\n跨越速运：${totalFee}元`;
    const processText = [
      `匹配：${row.province} ${(row.cities || []).join("/")}`,
      `重量段：${intervalLabel}，单价 ${formatMoney(rate)}元/KG`,
      `①首重：${formatMoney(firstWeight)}KG：${formatMoney(firstPrice)}元`,
      `②(${formatWeight(totalWeight)}-${formatMoney(firstWeight)})=${formatWeight(chargeWeight)}KG*${formatMoney(rate)}元/KG=${segmentFee}元`,
      `③保费（单件）：${insuranceFee}元`,
      `④加长费（尺寸超过1.8米）：${longFee}元`,
      `合计：${firstPrice}+${segmentFee}+${insuranceFee}+${longFee}=${totalFee}元`
    ].join("\n");

    return { totalText: `${totalFee}元`, quoteText, processText };
  }

  window.GoldFreightCore = {
    specs,
    crates,
    pallets,
    specByKey,
    normalizeItem,
    calculateShipment,
    formatWeight,
    packageQuestionLine,
    buildKyeQuote
  };
})();
