(function () {
  const liujinSpecs = [
    { value: "hard-2440", label: "硬质-1220*2440*6mm", width: 1.22, length: 2.44, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 70 },
    { value: "hard-3050", label: "硬质-1220*3050*6mm", width: 1.22, length: 3.05, unitWeight: 38, lengthType: "long", material: "hard", defaultSqmPrice: 70 },
    { value: "hard-600", label: "硬质-1200*600*6mm", width: 1.2, length: 0.6, unitWeight: 7.5, lengthType: "small", material: "hard", defaultSqmPrice: 70 },
    { value: "soft-2440", label: "软质-1200*2440*2~3mm", width: 1.2, length: 2.44, unitWeight: 15, lengthType: "short", material: "soft", defaultSqmPrice: 80 },
    { value: "soft-3000", label: "软质-1200*3000*2~3mm", width: 1.2, length: 3, unitWeight: 20, lengthType: "long", material: "soft", defaultSqmPrice: 80 }
  ];

  const liujinSeriesPriceGroups = [
    { names: ["珠光釉", "鎏金", "大漠沙丘", "大漠", "仿锈", "金丝绒", "琼花", "星闪砂"], prices: { "hard-2440": 70, "hard-3050": 70, "soft-2440": 80, "soft-3000": 80 } },
    { names: ["珍珠绒", "云绸"], prices: { "hard-2440": 75, "hard-3050": 75, "soft-2440": 85, "soft-3000": 85 } },
    { names: ["铜铁锈", "古铜", "绫罗", "熔岩", "锈语", "铜话"], prices: { "hard-2440": 80, "hard-3050": 80, "soft-2440": 90, "soft-3000": 90 } },
    { names: ["凤尾", "绢丝", "德克德勒"], prices: { "hard-2440": 85, "hard-3050": 85, "soft-2440": 95, "soft-3000": 95 } },
    { names: ["烟花", "幻影"], prices: { "hard-2440": 90, "hard-3050": 90, "soft-2440": 100, "soft-3000": 100 } },
    { names: ["仿金属", "钛金"], prices: { "hard-2440": 100, "hard-3050": 100, "soft-2440": 110, "soft-3000": 110 } },
    { names: ["珠光"], prices: { "hard-2440": 155, "hard-3050": 155, "soft-2440": 165, "soft-3000": 165 } },
    { names: ["液态金属"], prices: { "hard-2440": 105 } }
  ];

  const sandstoneSpecs = [
    { value: "sand-2440", label: "1220*2440*6mm", width: 1.22, length: 2.44, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 140 },
    { value: "sand-2400", label: "1200*2400*6mm", width: 1.2, length: 2.4, unitWeight: 30, lengthType: "short", material: "hard", defaultSqmPrice: 140 },
    { value: "sand-600", label: "1200*600*6mm", width: 1.2, length: 0.6, unitWeight: 7.5, lengthType: "small", material: "hard", defaultSqmPrice: 130 }
  ];

  const ningboProductCatalog = [
    { name: "水泥浇筑板", price: 70, specs: ["3100*1180"] },
    { name: "水波纹板", price: 90, specs: ["3000*1150", "2750*1060", "2800*540"] },
    { name: "木浇筑板", price: 70, specs: ["2830*1140"] },
    { name: "洞石", price: 70, specs: ["2800*1200", "2400*1200"] },
    { name: "洞石", price: 50, specs: ["1200*600"] },
    { name: "新洞石（密孔）", price: 70, specs: ["2380*1160"] },
    { name: "海洞石", price: 75, specs: ["2400*1200"] },
    { name: "新版洞石", price: 70, specs: ["3000*1200", "2400*1200"] },
    { name: "粗纹线石", price: 80, specs: ["2800*1200", "2380*1180", "2360*580"] },
    { name: "新线石", price: 75, specs: ["2950*1200", "2700*1200"] },
    { name: "炭烧木", price: 75, specs: ["2850*930"] },
    { name: "大竹纹（凸模）", price: 85, specs: ["2950*1000", "2880*580"] },
    { name: "大竹纹（凹模）", price: 95, specs: ["2800*980"] },
    { name: "波浪石", price: 80, specs: ["1200*2750"] },
    { name: "波浪", price: 90, specs: ["2800*1200"] },
    { name: "中线石", price: 90, specs: ["2800*1200"] },
    { name: "脊线石", price: 80, specs: ["2800*1200"] },
    { name: "环型石", price: 90, specs: ["2800*1200"] },
    { name: "粗布纹", price: 80, specs: ["2800*1200"] },
    { name: "星云石", price: 85, specs: ["2830*1150"] },
    { name: "星云石B款", price: 85, specs: ["3000*1200"] },
    { name: "星月石", price: 85, specs: ["3100*1160", "2830*1150"] },
    { name: "星月石", price: 70, specs: ["1200*600"] },
    { name: "花岗岩", price: 78, specs: ["3000*1150"] },
    { name: "花岗岩", price: 48, specs: ["1200*600"] },
    { name: "花岗岩拼接", price: 80, specs: ["2700*1200"] },
    { name: "阡陌石（方线石）", price: 85, specs: ["2800*1000", "2800*580"] },
    { name: "脉络石", price: 85, specs: ["2800*990", "2800*1200", "2800*600"] },
    { name: "双线石", price: 90, specs: ["2650*1180"] },
    { name: "三角板（山纹）", price: 85, specs: ["2850*990"] },
    { name: "泡沫铝", price: 100, specs: ["2800*1130"] },
    { name: "圆铝", price: 90, specs: ["2360*1180"] },
    { name: "锯木板", price: 85, specs: ["3100*1160"] },
    { name: "马赛克", price: 90, specs: ["2850*1080"] },
    { name: "方形马赛克", price: 80, specs: ["2900*1180"] },
    { name: "50马赛克小板1", price: 75, specs: ["1190*590"] },
    { name: "22马赛克小板2", price: 75, specs: ["1190*590"] },
    { name: "条石拼接", price: 75, specs: ["600*150"] },
    { name: "斧开石", price: 95, specs: ["3000*1200"] },
    { name: "黑山岩、劈开岩", price: 95, specs: ["3100*1160"] },
    { name: "黑山岩小板", price: 70, specs: ["1200*600"] },
    { name: "溶积岩", price: 100, specs: ["3000*1160"] },
    { name: "叠纹石（山岳石）", price: 100, specs: ["3100*1160"] },
    { name: "沉积岩", price: 125, specs: ["2850*1100"] },
    { name: "页岩", price: 125, specs: ["3100*1160"] },
    { name: "古木纹细", price: 80, specs: ["2950*1200"] },
    { name: "古木纹粗", price: 80, specs: ["3000*1200"] },
    { name: "大布纹石", price: 70, specs: ["2500*1160"] },
    { name: "玄武岩", price: 80, specs: ["3000*600"] },
    { name: "水泥板（打印）", price: 90, specs: ["2850*1150"] },
    { name: "平板", price: 80, specs: ["2850*1150"] },
    { name: "锈石", price: 100, specs: ["2850*950"] },
    { name: "平面锈石", price: 100, specs: ["2950*1160"] },
    { name: "鎏金板软质", price: 95, specs: ["2950*1160"] },
    { name: "鎏金板硬质", price: 85, specs: ["3000*1220", "2440*1220"] },
    { name: "麻编（小）", price: 70, specs: ["1420*560"] },
    { name: "麻编（大）", price: 77, specs: ["2650*1160"] },
    { name: "竹编/人字编", price: 75, specs: ["2360*1160"] },
    { name: "积木纹", price: 80, specs: ["2950*1180"] },
    { name: "条石纹", price: 80, specs: ["2850*990"] },
    { name: "苹果叶", price: 90, specs: ["2900*1160"] },
    { name: "芭蕉叶", price: 90, specs: ["3000*1150"] },
    { name: "齿木纹", price: 90, specs: ["2360*1160"] },
    { name: "大齿木", price: 90, specs: ["2360*1160"] },
    { name: "水立方", price: 90, specs: ["3000*1140"] },
    { name: "木立方（山竹板）", price: 90, specs: ["2950*1160"] },
    { name: "夯土砖", price: 95, specs: ["2850*1000"] },
    { name: "15线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "35线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "23线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "71线石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "摩洛石（金属色）", price: 95, specs: ["2950*1180"] },
    { name: "峭壁岩", price: 75, specs: ["1060*590"] },
    { name: "岩板", price: 80, specs: ["2900*1160"] },
    { name: "岩板3D", price: 90, specs: ["2900*1160"] },
    { name: "大理石3D", price: 90, specs: ["2950*1160"] },
    { name: "莱姆石3D", price: 90, specs: ["2800*1200"] },
    { name: "粗夯土3D", price: 85, specs: ["3000*1200", "2900*1160", "2800*1030", "2680*930"] },
    { name: "云丘", price: 90, specs: ["2950*1160"] },
    { name: "山丘", price: 90, specs: ["2700*1200"] },
    { name: "20内圆", price: 95, specs: ["3000*1200"] },
    { name: "30内圆", price: 95, specs: ["3000*1200"] },
    { name: "100内圆", price: 105, specs: ["3000*590"] },
    { name: "大峭壁岩", price: 95, specs: ["3000*1200"] },
    { name: "腾编", price: 95, specs: ["3000*1200"] },
    { name: "麻编", price: 95, specs: ["3000*1200"] },
    { name: "洞石拼接", price: 100, specs: ["3000*1200"] },
    { name: "岁月痕", price: 95, specs: ["3000*1200"] },
    { name: "斧凿石", price: 95, specs: ["3000*1200"] },
    { name: "山峰石", price: 115, specs: ["3000*1200"] },
    { name: "拼接文化石", price: 95, specs: ["2800*1200"] },
    { name: "条形文化石", price: 95, specs: ["2800*1200"] },
    { name: "大板岩", price: 90, specs: ["3000*1200"] },
    { name: "3D洞石", price: 75, specs: ["1200*2400", "1200*2800"] },
    { name: "3D洞石", price: 55, specs: ["1200*600"] },
    { name: "3D新版洞石", price: 75, specs: ["1200*2400", "1200*2800", "1200*3000"] },
    { name: "3D新版洞石", price: 55, specs: ["1200*600"] }
  ];

  function groupedNingboCatalog() {
    const groups = new Map();
    ningboProductCatalog.forEach((item) => {
      if (!groups.has(item.name)) groups.set(item.name, { name: item.name, price: item.price, specs: [] });
      const target = groups.get(item.name);
      item.specs.forEach((spec) => {
        if (!target.specs.includes(spec)) target.specs.push(spec);
      });
    });
    return Array.from(groups.values());
  }

  function isLiujinProductName(value) {
    const text = String(value || "").replace(/\s+/g, "").toLowerCase();
    if (!text) return false;
    if (text.includes("鎏金")) return true;
    return liujinSeriesPriceGroups.some((group) => group.names.some((name) => text.includes(name.toLowerCase())));
  }

  function findLiujinSeriesPrice(productName, specKey) {
    const text = String(productName || "").replace(/\s+/g, "").toLowerCase();
    if (!text) return null;
    let bestMatch = null;
    liujinSeriesPriceGroups.forEach((group) => {
      group.names.forEach((name) => {
        const keyword = String(name || "").replace(/\s+/g, "").toLowerCase();
        if (!keyword || !text.includes(keyword)) return;
        if (!bestMatch || keyword.length > bestMatch.keywordLength) {
          bestMatch = { group, keywordLength: keyword.length };
        }
      });
    });
    if (!bestMatch) return null;
    return Object.prototype.hasOwnProperty.call(bestMatch.group.prices, specKey)
      ? bestMatch.group.prices[specKey]
      : "";
  }

  window.JieGeProductData = {
    liujinSpecs,
    liujinSeriesPriceGroups,
    sandstoneSpecs,
    ningboProductCatalog,
    groupedNingboCatalog,
    isLiujinProductName,
    findLiujinSeriesPrice
  };
})();
